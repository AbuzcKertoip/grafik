"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createLog } from "@/lib/actions/log-actions"
import { hasPermission, isManagerInHRDept } from "@/lib/auth/permissions"
import { sendEmail } from "@/lib/actions/mailer"

export function translateShiftType(type: string): string {
    switch (type) {
        case 'SHIFT_1': return 'Zmiana 1'
        case 'SHIFT_2': return 'Zmiana 2'
        case 'VACATION': return 'Urlop wypoczynkowy'
        case 'ON_DEMAND': return 'Urlop na żądanie'
        case 'SPECIAL_LEAVE': return 'Urlop okolicznościowy'
        case 'CHILDCARE': return 'Opieka nad dzieckiem'
        case 'ADDITIONAL': return 'Urlop dodatkowy'
        case 'SICK': return 'Zwolnienie lekarskie'
        case 'DUTY': return 'Dyżur'
        case 'HOLIDAY': return 'Święto'
        case 'OVERTIME': return 'Odbiór nadgodzin'
        case 'OTHER': return 'Inna nieobecność'
        case 'OFF': 
        case '': 
            return 'Brak dyżuru (WOLNE)'
        default: return type
    }
}

export async function getSchedule(year: number, month: number) {
    const session = await getServerSession(authOptions)
    const { role, departmentId, secondaryDepartmentId } = session?.user as any || {}
    const finalDeptId = departmentId ? parseInt(departmentId.toString()) : null
    const finalSecDeptId = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null

    // Calculate start and end date of the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // last day of month

    const where: any = {
        date: {
            gte: startDate,
            lte: endDate,
        },
    }

    const isGlobalViewer = role === 'ADMIN' || role === 'HR' || role === 'SZEF' || hasPermission(session?.user as any, "view_all_schedules");

    if (isGlobalViewer) {
        // Global viewers see all days for the whole company
    } else if (role === 'USER' && session?.user?.id) {
        // Regular users see the schedule of people in their department(s)
        if (finalDeptId || finalSecDeptId) {
            const userDepts = [];
            if (finalDeptId) userDepts.push(finalDeptId);
            if (finalSecDeptId) userDepts.push(finalSecDeptId);

            where.user = {
                OR: [
                    { departmentId: { in: userDepts } },
                    { secondaryDepartmentId: { in: userDepts } }
                ]
            }
        } else {
            where.userId = parseInt(session.user.id.toString());
        }
    } else if (role === 'MANAGER') {
        // Manager HR widzi cały grafik (jak ADMIN/HR)
        const managerInHR = await isManagerInHRDept(session?.user)
        if (managerInHR) {
            // Global view — no filtering
        } else if (session?.user?.username === 'etomczyk') {
            const hrDept = await prisma.department.findFirst({ where: { name: 'HR' } })
            const bokDept = await prisma.department.findFirst({ where: { name: 'BOK' } })
            const allowedDepts = []
            if (hrDept) allowedDepts.push(hrDept.id)
            if (bokDept) allowedDepts.push(bokDept.id)

            where.user = {
                OR: [
                    { departmentId: { in: allowedDepts } },
                    { secondaryDepartmentId: { in: allowedDepts } }
                ]
            }
        } else if (finalDeptId || finalSecDeptId) {
            // Managers see their whole department and secondary department
            const managerDepts = [];
            if (finalDeptId) managerDepts.push(finalDeptId);
            if (finalSecDeptId) managerDepts.push(finalSecDeptId);

            where.user = {
                OR: [
                    { departmentId: { in: managerDepts } },
                    { secondaryDepartmentId: { in: managerDepts } }
                ]
            }
        }
    }

    const schedule = await prisma.scheduleDay.findMany({
        where,
        include: { user: true } // Include user to check correctness if needed, or just standard return
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

export async function generateSchedule(year: number, month: number, targetDepartmentId?: number) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SZEF' && session.user.role !== 'MANAGER' && !hasPermission(session.user as any, "generate_schedule"))) {
        return { error: "Brak uprawnień do generowania grafiku." }
    }

    const { role, departmentId } = session.user;
    const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;

    let finalDepartmentId = targetDepartmentId;
    if (role === 'MANAGER') {
        // Manager HR ma globalny dostęp do generowania grafiku
        const managerInHR = await isManagerInHRDept(session.user)
        if (managerInHR) {
            // HR Manager can generate for any department
            finalDepartmentId = targetDepartmentId;
        } else {
            // Obliczamy do jakiego działu manager ma dostęp na podstawie requestu i swoich uprawnień
            const deptIdInt = departmentId ? parseInt(departmentId.toString()) : null;
            const secDeptIdInt = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null;

            if (targetDepartmentId && (targetDepartmentId === deptIdInt || targetDepartmentId === secDeptIdInt)) {
                finalDepartmentId = targetDepartmentId;
            } else if (!targetDepartmentId) {
               finalDepartmentId = deptIdInt || undefined; 
            } else {
                 finalDepartmentId = undefined; // Manager próbujący wygenerować dla obcego działu bez uprawnień zarządzania globalnego
            }
        }
    }

    if (!finalDepartmentId) {
        return { error: "Proszę wybrać dział, dla którego chcesz wygenerować grafik." }
    }

    const targetDept = await prisma.department.findUnique({
        where: { id: finalDepartmentId }
    })
    const hasDuties = targetDept?.hasDuties ?? false

    // 1. Get users based on role
    const usersWhere: any = { 
        OR: [
             { departmentId: finalDepartmentId },
             { secondaryDepartmentId: finalDepartmentId }
        ]
    };

    const usersRaw = await (prisma as any).user.findMany({
        where: usersWhere,
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

    const scheduleData: {userId: number, date: Date, type: string}[] = []

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
    if (hasDuties && targetMonthEnd >= dutySimStart) {
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
        const currentYearHolidays = getPolishHolidays(currentDate.getFullYear())
        const isHol = isHoliday(currentDate, currentYearHolidays)
        const dayOfWeek = currentDate.getDay()
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
        const weekKey = getWeekKey(currentDate)
        const shift2UserIds = weeklyShiftAssignments.get(weekKey) || []

        // Assign for each user
        users.forEach(user => {
            // Priority 1: Vacation
            if (isOnVacation(user.id, currentDate)) {
                scheduleData.push({ userId: user.id, date: currentDate, type: "VACATION" })
                return
            }

            // Priority 2: Duty Assignment
            if (dutyAssignments.get(dateStr) === user.id) {
                scheduleData.push({ userId: user.id, date: currentDate, type: "DUTY" })
                return
            }

            // Priority 3: Holiday
            if (isHol && isWeekday) {
                scheduleData.push({ userId: user.id, date: currentDate, type: "HOLIDAY" })
                return
            }

            // Priority 4: Regular Workday
            if (isWeekday && !isHol) {
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
            }
        })
    }

    // 5. Save: Delete ONLY the days matching the generated users instead of whole company
    const targetUserIds = users.map(u => u.id);

    await prisma.scheduleDay.deleteMany({
        where: {
            date: { gte: targetMonthStart, lte: targetMonthEnd },
            userId: { in: targetUserIds }
        }
    })

    for (const day of scheduleData) {
        await prisma.scheduleDay.create({ data: day })
    }

    await createLog({
        action: "GENERATE_SCHEDULE",
        description: `Wygenerowano grafik dla działu ID: ${finalDepartmentId} (${year}-${month})`,
        userId: session.user.id ? parseInt(session.user.id) : undefined,
        errorCodeKey: "SCHEDULE_MODIFIED",
        details: { year, month, departmentId: finalDepartmentId }
    });

    revalidatePath("/dashboard/schedule")
    return { success: true }
}

export async function upsertShift(userId: number, year: number, month: number, day: number, type: string) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return { error: "Brak autoryzacji" }
        }

        const { role, departmentId } = session.user
        const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;
        const deptIdInt = departmentId ? parseInt(departmentId.toString()) : null;
        const secDeptIdInt = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null;

        if (role !== 'ADMIN' && role !== 'SZEF' && role !== 'MANAGER' && !hasPermission(session.user as any, "edit_schedule_dept") && !hasPermission(session.user as any, "edit_schedule_all")) {
            return { error: "Brak uprawnień do edycji grafiku" }
        }

        // ADMIN, SZEF, and Manager HR have global edit access
        const managerInHR = role === 'MANAGER' ? await isManagerInHRDept(session.user) : false
        const hasGlobalAccess = role === 'ADMIN' || role === 'SZEF' || managerInHR || hasPermission(session.user as any, "edit_schedule_all")

        if (!hasGlobalAccess) {
            if (hasPermission(session.user as any, "edit_schedule_dept") || role === 'MANAGER') {
                const targetUser = await prisma.user.findUnique({ where: { id: userId } })
                if (!targetUser || (targetUser.departmentId !== deptIdInt && targetUser.secondaryDepartmentId !== secDeptIdInt && targetUser.departmentId !== secDeptIdInt && targetUser.secondaryDepartmentId !== deptIdInt)) {
                    return { error: "Możesz edytować tylko pracowników swojego działu" }
                }
            }
        }

        const startOfDay = new Date(year, month - 1, day, 0, 0, 0)
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)

        // Identify if this is a leave type
        const leaveTypes = ['VACATION', 'ON_DEMAND', 'SPECIAL_LEAVE', 'CHILDCARE', 'ADDITIONAL', 'SICK', 'OTHER', 'OVERTIME']
        const isLeave = leaveTypes.includes(type)

        // Remove any existing shifts in that specific day bracket to prevent timezone-duplicate bugs
        await prisma.scheduleDay.deleteMany({
            where: {
                userId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                },
            },
        })

        if (type !== 'OFF' && type !== '') {
            const date = new Date(year, month - 1, day)
            let vacationId: number | undefined = undefined

            if (isLeave) {
                // Create a 1-day Vacation record for history/stats
                const vac = await prisma.vacation.create({
                    data: {
                        userId,
                        startDate: date,
                        endDate: date,
                        type: type as any,
                        status: 'APPROVED',
                        note: "Wpis ręczny z grafiku"
                    }
                })
                vacationId = vac.id
            }

            await prisma.scheduleDay.create({
                data: {
                    userId,
                    date,
                    type,
                    vacationId
                },
            })
        }

        // Email Notification
        try {
            const targetUserForMail = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, username: true } })
            if (targetUserForMail?.email) {
                const dateStr = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`
                const typeStr = translateShiftType(type)
                const mailHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #4f46e5; margin-top: 0;">Zmiana w Twoim grafiku</h2>
                        <p>Cześć ${targetUserForMail.name || targetUserForMail.username},</p>
                        <p>Twój grafik na dzień <strong>${dateStr}</strong> został zmodyfikowany przez przełożonego/HR.</p>
                        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px;">Nowy status dyżuru: <strong style="color: #111827;">${typeStr}</strong></p>
                        </div>
                        <p style="color: #6b7280; font-size: 14px;">Zaloguj się do systemu HR4YOU, aby zobaczyć aktualny grafik.</p>
                    </div>
                `
                await sendEmail(targetUserForMail.email, "HR4YOU - Zmiana w grafiku", mailHtml).catch(e => console.error("Email failed", e))
            }
        } catch (mailErr) {
            console.error("Failed to send schedule update email:", mailErr)
        }

        await createLog({
            action: "UPSERT_SHIFT",
            description: `Zmieniono dyżur (Dzień: ${day}.${month}.${year}, Typ: ${type}) dla pracownika ID: ${userId}`,
            userId: session.user.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "SHIFT_ADDED",
            details: { targetUserId: userId, date: `${year}-${month}-${day}`, type }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Failed to save shift" }
    }
}

export async function upsertShifts(shifts: { userId: number, year: number, month: number, day: number, type: string }[]) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user) return { error: "Brak autoryzacji" }

        const { role, departmentId } = session.user
        const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;
        const deptIdInt = departmentId ? parseInt(departmentId.toString()) : null;
        const secDeptIdInt = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null;

        if (role !== 'ADMIN' && role !== 'SZEF' && role !== 'MANAGER' && !hasPermission(session.user as any, "edit_schedule_dept") && !hasPermission(session.user as any, "edit_schedule_all")) {
            return { error: "Brak uprawnień do edycji grafiku" }
        }

        // ADMIN, SZEF, and Manager HR have global edit access
        const managerInHR = role === 'MANAGER' ? await isManagerInHRDept(session.user) : false
        const hasGlobalAccess = role === 'ADMIN' || role === 'SZEF' || managerInHR || hasPermission(session.user as any, "edit_schedule_all")

        // Simplify permission check for batch by checking all involved users upfront.
        const reqUserIds = Array.from(new Set(shifts.map(s => s.userId)))
        if (!hasGlobalAccess) {
            const targetUsers = await prisma.user.findMany({ where: { id: { in: reqUserIds } } })
            for (const tu of targetUsers) {
                if (tu.departmentId !== deptIdInt && tu.secondaryDepartmentId !== secDeptIdInt && tu.departmentId !== secDeptIdInt && tu.secondaryDepartmentId !== deptIdInt) {
                    return { error: "Możesz edytować tylko pracowników swojego działu" }
                }
            }
        }

        const leaveTypes = ['VACATION', 'ON_DEMAND', 'SPECIAL_LEAVE', 'CHILDCARE', 'ADDITIONAL', 'SICK', 'OTHER', 'OVERTIME']

        await prisma.$transaction(async (tx) => {
            // Group shifts by userId
            const userShiftsMap: Record<number, typeof shifts> = {}
            for (const s of shifts) {
                if (!userShiftsMap[s.userId]) userShiftsMap[s.userId] = []
                userShiftsMap[s.userId].push(s)
            }

            for (const userIdStr in userShiftsMap) {
                const userId = parseInt(userIdStr)
                const uShifts = userShiftsMap[userId].sort((a,b) => {
                    const dateA = new Date(a.year, a.month-1, a.day).getTime()
                    const dateB = new Date(b.year, b.month-1, b.day).getTime()
                    return dateA - dateB
                })

                // Group contiguous shifts of the same type
                const groups: (typeof shifts)[] = []
                if (uShifts.length > 0) {
                    let currentGroup = [uShifts[0]]
                    for (let i = 1; i < uShifts.length; i++) {
                        const prev = uShifts[i-1]
                        const curr = uShifts[i]
                        const prevDate = new Date(prev.year, prev.month-1, prev.day)
                        const currDate = new Date(curr.year, curr.month-1, curr.day)
                        
                        // Check if contiguous (exactly 1 day difference) and same type
                        const diffTime = currDate.getTime() - prevDate.getTime()
                        const diffDays = diffTime / (1000 * 60 * 60 * 24)
                        
                        if (diffDays === 1 && curr.type === prev.type) {
                            currentGroup.push(curr)
                        } else {
                            groups.push(currentGroup)
                            currentGroup = [curr]
                        }
                    }
                    groups.push(currentGroup)
                }

                for (const group of groups) {
                    const first = group[0]
                    const last = group[group.length - 1]
                    const isLeave = leaveTypes.includes(first.type)
                    
                    // Delete all days in the group first
                    for (const s of group) {
                        const startOfDay = new Date(s.year, s.month - 1, s.day, 0, 0, 0)
                        const endOfDay = new Date(s.year, s.month - 1, s.day, 23, 59, 59, 999)
                        await tx.scheduleDay.deleteMany({
                            where: { userId: s.userId, date: { gte: startOfDay, lte: endOfDay } }
                        })
                    }

                    if (first.type !== 'OFF' && first.type !== '') {
                        let vacationId: number | undefined = undefined

                        if (isLeave) {
                            const startDate = new Date(first.year, first.month - 1, first.day)
                            const endDate = new Date(last.year, last.month - 1, last.day)
                            const vac = await tx.vacation.create({
                                data: {
                                    userId: userId,
                                    startDate,
                                    endDate,
                                    type: first.type as any,
                                    status: 'APPROVED',
                                    note: `Wpis ręczny z grafiku (zakres ${group.length} dni)`
                                }
                            })
                            vacationId = vac.id
                        }

                        for (const s of group) {
                            await tx.scheduleDay.create({
                                data: {
                                    userId: s.userId,
                                    date: new Date(s.year, s.month - 1, s.day),
                                    type: s.type,
                                    vacationId
                                }
                            })
                        }
                    }
                }
            }
        })

        // Email Notification for Bulk Update
        try {
            const shiftsByUser: Record<number, typeof shifts> = {}
            for (const s of shifts) {
                if (!shiftsByUser[s.userId]) shiftsByUser[s.userId] = []
                shiftsByUser[s.userId].push(s)
            }

            for (const userIdStr in shiftsByUser) {
                const userId = parseInt(userIdStr)
                const userShifts = shiftsByUser[userId].sort((a,b) => {
                    const dateA = new Date(a.year, a.month-1, a.day).getTime()
                    const dateB = new Date(b.year, b.month-1, b.day).getTime()
                    return dateA - dateB
                })

                const targetUserForMail = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, username: true } })
                if (targetUserForMail?.email) {
                    let shiftsHtmlList = ''
                    for (const s of userShifts) {
                        const dateStr = `${s.day.toString().padStart(2, '0')}.${s.month.toString().padStart(2, '0')}.${s.year}`
                        const typeStr = translateShiftType(s.type)
                        shiftsHtmlList += `<li style="margin-bottom: 8px;"><strong>${dateStr}</strong>: ${typeStr}</li>`
                    }

                    const mailHtml = `
                        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #4f46e5; margin-top: 0;">Zmiany w Twoim grafiku</h2>
                            <p>Cześć ${targetUserForMail.name || targetUserForMail.username},</p>
                            <p>W Twoim grafiku wprowadzono nowe zmiany (przez przełożonego lub HR). Poniżej znajduje się zestawienie:</p>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                                <ul style="margin: 0; padding-left: 20px; color: #111827;">
                                    ${shiftsHtmlList}
                                </ul>
                            </div>
                            <p style="color: #6b7280; font-size: 14px;">Zaloguj się do systemu HR4YOU, aby zobaczyć aktualny grafik.</p>
                        </div>
                    `
                    await sendEmail(targetUserForMail.email, "HR4YOU - Zmiany w grafiku", mailHtml).catch(e => console.error("Email failed", e))
                }
            }
        } catch (mailErr) {
            console.error("Failed to send bulk schedule update emails:", mailErr)
        }

        await createLog({
            action: "UPSERT_SHIFTS_BULK",
            description: `Zaktualizowano hurtowo ${shifts.length} zmian w grafiku`,
            userId: session.user.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "SHIFT_ADDED",
            details: { modifiedCount: shifts.length }
        })
        
        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Failed to bulk save shifts" }
    }
}

export async function clearSchedule(year: number, month: number, targetDepartmentId?: number) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SZEF' && session.user.role !== 'MANAGER' && !hasPermission(session.user as any, "clear_schedule"))) {
        return { error: "Brak uprawnień do usuwania grafiku." }
    }

    const { role, departmentId } = session.user;
    const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;

    let finalDepartmentId = targetDepartmentId;
    if (role === 'MANAGER') {
        // Manager HR ma globalny dostęp
        const managerInHR = await isManagerInHRDept(session.user)
        if (managerInHR) {
            finalDepartmentId = targetDepartmentId;
        } else {
            const deptIdInt = departmentId ? parseInt(departmentId.toString()) : null;
            const secDeptIdInt = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null;

            if (targetDepartmentId && (targetDepartmentId === deptIdInt || targetDepartmentId === secDeptIdInt)) {
                finalDepartmentId = targetDepartmentId;
            } else if (!targetDepartmentId) {
               finalDepartmentId = deptIdInt || undefined; 
            } else {
                 finalDepartmentId = undefined; // Deny access
            }
        }
    }

    if (!finalDepartmentId) {
        return { error: "Proszę wybrać dział, dla którego chcesz usunąć grafik." }
    }

    // Calculate start and end date of the month
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // last day of month

    const deptUsers = await prisma.user.findMany({
        where: { 
            OR: [
                { departmentId: finalDepartmentId },
                { secondaryDepartmentId: finalDepartmentId }
            ]
        },
        select: { id: true }
    })

    if (deptUsers.length === 0) {
        return { error: "Brak użytkowników w wybranym dziale." }
    }

    const where: any = {
        date: {
            gte: startDate,
            lte: endDate,
        },
        userId: { in: deptUsers.map(u => u.id) }
    }

    try {
        const deleted = await prisma.scheduleDay.deleteMany({
            where
        })

        await createLog({
            action: "CLEAR_SCHEDULE",
            description: `Wyczyszczono grafik działu ID: ${finalDepartmentId} (${year}-${month}). Usunięto ${deleted.count} wpisów.`,
            userId: parseInt(session.user.id),
            errorCodeKey: "SCHEDULE_MODIFIED",
            details: { year, month, departmentId: finalDepartmentId, deletedCount: deleted.count }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd podczas usuwania grafiku." }
    }
}
