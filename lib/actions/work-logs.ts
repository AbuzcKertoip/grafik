"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

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

    const candelete = session?.user.role === 'ADMIN' || sessionUserId === targetUserId

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
