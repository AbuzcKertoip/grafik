"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES } from "@/lib/auth/permissions"

export async function getUsers() {
    const session = await getServerSession(authOptions)
    if (!session) return []

    const { role, departmentId } = session.user
    const deptId = departmentId ? parseInt(departmentId.toString()) : null

    // ADMIN/HR sees all. MANAGER sees own department. USER sees all (or maybe restricted? Plan says "Manager access to their department")
    // Let's restrict Manager to department.
    // If User, maybe they see all for schedule visibility? Usually coworkers see each other.
    // Let's assume Manager restriction is key.

    const where: any = {}
    if (role === ROLES.MANAGER && deptId) {
        where.departmentId = deptId
    }

    // Include department info for frontend display if needed
    return await prisma.user.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        include: { department: true }
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

export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    })

    if (!user) {
        return { error: "Użytkownik nie istnieje." }
    }

    const isValid = await verifyPassword(oldPassword, user.password)

    if (!isValid) {
        return { error: "Stare hasło jest nieprawidłowe." }
    }

    const hashedPassword = await hashPassword(newPassword)

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        })
        return { success: true }
    } catch (error) {
        return { error: "Błąd zmiany hasła." }
    }
}

export async function resetPassword(userId: number, newPassword: string) {
    const hashedPassword = await hashPassword(newPassword)

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        })
        revalidatePath("/dashboard/users")
        return { success: true }
    } catch (error) {
        return { error: "Błąd resetowania hasła." }
    }
}
