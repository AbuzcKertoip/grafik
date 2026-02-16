"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"

export async function getUsers() {
    return await prisma.user.findMany({
        orderBy: { sortOrder: "asc" },
    })
}

export async function createUser(data: any) {
    const { username, password, name, role, hourlyRate, sortOrder, fixedShift, skipDuties } = data

    const existingUser = await prisma.user.findUnique({
        where: { username },
    })

    if (existingUser) {
        return { error: "Użytkownik o takim loginie już istnieje." }
    }

    const hashedPassword = await hashPassword(password)

    await prisma.user.create({
        data: {
            username,
            password: hashedPassword,
            name,
            role: role || "USER",
            hourlyRate: parseFloat(hourlyRate) || 0,
            sortOrder: parseInt(sortOrder) || 999,
            fixedShift: fixedShift || null,
            skipDuties: skipDuties === "on" || skipDuties === true,
        },
    })

    revalidatePath("/dashboard/users")
    return { success: true }
}

export async function updateUser(id: number, data: any) {
    const { username, password, name, role, hourlyRate, sortOrder, fixedShift, skipDuties } = data

    const updateData: any = {
        username,
        name,
        role,
        hourlyRate: parseFloat(hourlyRate) || 0,
        sortOrder: parseInt(sortOrder) || 999,
        fixedShift: fixedShift || null,
        skipDuties: skipDuties === "on" || skipDuties === true,
    }

    if (password && password.trim() !== "") {
        updateData.password = await hashPassword(password)
    }

    try {
        await prisma.user.update({
            where: { id },
            data: updateData,
        })
        revalidatePath("/dashboard/users")
        return { success: true }
    } catch (error) {
        return { error: "Błąd podczas aktualizacji użytkownika." }
    }
}

export async function deleteUser(id: number) {
    try {
        await prisma.user.delete({
            where: { id },
        })
        revalidatePath("/dashboard/users")
        return { success: true }
    } catch (error) {
        return { error: "Nie można usunąć użytkownika." }
    }
}
