"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { revalidatePath } from "next/cache"
import { hasPermission } from "@/lib/auth/permissions"

// Pomocnicza funkcja sprawdzająca czy user ma dostęp do floty
export async function isFleetAdmin(session: any) {
    if (!session) return false;
    const { role, departmentId } = session.user as any;
    
    if (role === "ADMIN" || role === "HR" || hasPermission(session.user as any, "manage_fleet")) {
        return true;
    }

    if (role === 'MANAGER' && departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            return true;
        }
    }
    
    return false;
}

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
    acValidUntil?: Date | null
    acPolicyNumber?: string
    ownershipType: string
    status: string
}) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
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
    acValidUntil?: Date | null
    acPolicyNumber?: string
    ownershipType: string
    status: string
    caretakerId?: number | null
}) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
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
    if (!await isFleetAdmin(session)) {
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
    if (!await isFleetAdmin(session)) {
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

export async function getCarRepairs(carId: number) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
        return []
    }

    const repairs = await prisma.carRepair.findMany({
        where: { carId },
        orderBy: { date: 'desc' }
    })

    return repairs
}

export async function addCarRepair(carId: number, data: {
    date: Date,
    cost: number,
    description: string,
    notes?: string,
    invoiceUrl?: string
}) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
        return { success: false, error: "Brak uprawnień" }
    }

    try {
        const repair = await prisma.carRepair.create({
            data: {
                carId,
                date: data.date,
                cost: data.cost,
                description: data.description,
                notes: data.notes || null,
                invoiceUrl: data.invoiceUrl || null
            }
        })

        revalidatePath("/dashboard/fleet")
        return { success: true, repair }
    } catch (e) {
        console.error("Failed to add repair", e)
        return { success: false, error: "Wystąpił błąd zapisu naprawy" }
    }
}

export async function deleteCarRepair(repairId: number) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
        return { success: false, error: "Brak uprawnień" }
    }

    try {
        await prisma.carRepair.delete({
            where: { id: repairId }
        })
        revalidatePath("/dashboard/fleet")
        return { success: true }
    } catch (e) {
        return { success: false, error: "Błąd podczas usuwania" }
    }
}
