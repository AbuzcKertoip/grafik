"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES } from "@/lib/auth/permissions"
import { createLog } from "@/lib/actions/log-actions"

export async function getUsers(requestedDepartmentId?: string | null) {
    const session = await getServerSession(authOptions)
    if (!session) return []

    const { role, departmentId } = session.user
    const currentDeptId = departmentId ? parseInt(departmentId.toString()) : null

    const where: any = {}

    // Strict RBAC Rules for Schedule Visibility
    if (role === ROLES.USER || role === ROLES.MANAGER) {
        // Users and Managers can ONLY see their own department's members
        if (currentDeptId) {
            where.departmentId = currentDeptId;
        } else {
            // Failsafe: if they have no department assigned, show only themselves
            // or show an empty list. We'll show just themselves for now.
            where.id = session.user.id;
        }
    } else if (role === ROLES.ADMIN || role === ROLES.HR) {
        // Admins and HR can see all, but can also filter by a specific department
        if (requestedDepartmentId && requestedDepartmentId !== "ALL") {
            where.departmentId = parseInt(requestedDepartmentId);
        }
    }

    // Always exclude ADMIN role from employee lists
    if (!where.role) {
        where.role = { not: 'ADMIN' }
    } else if (typeof where.role === 'object') {
        where.role = { ...where.role, not: 'ADMIN' }
    } else {
        // This shouldn't happen based on above logic, but just in case
        where.role = { not: 'ADMIN' }
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

    const addedUser = await prisma.user.create({
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

    const session = await getServerSession(authOptions);
    await createLog({
        action: "USER_CREATED",
        description: `Dodano nowego użytkownika ${username} (Rola: ${role || "USER"})`,
        userId: session?.user?.id ? parseInt(session.user.id) : undefined,
        errorCodeKey: "USER_CREATED",
        details: { targetUserId: addedUser.id, role }
    });

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

        const session = await getServerSession(authOptions);
        await createLog({
            action: "USER_UPDATED",
            description: `Zaktualizowano dane użytkownika: ${username || id}`,
            userId: session?.user?.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "USER_UPDATED",
            details: { targetUserId: id, updateData }
        });

        revalidatePath("/dashboard/users")
        return { success: true }
    } catch (error) {
        return { error: "Błąd podczas aktualizacji użytkownika." }
    }
}

export async function deleteUser(id: number) {
    try {
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        await prisma.user.delete({
            where: { id }
        });

        const session = await getServerSession(authOptions);
        await createLog({
            action: "USER_DELETED",
            description: `Usunięto użytkownika ${userToDelete?.username || id}`,
            userId: session?.user?.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "USER_DELETED",
            details: { targetUserId: id }
        });

        revalidatePath("/dashboard/users");
        return { success: true };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false, error: "Failed to delete user" };
    }
}

export async function updateContactInfo(formData: FormData) {
    try {
        const userId = parseInt(formData.get("userId") as string);
        const phone = formData.get("phone") as string;
        const email = formData.get("email") as string;
        const emergencyContact = formData.get("emergencyContact") as string;

        if (isNaN(userId)) {
            return { success: false, error: "Invalid user ID" };
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                phone: phone || null,
                email: email || null,
                emergencyContact: emergencyContact || null
            }
        });

        revalidatePath("/dashboard/profile");

        return { success: true };
    } catch (error) {
        console.error("Error updating contact info:", error);
        return { success: false, error: "Wystąpił błąd serwera" };
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
