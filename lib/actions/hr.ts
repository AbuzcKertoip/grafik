"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function getMedicalExams(userId: number) {
    return await prisma.medicalExam.findMany({
        where: { userId },
        orderBy: { validUntil: 'asc' }
    })
}

export async function addMedicalExam(userId: number, type: string, validUntil: Date) {
    const session = await getServerSession(authOptions)
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień" }

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
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień" }

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

    if (!user) return { limit: 0, used: 0 }

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
