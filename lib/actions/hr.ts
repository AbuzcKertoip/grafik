"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { hasPermission } from "@/lib/auth/permissions"

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
            carriedOverVacationDays: true
        }
    })

    if (!user) return { limit: 0, used: 0, details: { base: 26, carriedOver: 0 } }

    const totalLimit = (user.vacationDaysLimit || 0) + (user.carriedOverVacationDays || 0)

    // Count *work days* used for vacation in the given year
    const usedDays = await prisma.scheduleDay.count({
        where: {
            userId,
            type: 'VACATION',
            date: {
                gte: new Date(year, 0, 1),
                lte: new Date(year, 11, 31)
            }
        }
    })

    return {
        limit: totalLimit,
        used: usedDays,
        details: {
            base: user.vacationDaysLimit,
            carriedOver: user.carriedOverVacationDays
        }
    }
}

export async function getUserVacations(userId: number) {
    return await prisma.vacation.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
    });
}

export async function updateVacationBalance(userId: number, limit: number, carriedOver: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_hr_data")) {
        return { error: "Brak uprawnień" }
    }

    try {
        await (prisma as any).user.update({
            where: { id: userId },
            data: {
                vacationDaysLimit: limit,
                carriedOverVacationDays: carriedOver
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
