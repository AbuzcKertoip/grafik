"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { revalidatePath } from "next/cache"

export async function getCars() {
    const session = await getServerSession(authOptions)
    if (!session) return []

    // If admin, return all cars. If user, return only assigned cars?
    // For now, let's have separate functions or handle it here.
    // But the requirement says "Admin panel" and "User tab".

    // For Admin Panel, we need all cars including caretaker info.
    const cars = await prisma.car.findMany({
        include: {
            caretaker: {
                select: {
                    id: true,
                    name: true,
                    username: true
                }
            }
        },
        orderBy: {
            plate: 'asc'
        }
    })

    return cars
}

export async function getUserCars(userId: number) {
    const cars = await prisma.car.findMany({
        where: {
            caretakerId: userId
        },
        include: {
            caretaker: {
                select: {
                    id: true,
                    name: true,
                    username: true
                }
            }
        }
    })
    return cars
}

export async function createCar(data: {
    make: string
    model: string
    plate: string
    vin: string
    productionYear: number
    inspectionValidUntil: Date
    insuranceValidUntil: Date
    policyNumber: string
    status: string
}) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const car = await prisma.car.create({
            data: {
                ...data,
                status: "ACTIVE"
            }
        })
        revalidatePath("/dashboard/fleet")
        return { success: true, car }
    } catch (error) {
        console.error("Error creating car:", error)
        return { success: false, error: "Failed to create car" }
    }
}

export async function updateCar(id: number, data: {
    make: string
    model: string
    plate: string
    vin: string
    productionYear: number
    inspectionValidUntil: Date
    insuranceValidUntil: Date
    policyNumber: string
    status: string
    caretakerId?: number | null
}) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        const car = await prisma.car.update({
            where: { id },
            data
        })
        revalidatePath("/dashboard/fleet")
        revalidatePath("/dashboard/my-cars")
        return { success: true, car }
    } catch (error) {
        console.error("Error updating car:", error)
        return { success: false, error: "Failed to update car" }
    }
}

export async function deleteCar(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await prisma.car.delete({
            where: { id }
        })
        revalidatePath("/dashboard/fleet")
        return { success: true }
    } catch (error) {
        console.error("Error deleting car:", error)
        return { success: false, error: "Failed to delete car" }
    }
}

export async function assignCaretaker(carId: number, caretakerId: number | null) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return { success: false, error: "Unauthorized" }
    }

    try {
        await prisma.car.update({
            where: { id: carId },
            data: { caretakerId }
        })
        revalidatePath("/dashboard/fleet")
        revalidatePath("/dashboard/my-cars")
        return { success: true }
    } catch (error) {
        console.error("Error assigning caretaker:", error)
        return { success: false, error: "Failed to assign caretaker" }
    }
}
