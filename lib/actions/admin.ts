"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES } from "@/lib/auth/permissions"

// --- Department Management ---

export async function createDepartment(data: { name: string; description?: string }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień (Wymagany Administrator)" }
    }

    try {
        const dept = await prisma.department.create({
            data: {
                name: data.name,
                description: data.description,
            },
        })
        revalidatePath("/dashboard/admin")
        return { success: true, department: dept }
    } catch (error: any) {
        return { error: error.message || "Błąd podczas tworzenia działu" }
    }
}

export async function updateDepartment(id: number, data: { name: string; description?: string }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień" }
    }

    try {
        await prisma.department.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
            },
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        return { error: "Błąd aktualizacji działu" }
    }
}

export async function deleteDepartment(id: number) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień" }
    }

    try {
        await prisma.department.delete({
            where: { id },
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        return { error: "Nie można usunąć działu (może mieć przypisanych pracowników)" }
    }
}

export async function getDepartments() {
    return await prisma.department.findMany({
        include: {
            _count: {
                select: { users: true }
            }
        },
        orderBy: { name: 'asc' }
    })
}

// --- User Management (Admin) ---

export async function getAllUsers() {
    const session = await getServerSession(authOptions)
    if (![ROLES.ADMIN, ROLES.HR].includes(session?.user?.role as any)) {
        return { error: "Brak uprawnień" }
    }

    const users = await prisma.user.findMany({
        include: {
            department: true,
            permissions: {
                include: {
                    permission: true
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    return { success: true, users }
}

export async function updateUserRoleAndDepartment(userId: number, data: { role: string; departmentId?: number | null }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień" }
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                role: data.role,
                departmentId: data.departmentId ? parseInt(data.departmentId.toString()) : null,
            }
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        console.error(error)
        return { error: "Błąd aktualizacji użytkownika" }
    }
}

export async function createPermission(data: { slug: string; name: string; description?: string }) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień" }
    }
    try {
        await prisma.permission.create({
            data
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        return { error: "Błąd tworzenia uprawnienia" }
    }
}

export async function getAllPermissions() {
    return await prisma.permission.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function toggleUserPermission(userId: number, permissionId: number, enable: boolean) {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== ROLES.ADMIN) {
        return { error: "Brak uprawnień" }
    }

    try {
        if (enable) {
            await prisma.userPermission.create({
                data: {
                    userId,
                    permissionId
                }
            })
        } else {
            await prisma.userPermission.deleteMany({
                where: {
                    userId,
                    permissionId
                }
            })
        }
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Błąd zmiany uprawnień" }
    }
}
