"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission, canManageDepartment } from "@/lib/auth/permissions"
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
        // Apply seniority logic same as UOP
        if (baseLimit === 26 && !user.has10YearsSeniority) {
            baseLimit = 20;
        } else if (baseLimit === 20 && user.has10YearsSeniority) {
            baseLimit = 26;
        }
    } else if (user.contractType === 'UOP_PART_TIME') {
        baseLimit = user.vacationDaysLimit // Custom limit for part-time (np 7/8 etatu)
    } else {
        // UOP: limit depends on seniority by default, but we should allow custom limits if HR set them manually. 
        // We will respect what's in the DB if it was changed from default, but for strict UOP we traditionally derive it:
        // Actually, let's just use user.vacationDaysLimit for EVERYONE, and only set it to 20/26 during creation!
        // But to be backwards compatible, if it's 20/26 we keep it, otherwise whatever HR typed.
        baseLimit = user.vacationDaysLimit;
        
        // Safety fallback if it was never set (default is 26)
        if (baseLimit === 26 && !user.has10YearsSeniority) {
             baseLimit = 20;
        } else if (baseLimit === 20 && user.has10YearsSeniority) {
             baseLimit = 26;
        }
    }
    const totalLimit = baseLimit + carriedOver

    // --- REFINED: Calculate used days based on APPROVED Vacation records (History-driven) ---
    // This prevents "9 used vs 2 requested" inconsistency.
    const getUsedDaysFromHistory = async (types: string[]) => {
        const approvedVacations = await prisma.vacation.findMany({
            where: {
                userId,
                type: { in: types },
                status: 'APPROVED',
                startDate: { gte: new Date(year, 0, 1) },
                endDate: { lte: new Date(year, 11, 31) }
            }
        });
        
        const { getBusinessDaysCount } = await import("../holidays");
        return approvedVacations.reduce((acc, vac) => {
            return acc + getBusinessDaysCount(new Date(vac.startDate), new Date(vac.endDate));
        }, 0);
    }

    const usedDays = await getUsedDaysFromHistory(['VACATION', 'ON_DEMAND']);
    const onDemandUsedDays = await getUsedDaysFromHistory(['ON_DEMAND']);
    const specialLeaveUsedDays = await getUsedDaysFromHistory(['SPECIAL_LEAVE']);
    const childcareUsedDays = await getUsedDaysFromHistory(['CHILDCARE']);
    const additionalUsedDays = await getUsedDaysFromHistory(['ADDITIONAL']);

    const accruedOvertimeHours = 0;

    // Overtime days used
    const overtimeUsedDays = await getUsedDaysFromHistory(['OVERTIME']);

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
    if (!session) return { error: "Brak uprawnień" }

    const targetUser = await (prisma as any).user.findUnique({ where: { id: userId }, select: { departmentId: true } })
    if (!targetUser) return { error: "Nie znaleziono użytkownika" }

    const isAuthorized = hasPermission(session.user as any, "manage_hr_data") || 
        (session.user.role === 'MANAGER' && targetUser.departmentId && canManageDepartment(session.user as any, targetUser.departmentId))

    if (!isAuthorized) return { error: "Brak uprawnień" }

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
    if (!session) return { error: "Brak uprawnień" }

    const item = await (prisma as any).equipment.findUnique({
        where: { id },
        include: { user: { select: { departmentId: true } } }
    });

    if (!item) return { error: "Nie znaleziono" }

    const isAuthorized = hasPermission(session.user as any, "manage_hr_data") || 
        (session.user.role === 'MANAGER' && item.user.departmentId && canManageDepartment(session.user as any, item.user.departmentId))

    if (!isAuthorized) return { error: "Brak uprawnień" }

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
    if (!session) return { error: "Brak uprawnień" }

    const targetUser = await (prisma as any).user.findUnique({ where: { id: userId }, select: { departmentId: true } })
    if (!targetUser) return { error: "Nie znaleziono użytkownika" }

    const isSelf = parseInt(session.user.id) === userId
    const isAuthorized = isSelf || hasPermission(session.user as any, "manage_hr_data") || 
        (session.user.role === 'MANAGER' && targetUser.departmentId && canManageDepartment(session.user as any, targetUser.departmentId))

    if (!isAuthorized) return { error: "Brak uprawnień" }

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
    if (!session) return { error: "Brak uprawnień" }

    const targetUser = await (prisma as any).user.findUnique({ where: { id: userId }, select: { departmentId: true } })
    if (!targetUser) return { error: "Nie znaleziono użytkownika" }

    const isAuthorized = hasPermission(session.user as any, "manage_hr_data") || 
        (session.user.role === 'MANAGER' && targetUser.departmentId && canManageDepartment(session.user as any, targetUser.departmentId))

    if (!isAuthorized) return { error: "Brak uprawnień" }

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
    if (!session) return { error: "Brak uprawnień" }

    const item = await (prisma as any).tool.findUnique({
        where: { id },
        include: { user: { select: { departmentId: true } } }
    });

    if (!item) return { error: "Nie znaleziono" }

    const isAuthorized = hasPermission(session.user as any, "manage_hr_data") || 
        (session.user.role === 'MANAGER' && item.user.departmentId && canManageDepartment(session.user as any, item.user.departmentId))

    if (!isAuthorized) return { error: "Brak uprawnień" }

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

