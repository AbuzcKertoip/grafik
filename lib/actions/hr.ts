"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission } from "@/lib/auth/permissions"
import { getSaturdayHolidaysCount, getSaturdayHolidaysDetails } from "@/lib/holidays"

export async function getMedicalExams(userId: number) {
    return await prisma.medicalExam.findMany({
        where: { userId },
        orderBy: { validUntil: 'asc' }
    })
}


export async function addMedicalExam(userId: number, type: string, validUntil: Date) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await prisma.medicalExam.create({
            data: {
                userId,
                type,
                validUntil
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd dodawania badania" }
    }
}

export async function deleteMedicalExam(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await prisma.medicalExam.delete({ where: { id } })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd usuwania" }
    }
}

export async function getVacationStats(userId: number, year: number) {
    const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
            vacationDaysLimit: true,
            carriedOverVacationDays: true,
            additionalVacationDays: true,
            contractType: true,
            has10YearsSeniority: true,
            hasChildren: true
        }
    })

    if (!user) return { limit: 0, used: 0, details: { base: 26, carriedOver: 0, additional: 0 }, childcareUsed: 0, childcareLimit: 0, overtimeHours: 0, overtimeDaysUsed: 0, contractType: 'UOP', has10YearsSeniority: false, hasChildren: false }
    
    let baseLimit = user.vacationDaysLimit
    let carriedOver = user.carriedOverVacationDays || 0

    if (user.contractType === 'B2B') {
        baseLimit = user.vacationDaysLimit // Allow admin to change this, dont hardcode 26 anymore
        carriedOver = 0 // B2B does not carry over unused days
    } else {
        // UOP: limit depends on seniority
        baseLimit = user.has10YearsSeniority ? 26 : 20
    }

    const totalLimit = baseLimit + carriedOver

    // Count *work days* used for standard vacation + on demand in the given year
    const usedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: { in: ['VACATION', 'ON_DEMAND'] },
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    // Track on-demand specifically (it's already included in usedDays)
    const onDemandUsedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'ON_DEMAND',
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    // Track special leave specifically (does not subtract from base limit)
    const specialLeaveUsedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'SPECIAL_LEAVE',
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    // Count *work days* used for childcare in the given year
    const childcareUsedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'CHILDCARE',
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    // Count *work days* used for additional vacation in the given year
    const additionalUsedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'ADDITIONAL',
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    // Calculate total overtime hours from WorkLogEntry for ALL time up to this year? Or just lifetime. 
    // Overtime is usually accrued continuously, but let's just get total for now.
    const overtimeLogs = await prisma.workLogEntry.aggregate({
        where: { userId },
        _sum: { overtime: true }
    })
    const accruedOvertimeHours = overtimeLogs._sum.overtime || 0

    // Overtime days used
    const overtimeUsedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'OVERTIME'
            // overtime can be used across years, if accrued continuously
            // or just year? Usually overtime is rolling
        }
    })

    const availableOvertimeHours = Math.max(0, accruedOvertimeHours - (overtimeUsedDays * 8))

    const saturdayBonus = getSaturdayHolidaysCount(year)
    const saturdayHolidays = getSaturdayHolidaysDetails(year)
    const baseAdditional = user.additionalVacationDays || 0
    const totalAdditional = baseAdditional + saturdayBonus

    return {
        limit: totalLimit,
        used: usedDays,
        details: {
            base: baseLimit,
            carriedOver: carriedOver,
            additional: totalAdditional,
            baseAdditional: baseAdditional,
            additionalUsed: additionalUsedDays,
            onDemandUsed: onDemandUsedDays,
            specialLeaveUsed: specialLeaveUsedDays
        },
        childcareUsed: childcareUsedDays,
        childcareLimit: user.hasChildren ? 2 : 0,
        overtimeHours: availableOvertimeHours,
        overtimeDaysUsed: overtimeUsedDays,
        overtimeTotalAccrued: accruedOvertimeHours,
        contractType: user.contractType,
        has10YearsSeniority: user.has10YearsSeniority,
        hasChildren: user.hasChildren,
        saturdayHolidays: saturdayHolidays // Added for UI details
    }
}

export async function getUserVacations(userId: number) {
    return await prisma.vacation.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
    });
}

export async function updateVacationBalance(userId: number, limit: number, carriedOver: number, additionalVacationDays: number = 0, contractType: string = "UOP", has10YearsSeniority: boolean = false, hasChildren: boolean = false) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) {
        return { error: "Brak uprawnień" }
    }

    try {
        await (prisma as any).user.update({
            where: { id: userId },
            data: {
                vacationDaysLimit: limit,
                carriedOverVacationDays: carriedOver,
                additionalVacationDays: additionalVacationDays,
                contractType: contractType,
                has10YearsSeniority: has10YearsSeniority,
                hasChildren: hasChildren
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd aktualizacji bilansu urlopowego" }
    }
}

// Equipment Actions
export async function addEquipment(userId: number, name: string, serialNumber: string, notes: string) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).equipment.create({
            data: {
                userId,
                name,
                serialNumber,
                notes
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd dodawania sprzętu" }
    }
}

export async function deleteEquipment(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).equipment.delete({ where: { id } })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd usuwania sprzętu" }
    }
}

export async function getEquipment(userId: number) {
    return await (prisma as any).equipment.findMany({
        where: { userId },
        orderBy: { assignedDate: 'desc' }
    })
}

// Clothing Size Actions
export async function updateClothingSizes(userId: number, sizes: { shirt: string, pants: string, shoe: string, jacket: string }) {
    const session = await getServerSession(authOptions)
    const isSelf = parseInt(session?.user.id!) === userId
    if (!session || (!hasPermission(session.user as any, "manage_hr_data") && !isSelf)) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).user.update({
            where: { id: userId },
            data: {
                shirtSize: sizes.shirt,
                pantsSize: sizes.pants,
                shoeSize: sizes.shoe,
                jacketSize: sizes.jacket
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd aktualizacji rozmiarów" }
    }
}

export async function getClothingSizes(userId: number) {
    const user = await (prisma as any).user.findUnique({
        where: { id: userId },
        select: {
            shirtSize: true,
            pantsSize: true,
            shoeSize: true,
            jacketSize: true
        }
    })
    return user || {}
}

// Tool Actions
export async function addTool(userId: number, name: string, notes: string) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).tool.create({
            data: {
                userId,
                name,
                notes
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd dodawania narzędzia" }
    }
}

export async function deleteTool(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).tool.delete({ where: { id } })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd usuwania narzędzia" }
    }
}

// Benefit Actions
export async function updateBenefits(userId: number, hasInternetPackage: boolean, hasMultisportCard: boolean, internetDescription: string | null = null, multisportDescription: string | null = null) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) return { error: "Brak uprawnień" }

    try {
        await (prisma as any).user.update({
            where: { id: userId },
            data: {
                hasInternetPackage,
                hasMultisportCard,
                internetDescription,
                multisportDescription
            }
        })
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd aktualizacji benefitów" }
    }
}

