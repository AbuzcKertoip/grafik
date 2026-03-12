"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/actions/mailer"
import * as XLSX from 'xlsx'
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { hasPermission } from "@/lib/auth/permissions"

export async function getWorkLogs(userId: number, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const logs = await prisma.workLogEntry.findMany({
        where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: {
            date: 'asc',
        },
    })

    return logs
}

export async function createWorkLog(data: any) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Unauthorized" }

    const { date, description, project, startTime, endTime, duration, overtime } = data
    const userId = parseInt(session.user.id)

    try {
        await prisma.workLogEntry.create({
            data: {
                userId,
                date: new Date(date),
                description,
                project,
                startTime,
                endTime,
                duration: parseFloat(duration) || 0,
                overtime: parseFloat(overtime) || 0,
            },
        })
        revalidatePath("/dashboard/work-logs")
        return { success: true }
    } catch (error) {
        return { error: "Failed to create log" }
    }
}

export async function updateWorkLog(id: number, data: any) {
    const { description, project, startTime, endTime, duration, overtime } = data

    try {
        await prisma.workLogEntry.update({
            where: { id },
            data: {
                description,
                project,
                startTime,
                endTime,
                duration: parseFloat(duration) || 0,
                overtime: parseFloat(overtime) || 0,
            },
        })
        revalidatePath("/dashboard/work-logs")
        return { success: true }
    } catch (error) {
        return { error: "Failed to update log" }
    }
}

export async function deleteWorkLog(id: number) {
    try {
        await prisma.workLogEntry.delete({
            where: { id },
        })
        revalidatePath("/dashboard/work-logs")
        return { success: true }
    } catch (error) {
        return { error: "Failed to delete log" }
    }
}

export async function syncScheduleToWorkLogs(userId: number | string, year: number, month: number) {
    const uId = parseInt(userId.toString())
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

    try {
        // 1. Get Schedule
        const schedule = await prisma.scheduleDay.findMany({
            where: {
                userId: uId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        })

        // 2. Get existing logs to avoid duplicates (or we could just skip if exists)
        const existingLogs = await prisma.workLogEntry.findMany({
            where: {
                userId: uId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        })

        const existingDates = new Set(existingLogs.map(l => l.date.toISOString().split('T')[0]))
        let createdCount = 0

        for (const day of schedule) {
            const dateStr = day.date.toISOString().split('T')[0]

            // Skip if log already exists for this day
            if (existingDates.has(dateStr)) continue;

            let description = ""
            let startTime = ""
            let endTime = ""
            let duration = 0
            let project = ""

            switch (day.type) {
                case "SHIFT_1":
                    description = "Praca stacjonarna (Zmiana 1)"
                    startTime = "08:00"
                    endTime = "16:00"
                    duration = 8
                    project = "Biuro"
                    break;
                case "SHIFT_2":
                    description = "Praca stacjonarna (Zmiana 2)"
                    startTime = "11:00"
                    endTime = "19:00"
                    duration = 8
                    project = "Biuro"
                    break;
                case "VACATION":
                    description = "Urlop wypoczynkowy"
                    startTime = "08:00"
                    endTime = "16:00" // Standard 8h for records
                    duration = 8
                    project = "Urlop"
                    break;
                case "SICK":
                    description = "Zwolnienie lekarskie (L4)"
                    startTime = "08:00"
                    endTime = "16:00"
                    duration = 8
                    project = "L4"
                    break;
                case "DUTY":
                    description = "Dyżur domowy"
                    // Duty might be different hours, let's assume weekend standard or user specific.
                    // For now, leave empty times or set standard.
                    startTime = "08:00"
                    endTime = "16:00" // Placeholder
                    duration = 8
                    project = "Dyżur"
                    break;
                default:
                    continue; // Skip OFF or unknown
            }

            await prisma.workLogEntry.create({
                data: {
                    userId: uId,
                    date: day.date,
                    description,
                    project,
                    startTime,
                    endTime,
                    duration,
                    overtime: 0
                }
            })
            createdCount++
        }

        revalidatePath("/dashboard/work-logs")
        return { success: true, count: createdCount }

    } catch (error: any) {
        console.error("Sync error:", error)
        return { error: error.message || "Błąd synchronizacji" }
    }
}

export async function clearWorkLogs(userId: number, year: number, month: number) {
    const session = await getServerSession(authOptions)

    // Allow if Admin OR if user is clearing their own work logs
    const sessionUserId = parseInt(session?.user?.id || "0")
    // Ensure userId is treated as number for comparison
    const targetUserId = parseInt(userId.toString())

    const candelete = session?.user.role === 'ADMIN' || hasPermission(session?.user as any, "manage_work_logs") || sessionUserId === targetUserId

    if (!candelete) {
        return { error: "Brak uprawnień do usuwania karty pracy." }
    }

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    try {
        await prisma.workLogEntry.deleteMany({
            where: {
                userId: targetUserId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        })
        revalidatePath("/dashboard/work-logs")
        return { success: true }
    } catch (error: any) {
        console.error("Clear logs error:", error)
        return { error: "Błąd podczas usuwania karty pracy: " + (error.message || error) }
    }
}

export async function submitWorkLogToManager(userId: number | string, year: number, month: number) {
    const session = await getServerSession(authOptions)

    const targetUserId = parseInt(userId.toString())
    const sessionUserId = parseInt(session?.user?.id || "0")

    if (sessionUserId !== targetUserId && session?.user.role !== 'ADMIN' && !hasPermission(session?.user as any, "manage_work_logs")) {
        return { success: false, error: "Brak uprawnień do zapisu tej karty pracy." }
    }

    try {
        // 1. Dociągnij użytkownika, jego departament i przełożonego
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: { department: true }
        })

        if (!user) {
            return { success: false, error: "Nie znaleziono użytkownika." }
        }

        if (!user.departmentId && !user.secondaryDepartmentId) {
            return { success: false, error: "Użytkownik nie jest przypisany do żadnego działu. Karty pracy nie można wysłać." }
        }

        // Szukaj menadżera dla tego departamentu
        const manager = await prisma.user.findFirst({
            where: {
                role: 'MANAGER',
                OR: [
                    { departmentId: user.departmentId || undefined },
                    { secondaryDepartmentId: user.departmentId || undefined },
                    { departmentId: user.secondaryDepartmentId || undefined },
                    { secondaryDepartmentId: user.secondaryDepartmentId || undefined }
                ]
            }
        })

        if (!manager || !manager.email) {
            return { success: false, error: "W Twoim dziale nie zdefiniowano menadżera (bądź nie ma on przypisanego adresu e-mail). Skontaktuj się z administratorem." }
        }

        // 2. Pobierz wpisy karty pracy
        const logs = await getWorkLogs(targetUserId, year, month)

        if (logs.length === 0) {
            return { success: false, error: "Twoja karta pracy dla tego miesiąca jest pusta." }
        }

        // 3. Generuj Excel-a (Buffer)
        const wb = XLSX.utils.book_new()
        const rows: any[] = []

        rows.push(["HR4YOU", "", "", "KARTA PRACY", "", "", ""])
        rows.push([`Imię i Nazwisko: ${user.name || user.username}`, "", "", "", "", `Miesiąc: ${format(new Date(year, month - 1), "LLLL yyyy", { locale: pl })}`, ""])
        rows.push([""]) // Empty row

        rows.push(["Dzień", "Wykonywane czynności", "", "Czas pracy", "Projekt", "Nadgodziny", "Godziny pracy"])
        rows.push(["", "", "", "Ilość godzin", "", "", "od do"])

        const daysInMonth = new Date(year, month, 0).getDate()
        let totalHours = 0
        let totalOvertime = 0

        for (let day = 1; day <= daysInMonth; day++) {
            const dayLogs = logs.filter((log: any) => new Date(log.date).getDate() === day)

            if (dayLogs.length === 0) {
                rows.push([day, "", "", "", "", ""])
                continue;
            }

            dayLogs.forEach((log: any, index: number) => {
                totalHours += log.duration
                totalOvertime += log.overtime
                rows.push([
                    index === 0 ? day : "",
                    log.description,
                    "",
                    log.duration,
                    log.project,
                    log.overtime > 0 ? log.overtime : "",
                    `${log.startTime}-${log.endTime}`
                ])
            })
        }

        rows.push([""])
        rows.push(["", "", "SUMA", totalHours, "", "Nadgodziny suma", totalOvertime])
        rows.push(["", "", "wg kalendarza", 168, "", "Godziny nocne", ""])

        const ws = XLSX.utils.aoa_to_sheet(rows)
        if (!ws['!merges']) ws['!merges'] = []
        ws['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
            { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } },
            { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
            { s: { r: 3, c: 1 }, e: { r: 4, c: 2 } }
        )

        ws['!cols'] = [
            { wch: 5 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
        ]

        XLSX.utils.book_append_sheet(wb, ws, "Karta Pracy")

        // Zapisz Workbook do Bufora, by mozna bylo go wysłać mailowo
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

        // 4. Wyślij Email
        const mailContent = `
            <h3>Dzień dobry,</h3>
            <p>W systemie HR4YOU wygenerowano nową <strong>Kartę Pracy</strong> oczekującą na Twoją weryfikację.</p>
            <ul>
                <li><strong>Pracownik:</strong> ${user.name || user.username}</li>
                <li><strong>Miesiąc:</strong> ${format(new Date(year, month - 1), "LLLL yyyy", { locale: pl })}</li>
                <li><strong>Zaraportowane godziny:</strong> ${totalHours}</li>
                <li><strong>Zaraportowane nadgodziny:</strong> ${totalOvertime}</li>
            </ul>
            <p>Szczegółowa ewidencja znajduje się w załączniku.</p>
        `

        // Konstrukcja dla NodeMailera
        const attachments = [
            {
                filename: `Karta_Pracy_${user.username}_${year}_${month}.xlsx`,
                content: buffer
            }
        ]

        await sendEmail(manager.email, `Karta Pracy - ${user.name || user.username} (${format(new Date(year, month - 1), "LLLL yyyy", { locale: pl })})`, mailContent, attachments)

        // 5. Wyczyść robocze wpisy karty po pomyślnym przesłaniu
        await clearWorkLogs(targetUserId, year, month)

        return { success: true }
    } catch (error: any) {
        console.error("Submit Worklog Error:", error)
        return { success: false, error: "Błąd podczas składania karty pracy: " + (error.message || error) }
    }
}
