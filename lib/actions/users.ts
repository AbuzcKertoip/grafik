"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES, hasPermission } from "@/lib/auth/permissions"
import { createLog } from "@/lib/actions/log-actions"

export async function getUsers(requestedDepartmentId?: string | null) {
    const session = await getServerSession(authOptions)
    if (!session) return []

    const { role, departmentId } = session.user
    const currentDeptId = departmentId ? parseInt(departmentId.toString()) : null
    const secondaryDeptId = (session.user as any).secondaryDepartmentId ? parseInt((session.user as any).secondaryDepartmentId.toString()) : null

    const where: any = {}

    // Strict RBAC Rules for Schedule Visibility
    if (role === ROLES.ADMIN || role === ROLES.HR || hasPermission(session.user as any, "manage_users") || hasPermission(session.user as any, "view_users")) {
        // Admins and HR can see all, but can also filter by a specific department
        if (requestedDepartmentId && requestedDepartmentId !== "ALL") {
            where.OR = [
                { departmentId: parseInt(requestedDepartmentId) },
                { secondaryDepartmentId: parseInt(requestedDepartmentId) }
            ];
        }
    } else if (role === ROLES.MANAGER) {
        // Specjalny wyjątek dla Eweliny Tomczyk (Manager HR i BOK)
        if (session.user.username === 'etomczyk') {
            const hrDept = await prisma.department.findFirst({ where: { name: 'HR' } })
            const bokDept = await prisma.department.findFirst({ where: { name: 'BOK' } })
            const allowedDepts = []
            if (hrDept) allowedDepts.push(hrDept.id)
            if (bokDept) allowedDepts.push(bokDept.id)
            
            if (requestedDepartmentId && requestedDepartmentId !== "ALL") {
                where.OR = [
                    { departmentId: parseInt(requestedDepartmentId) },
                    { secondaryDepartmentId: parseInt(requestedDepartmentId) }
                ]
            } else {
                where.OR = [
                    { departmentId: { in: allowedDepts } },
                    { secondaryDepartmentId: { in: allowedDepts } }
                ]
            }
        } else {
            // Managers can see their own department's members
            if (currentDeptId || secondaryDeptId) {
                const managerDepts = [];
                if (currentDeptId) managerDepts.push(currentDeptId);
                if (secondaryDeptId) managerDepts.push(secondaryDeptId);
                
                where.OR = [
                    { departmentId: { in: managerDepts } },
                    { secondaryDepartmentId: { in: managerDepts } }
                ]
            } else {
                where.id = parseInt(session.user.id.toString());
            }
        }
    } else {
        // Regular users can ONLY see themselves
        where.id = parseInt(session.user.id.toString());
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
        include: { department: true, secondaryDepartment: true }
    })
}

export async function createUser(data: any) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== ROLES.ADMIN && !hasPermission(session.user as any, "manage_users"))) {
        return { error: "Brak uprawnień" }
    }

    const { username, password, name, role, hourlyRate, sortOrder, fixedShift, skipDuties, secondaryDepartmentId } = data

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
            secondaryDepartmentId: secondaryDepartmentId ? parseInt(secondaryDepartmentId) : null,
        },
    })

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
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== ROLES.ADMIN && !hasPermission(session.user as any, "manage_users"))) {
        return { error: "Brak uprawnień" }
    }

    const { username, password, name, role, hourlyRate, sortOrder, fixedShift, skipDuties, secondaryDepartmentId } = data

    const updateData: any = {
        username,
        name,
        role,
        hourlyRate: parseFloat(hourlyRate) || 0,
        sortOrder: parseInt(sortOrder) || 999,
        fixedShift: fixedShift || null,
        skipDuties: skipDuties === "on" || skipDuties === true,
        secondaryDepartmentId: secondaryDepartmentId ? parseInt(secondaryDepartmentId) : null,
    }

    if (password && password.trim() !== "") {
        updateData.password = await hashPassword(password)
    }

    try {
        await prisma.user.update({
            where: { id },
            data: updateData,
        })

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
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== ROLES.ADMIN && !hasPermission(session.user as any, "manage_users"))) {
        return { success: false, error: "Brak uprawnień" }
    }

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id } });
        await prisma.user.delete({
            where: { id }
        });

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
