"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES, hasPermission } from "@/lib/auth/permissions"
import { hashPassword } from "@/lib/password"

// --- Department Management ---

export async function createDepartment(data: { name: string; description?: string; hasDuties?: boolean }) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_departments")) {
        return { error: "Brak uprawnień do dodawania działów" }
    }

    try {
        const dept = await prisma.department.create({
            data: {
                name: data.name,
                description: data.description,
                hasDuties: data.hasDuties ?? false,
            },
        })
        revalidatePath("/dashboard/admin")
        return { success: true, department: dept }
    } catch (error: any) {
        return { error: error.message || "Błąd podczas tworzenia działu" }
    }
}

export async function updateDepartment(id: number, data: { name: string; description?: string; hasDuties?: boolean }) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_departments")) {
        return { error: "Brak uprawnień do edycji działów" }
    }

    try {
        await prisma.department.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                hasDuties: data.hasDuties ?? false,
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
    if (!session || !hasPermission(session.user as any, "manage_departments")) {
        return { error: "Brak uprawnień do usuwania działów" }
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
    if (!session || (!hasPermission(session.user as any, "manage_users") && !hasPermission(session.user as any, "manage_hr_data"))) {
        return { error: "Brak uprawnień do wyświetlania użytkowników" }
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

export async function updateUserRoleAndDepartment(userId: number, data: { role: string; departmentId?: number | null; secondaryDepartmentId?: number | null; skipDuties?: boolean; fixedShift?: string | null }) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień" }
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                role: data.role,
                departmentId: data.departmentId ? parseInt(data.departmentId.toString()) : null,
                secondaryDepartmentId: data.secondaryDepartmentId ? parseInt(data.secondaryDepartmentId.toString()) : null,
                skipDuties: data.skipDuties ?? false,
                fixedShift: data.fixedShift === "NONE" ? null : (data.fixedShift || null),
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
    if (!session || !hasPermission(session.user as any, "manage_permissions")) {
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
    if (!session || !hasPermission(session.user as any, "manage_permissions")) {
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

export async function createUser(data: any) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień" }
    }

    try {
        const existingUsername = await prisma.user.findUnique({
            where: { username: data.username }
        })

        if (existingUsername) {
            return { error: "Użytkownik o takiej nazwie już istnieje" }
        }

        if (data.email) {
            const existingEmail = await prisma.user.findFirst({
                where: { email: data.email }
            })
            if (existingEmail) {
                return { error: "Ten adres e-mail jest już przypisany do innego konta" }
            }
        }

        const hashedPassword = await hashPassword(data.password || "Start123!")

        await prisma.user.create({
            data: {
                username: data.username,
                email: data.email || null,
                password: hashedPassword,
                name: data.name,
                role: data.role || ROLES.USER,
                departmentId: data.departmentId ? parseInt(data.departmentId.toString()) : null,
                skipDuties: data.skipDuties ?? false,
                fixedShift: data.fixedShift === "NONE" ? null : (data.fixedShift || null),
            }
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        console.error(error)
        return { error: "Wystąpił błąd podczas tworzenia użytkownika" }
    }
}

export async function deleteEmployee(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień do wykonania tej operacji." }
    }

    try {
        // Blokada przed usunięciem konta zalogowanego administratora
        if (id === parseInt(session.user?.id || "0")) {
            return { error: "Nie możesz usunąć aktualnie zalogowanego konta!" }
        }

        // Transakcja w Prisma, na wypadek gdy kaskadowe usuwanie natrafia na limity więzów we flagach
        await prisma.$transaction(async (tx) => {
            // Czyszczenie przypisanych dyżurów w grafiku
            await tx.scheduleDay.deleteMany({ where: { userId: id } })

            // Czyszczenie wygenerowanych wniosków urlopowych
            await tx.vacation.deleteMany({ where: { userId: id } })

            // Usunięcie wpisów z kart pracy
            await tx.workLogEntry.deleteMany({ where: { userId: id } })

            // Odpięcie wszelkich powiązań z pojazdami we flocie 
            await tx.car.updateMany({
                where: { caretakerId: id },
                data: { caretakerId: null }
            })

            // Usunięcie ekwipunku przypisanego
            await tx.equipment.deleteMany({ where: { userId: id } })

            // Usunięcie archiwalnych badań medycznych
            await tx.medicalExam.deleteMany({ where: { userId: id } })

            // Skasowanie uprawnień przypisanych dla użytkownika
            await tx.userPermission.deleteMany({ where: { userId: id } })

            // Właściwe usunięcie pracownika 
            await tx.user.delete({ where: { id } })
        })

        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        console.error("Błąd podczas usuwania użytkownika:", error)
        return { error: "Błąd bazy danych przy usuwaniu pracownika. Upewnij się, że nie został przypisany m.in do krytycznych raportów archiwalnych." }
    }
}
