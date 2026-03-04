"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/actions/mailer"
import { createLog } from "@/lib/actions/log-actions"

export async function getVacations(year: number) {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    return await prisma.vacation.findMany({
        where: {
            startDate: {
                gte: startDate,
            },
            endDate: {
                lte: endDate,
            },
        },
        include: {
            user: true,
        },
        orderBy: {
            startDate: "asc",
        },
    })
}

import { getVacationStats } from "./hr"
import { getBusinessDaysCount } from "../holidays"

async function validateVacationLimit(userId: number, startDate: Date, endDate: Date, excludeVacationId?: number) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const year = start.getFullYear()

    if (start.getFullYear() !== end.getFullYear()) {
        return { valid: false, error: "Wniosek nie może przekraczać roku kalendarzowego. Złóż dwa osobne wnioski." }
    }

    // Oblicz liczbę dni wniosku (uproszczone: wszystkie dni, wliczając weekendy jeśli tak liczy system, 
    // lub tylko robocze. Biorąc pod uwagę obecny model, ScheduleDay generuje się dla każdego dnia.
    // Skoro limit jest w dniach "roboczych", powinniśmy liczyć realnie dni robocze, 
    // ale zachowajmy konsekwencję. Najprościej policzyć po prostu dni różnicy, jeśli tak robiliśmy.
    // Assuming 1 day = 1 unit of limit for simplicity here, or you can implement a business days logic.
    const daysRequested = getBusinessDaysCount(start, end)

    const stats = await getVacationStats(userId, year)

    // Policz oczekujące wnioski z tego roku (z wyłączeniem obecnego jeśli to edycja/akceptacja)
    const pendingVacations = await prisma.vacation.findMany({
        where: {
            userId: userId,
            status: "PENDING",
            startDate: { gte: new Date(year, 0, 1) },
            endDate: { lte: new Date(year, 11, 31) },
            ...(excludeVacationId ? { id: { not: excludeVacationId } } : {})
        }
    })

    const pendingDays = pendingVacations.reduce((acc, vac) => {
        return acc + getBusinessDaysCount(new Date(vac.startDate), new Date(vac.endDate))
    }, 0)

    const totalNeeded = stats.used + pendingDays + daysRequested

    if (totalNeeded > stats.limit) {
        return {
            valid: false,
            error: `Wykorzystano limit. Przewidywane użycie: ${totalNeeded} dni, Limit: ${stats.limit} dni.`
        }
    }

    return { valid: true }
}

export async function createVacation(data: any) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    const { userId, startDate, endDate, type } = data
    const isAdmin = session.user.role === 'ADMIN'
    const isSelf = parseInt(session.user.id) === parseInt(userId)

    if (!isAdmin && !isSelf) return { error: "Możesz składać wnioski tylko za siebie." }

    // If Admin -> Approved immediately. If User -> Pending
    const approved = isAdmin

    const validation = await validateVacationLimit(parseInt(userId), new Date(startDate), new Date(endDate))
    if (!validation.valid) {
        return { error: validation.error }
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Create Vacation Record
            await tx.vacation.create({
                data: {
                    userId: parseInt(userId),
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    type: type || "VACATION",
                    status: isAdmin ? "APPROVED" : "PENDING"
                },
            })

            // 2. Sync with ScheduleDay ONLY IF APPROVED
            if (approved) {
                const start = new Date(startDate)
                const end = new Date(endDate)
                const vacationType = type || "VACATION"

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    // Pomiń weekendy - nie liczymy ich jako dni urlopowe
                    if (d.getDay() === 0 || d.getDay() === 6) continue

                    await tx.scheduleDay.upsert({
                        where: {
                            userId_date: {
                                userId: parseInt(userId),
                                date: d,
                            }
                        },
                        update: {
                            type: vacationType
                        },
                        create: {
                            userId: parseInt(userId),
                            date: d,
                            type: vacationType
                        }
                    })
                }
            }
        })

        // Wysyłka emaila do kierownika
        if (!isAdmin) {
            const user = await prisma.user.findUnique({
                where: { id: parseInt(userId) },
                include: { department: true }
            })

            if (user && user.departmentId) {
                const manager = await prisma.user.findFirst({
                    where: {
                        role: "MANAGER",
                        departmentId: user.departmentId
                    }
                })

                if (manager && manager.email) {
                    const mailHtml = `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2>Nowy wniosek urlopowy oczekuje!</h2>
                        <p>Pracownik <b>${user.name || user.username}</b> złożył nowy wniosek (typ: ${type || 'VACATION'}).</p>
                        <p>Termin: od ${startDate.toISOString().split('T')[0]} do ${endDate.toISOString().split('T')[0]}</p>
                        <p>Zaloguj się do systemu HR4YOU, by zatwierdzić lub odrzucić.</p>
                    </div>
                    `
                    await sendEmail(manager.email, "Nowy wniosek urlopowy do akceptacji", mailHtml).catch(e => console.error("Email failed", e))
                }
            }
        }
        await createLog({
            action: "VACATION_REQUESTED",
            description: `Wniosek urlopowy (${type || 'VACATION'}) złożony: od ${startDate} do ${endDate}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_REQUESTED",
            details: { targetUserId: userId, startDate, endDate, status: approved ? "APPROVED" : "PENDING" }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true, approved }
    } catch (error) {
        console.error("Error creating vacation:", error)
        return { error: "Błąd podczas dodawania urlopu." }
    }
}

export async function approveVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
        return { error: "Brak uprawnień" }
    }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })
        if (!vacation) return { error: "Wniosek nie istnieje" }

        // Manger restriction
        if (session.user.role === 'MANAGER') {
            if (vacation.user.departmentId !== session.user.departmentId) {
                return { error: "Możesz akceptować urlopy tylko we własnym dziale." }
            }
        }

        const validation = await validateVacationLimit(vacation.userId, new Date(vacation.startDate), new Date(vacation.endDate), vacation.id)
        if (!validation.valid) {
            return { error: "Zatwierdzenie zablokowane: " + validation.error }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Approve
            await tx.vacation.update({
                where: { id },
                data: { status: "APPROVED" }
            })

            // 2. Sync
            const start = new Date(vacation.startDate)
            const end = new Date(vacation.endDate)
            const vacationType = vacation.type

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                // Pomiń weekendy - nie liczymy ich jako dni urlopowe
                if (d.getDay() === 0 || d.getDay() === 6) continue

                await tx.scheduleDay.upsert({
                    where: {
                        userId_date: {
                            userId: vacation.userId,
                            date: d,
                        }
                    },
                    update: { type: vacationType },
                    create: {
                        userId: vacation.userId,
                        date: d,
                        type: vacationType
                    }
                })
            }
        })

        if (vacation.user.email) {
            const mailHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #10b981;">Twój wniosek urlopowy został zatwierdzony!</h2>
                <p>Termin: od ${format(new Date(vacation.startDate), "d-MM-yyyy")} do ${format(new Date(vacation.endDate), "d-MM-yyyy")}</p>
                <p>Możesz już zobaczyć zmiany w grafiku systemu.</p>
            </div>
            `
            await sendEmail(vacation.user.email, "Wniosek urlopowy zaakceptowany", mailHtml).catch(e => console.error(e))
        }
        await createLog({
            action: "VACATION_APPROVED",
            description: `Zatwierdzono urlop (ID: ${vacation.id}) dla pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_APPROVED",
            details: { vacationId: id, targetUserId: vacation.userId }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd zatwierdzania wniosku" }
    }
}

import { format } from "date-fns" // Dodałem dla approve emaila

export async function rejectVacation(id: number, reason: string) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
        return { error: "Brak uprawnień" }
    }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!vacation) return { error: "Wniosek nie istnieje" }

        if (session.user.role === 'MANAGER' && vacation.user.departmentId !== session.user.departmentId) {
            return { error: "Brak dostępu do pracownika z innego działu" }
        }

        await prisma.vacation.update({
            where: { id },
            data: {
                status: "REJECTED",
                rejectReason: reason
            }
        })

        if (vacation.user.email) {
            const mailHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #ef4444;">Twój wniosek urlopowy został odrzucony</h2>
                <p>Termin: od ${format(new Date(vacation.startDate), "d-MM-yyyy")} do ${format(new Date(vacation.endDate), "d-MM-yyyy")}</p>
                <p><b>Powód odrzucenia:</b></p>
                <blockquote style="border-left: 4px solid #ef4444; padding-left: 10px; font-style: italic;">
                    ${reason}
                </blockquote>
                <p>Jeśli masz pytania, skontaktuj się ze swoim kierownikiem.</p>
            </div>
            `
            await sendEmail(vacation.user.email, "Odrzucenie wniosku urlopowego", mailHtml).catch(e => console.error(e))
        }
        await createLog({
            action: "VACATION_REJECTED",
            description: `Odrzucono urlop (ID: ${vacation.id}) dla pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_REJECTED",
            details: { vacationId: id, targetUserId: vacation.userId, reason }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        return { error: "Błąd z zapisem odrzucenia wniosku." }
    }
}

export async function deleteVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    try {
        // Optionally add permissions check: Admin or Own
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })
        if (!vacation) return { error: "Nie znaleziono" }

        const isAdmin = session.user.role === 'ADMIN'
        const isManager = session.user.role === 'MANAGER'
        const isSelf = parseInt(session.user.id) === vacation.userId
        const isManagersEmployee = isManager && (vacation.user.departmentId === session.user.departmentId)

        if (!isAdmin && !isSelf && !isManagersEmployee) {
            return { error: "Brak uprawnień" }
        }
        // Users can only delete their own if PENDING (approved should be immutable for users?)
        // Let's allow users to delete approved too for now or block it?
        // Usually, if approved, they can't delete. But let's keep it simple for now as requested.

        await prisma.vacation.delete({
            where: { id },
        })
        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd podczas usuwania urlopu." }
    }
}
