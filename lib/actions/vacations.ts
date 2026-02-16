"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

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

export async function createVacation(data: any) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    const { userId, startDate, endDate, type } = data
    const isAdmin = session.user.role === 'ADMIN'
    const isSelf = parseInt(session.user.id) === parseInt(userId)

    if (!isAdmin && !isSelf) return { error: "Możesz składać wnioski tylko za siebie." }

    // If Admin -> Approved immediately. If User -> Pending
    const approved = isAdmin

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Create Vacation Record
            await tx.vacation.create({
                data: {
                    userId: parseInt(userId),
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    type: type || "VACATION",
                    approved: approved
                },
            })

            // 2. Sync with ScheduleDay ONLY IF APPROVED
            if (approved) {
                const start = new Date(startDate)
                const end = new Date(endDate)
                const vacationType = type || "VACATION"

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0] // YYYY-MM-DD

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

        revalidatePath("/dashboard/schedule")
        return { success: true, approved }
    } catch (error) {
        console.error("Error creating vacation:", error)
        return { error: "Błąd podczas dodawania urlopu." }
    }
}

export async function approveVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień" }

    try {
        const vacation = await prisma.vacation.findUnique({ where: { id } })
        if (!vacation) return { error: "Wniosek nie istnieje" }

        await prisma.$transaction(async (tx) => {
            // 1. Approve
            await tx.vacation.update({
                where: { id },
                data: { approved: true }
            })

            // 2. Sync
            const start = new Date(vacation.startDate)
            const end = new Date(vacation.endDate)
            const vacationType = vacation.type

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd zatwierdzania wniosku" }
    }
}

export async function rejectVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (session?.user.role !== 'ADMIN') return { error: "Brak uprawnień" }

    return deleteVacation(id)
}

export async function deleteVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    try {
        // Optionally add permissions check: Admin or Own
        const vacation = await prisma.vacation.findUnique({ where: { id } })
        if (!vacation) return { error: "Nie znaleziono" }

        const isAdmin = session.user.role === 'ADMIN'
        const isSelf = parseInt(session.user.id) === vacation.userId

        if (!isAdmin && !isSelf) return { error: "Brak uprawnień" }
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
