"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

export async function getSchedule(year: number, month: number) {
    // Calculate start and end date of the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // last day of month

    const schedule = await prisma.scheduleDay.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
    })

    return schedule
}

// ... existing imports
import { getPolishHolidays, isHoliday } from "../holidays"

// Manual type definition to fix Prisma inference issues in this context
interface UserWithSettings {
    id: number;
    username: string;
    name: string | null;
    sortOrder: number;
    skipDuties: boolean;
    fixedShift: string | null;
    role: string;
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function generateSchedule(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień do generowania grafiku." }

    // 1. Get all users sorted by preference
    const usersRaw = await (prisma as any).user.findMany({
        orderBy: { sortOrder: "asc" },
    })
    const users = usersRaw as unknown as UserWithSettings[]

    if (users.length === 0) return { error: "Brak użytkowników do generowania grafiku." }

    // 2. Get vacations for this month (and covering simulation period roughly)
    // We need vacations for checking availability during simulation.
    // Fetching ALL vacations might be heavy but safe for small team. 
    // Let's fetch vacations from 2026-01-01 to target month end.
    const simulationStart = new Date(2026, 0, 1) // Jan 1 2026
    const targetMonthStart = new Date(year, month - 1, 1)
    const targetMonthEnd = new Date(year, month, 0)
    const daysInMonth = targetMonthEnd.getDate()

    const vacations = await (prisma as any).vacation.findMany({
        where: {
            startDate: { lte: targetMonthEnd },
            endDate: { gte: simulationStart },
        },
    })

    // Get holidays for the year (and simulation years if needed, assuming current year mostly)
    const holidays = getPolishHolidays(year) // This might change if simulation spans years

    const scheduleData = []

    // Helper to check if user is on vacation
    const isOnVacation = (userId: number, date: Date) => {
        return vacations.some((v: any) =>
            v.userId === userId &&
            date >= v.startDate &&
            date <= v.endDate
        )
    }

    // --- 1. Weekend Logic (Simulation) ---
    // Anchor: Brunon Socha (Feb 14, 2026)
    // We reuse the previous logic but ensure it runs far enough.
    const dutyAssignments = new Map<string, number>() // dateStr -> userId
    const dutyUsers = users.filter(u => !u.skipDuties)
    const anchorUser = users.find(u => u.name?.includes("Brunon") || u.username?.includes("Brunon")) || users[0]

    // Start simulation for duties from Feb 14, 2026
    const dutySimStart = new Date(2026, 1, 14)
    let dutySimCurrent = new Date(dutySimStart)

    // Find initial index
    let dutyUserIndex = dutyUsers.findIndex(u => u.id === anchorUser.id)
    if (dutyUserIndex === -1) dutyUserIndex = 0

    // We must ensure we cover the target month.
    // If target month is BEFORE anchor, this simulation won't work backwards.
    // Assuming target is >= Feb 2026.

    // Optimization: If target is far in future, simple loop is fine (JS is fast).
    if (targetMonthEnd >= dutySimStart) {
        while (dutySimCurrent <= targetMonthEnd) {
            const currentYear = dutySimCurrent.getFullYear()
            const currentHolidays = getPolishHolidays(currentYear)
            const isHol = isHoliday(dutySimCurrent, currentHolidays)
            const dayOfWeek = dutySimCurrent.getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            const isDutyDay = isWeekend || isHol

            if (isDutyDay) {
                // Found start of a duty block. Find its end.
                const blockDates: Date[] = []
                let lookAhead = new Date(dutySimCurrent)

                while (true) {
                    const laYear = lookAhead.getFullYear()
                    // Optimize: only fetch if year changes, but getPolishHolidays is fast enough usually
                    const laHolidays = getPolishHolidays(laYear)
                    const laIsHol = isHoliday(lookAhead, laHolidays)
                    const laDay = lookAhead.getDay()
                    const laIsWeekend = laDay === 0 || laDay === 6

                    if (!laIsWeekend && !laIsHol) break;

                    blockDates.push(new Date(lookAhead))
                    lookAhead.setDate(lookAhead.getDate() + 1)
                }

                // Try to assign the whole block to one user
                let attempts = 0
                let assigned = false

                while (attempts < dutyUsers.length) {
                    const candidate = dutyUsers[dutyUserIndex]

                    // Check availability for ALL days in the block
                    let isBusy = false
                    for (const date of blockDates) {
                        if (isOnVacation(candidate.id, date)) {
                            isBusy = true
                            break
                        }
                    }

                    if (!isBusy) {
                        // Assign all days
                        for (const date of blockDates) {
                            const dateStr = date.toISOString().split('T')[0]
                            dutyAssignments.set(dateStr, candidate.id)
                        }

                        // Move to next user in rotation
                        dutyUserIndex = (dutyUserIndex + 1) % dutyUsers.length
                        assigned = true
                        break
                    }

                    // Try next user
                    dutyUserIndex = (dutyUserIndex + 1) % dutyUsers.length
                    attempts++
                }

                // Advance main loop to the first non-duty day
                dutySimCurrent = new Date(lookAhead)
            } else {
                // Weekday, non-holiday
                dutySimCurrent.setDate(dutySimCurrent.getDate() + 1)
            }
        }
    }

    // --- 2. Weekly Shift Logic (Shift 2) ---
    // Start simulation from Jan 5, 2026 (Monday)
    // Rotation: All users (unless fixed shift prevents it?)
    // If user has fixedShift === 'SHIFT_1', they should probably be skipped for SHIFT_2?
    // Let's assume users without fixedShift are available for rotation.

    // Fix: We need to import startOfISOWeek or just manually set to Mon Jan 5.
    const shiftSimStart = new Date(2026, 0, 5) // Mon Jan 05 2026
    let shiftSimCurrent = new Date(shiftSimStart)

    const shiftUsers = users.filter(u => !u.fixedShift) // Only those without fixed assignment
    let shiftUserIndex = 0 // Start from first user in list

    const weeklyShiftAssignments = new Map<string, number[]>() // "YYYY-Www" -> userId[]

    // Helper for ISO Week key
    const getWeekKey = (d: Date) => {
        // Simple distinct key: Monday of the week
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
        const mond = new Date(d)
        mond.setDate(diff)
        return mond.toISOString().split('T')[0]
    }

    if (targetMonthEnd >= shiftSimStart && shiftUsers.length > 0) {
        // Iterate week by week
        while (shiftSimCurrent <= targetMonthEnd) {
            // This loop steps by 7 days
            const weekKey = getWeekKey(shiftSimCurrent)

            const assignedForWeek: number[] = []
            const targetCount = 2 // We want 2 people specific request

            // Try to find N users
            // Safety: limited by number of users to avoid infinite loop if no one is avail
            let examinedCount = 0

            while (assignedForWeek.length < targetCount && examinedCount < shiftUsers.length * 2) {
                const candidate = shiftUsers[shiftUserIndex]

                // Check Mon-Fri availability
                let isBusy = false
                for (let i = 0; i < 5; i++) {
                    const d = new Date(shiftSimCurrent)
                    d.setDate(d.getDate() + i)
                    if (isOnVacation(candidate.id, d)) {
                        isBusy = true;
                        break;
                    }
                }

                // Also check if already assigned this week (unlikely with simple rotation but good practice if list is small)
                const alreadyAssigned = assignedForWeek.includes(candidate.id)

                if (!isBusy && !alreadyAssigned) {
                    assignedForWeek.push(candidate.id)
                }

                // Move to next user in rotation regardless of assignment (strictly sequential check)
                // OR: only move if assigned? 
                // Better: Move to next user always to keep checking. 
                // IF we want "Next 2 available people", we just keep incrementing index.
                shiftUserIndex = (shiftUserIndex + 1) % shiftUsers.length
                examinedCount++
            }

            weeklyShiftAssignments.set(weekKey, assignedForWeek)

            // Next week
            shiftSimCurrent.setDate(shiftSimCurrent.getDate() + 7)
        }
    }


    // --- 3. Generate Target Month ---
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day)
        const dateStr = currentDate.toISOString().split('T')[0]

        // A. Check Duty
        if (dutyAssignments.has(dateStr)) {
            scheduleData.push({
                userId: dutyAssignments.get(dateStr)!,
                date: currentDate,
                type: "DUTY"
            })
            continue
        }

        // B. Weekday Logic (Mon-Fri)
        const dayOfWeek = currentDate.getDay()
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
        const currentYearHolidays = getPolishHolidays(currentDate.getFullYear())
        const isHol = isHoliday(currentDate, currentYearHolidays)

        if (isWeekday && !isHol) {
            const weekKey = getWeekKey(currentDate)
            const shift2UserIds = weeklyShiftAssignments.get(weekKey) || []

            // Assign for each user
            users.forEach(user => {
                if (isOnVacation(user.id, currentDate)) {
                    scheduleData.push({ userId: user.id, date: currentDate, type: "VACATION" })
                    return
                }

                if (user.fixedShift) {
                    scheduleData.push({ userId: user.id, date: currentDate, type: user.fixedShift })
                    return
                }

                // If this is one of the chosen ones for Shift 2
                if (shift2UserIds.includes(user.id)) {
                    scheduleData.push({ userId: user.id, date: currentDate, type: "SHIFT_2" })
                } else {
                    scheduleData.push({ userId: user.id, date: currentDate, type: "SHIFT_1" })
                }
            })
        }
        else {
            // Should be covered by Duty/Holiday logic, but if simulation didn't catch it (e.g. past history), handle gracefully
            // or if it's a weekend/holiday that wasn't assigned (e.g. no users available?)
            // Just skip or fallback.
        }
    }

    // 5. Save
    await prisma.scheduleDay.deleteMany({
        where: { date: { gte: targetMonthStart, lte: targetMonthEnd } }
    })

    for (const day of scheduleData) {
        await prisma.scheduleDay.create({ data: day })
    }

    revalidatePath("/dashboard/schedule")
    return { success: true }
}

export async function upsertShift(userId: number, dateStr: string, type: string) {
    const date = new Date(dateStr)

    try {
        if (type === 'OFF' || type === '') {
            // Remove if setting to empty/off
            await prisma.scheduleDay.deleteMany({
                where: {
                    userId,
                    date,
                },
            })
        } else {
            // Check if user is on vacation? Maybe allow override? 
            // Allow override manually.
            await prisma.scheduleDay.upsert({
                where: {
                    userId_date: {
                        userId,
                        date,
                    },
                },
                update: { type },
                create: {
                    userId,
                    date,
                    type,
                },
            })
        }

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Failed to save shift" }
    }
}

export async function clearSchedule(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień do usuwania grafiku." }

    // Calculate start and end date of the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // last day of month

    try {
        await prisma.scheduleDay.deleteMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        })
        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd podczas usuwania grafiku." }
    }
}
