"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { ROLES, hasPermission } from "@/lib/auth/permissions"
import { hashPassword } from "@/lib/password"
import { createLog } from "@/lib/actions/log-actions"

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
        where: { employmentEndDate: null },
        include: {
            department: true,
            cars: {
                select: {
                    id: true,
                    make: true,
                    model: true,
                    plate: true
                }
            },
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

export async function updateUserRoleAndDepartment(userId: number, data: { role: string; departmentId?: number | null; secondaryDepartmentId?: number | null; skipDuties?: boolean; fixedShift?: string | null; contractType?: string; has10YearsSeniority?: boolean; hasChildren?: boolean; discordId?: string | null }) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień" }
    }

    try {
        await (prisma.user as any).update({
            where: { id: userId },
            data: {
                role: data.role,
                departmentId: data.departmentId ? parseInt(data.departmentId.toString()) : null,
                secondaryDepartmentId: data.secondaryDepartmentId ? parseInt(data.secondaryDepartmentId.toString()) : null,
                skipDuties: data.skipDuties ?? false,
                fixedShift: data.fixedShift === "NONE" ? null : (data.fixedShift || null),
                contractType: data.contractType || "UOP",
                has10YearsSeniority: data.has10YearsSeniority ?? false,
                hasChildren: data.hasChildren ?? false,
                discordId: data.discordId?.trim() || null
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

        await (prisma.user as any).create({
            data: {
                username: data.username,
                email: data.email || null,
                password: hashedPassword,
                name: data.name,
                role: data.role || ROLES.USER,
                departmentId: data.departmentId ? parseInt(data.departmentId.toString()) : null,
                skipDuties: data.skipDuties ?? false,
                fixedShift: data.fixedShift === "NONE" ? null : (data.fixedShift || null),
                contractType: data.contractType || "UOP",
                has10YearsSeniority: data.has10YearsSeniority ?? false,
                hasChildren: data.hasChildren ?? false,
                discordId: data.discordId?.trim() || null
            }
        })
        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        console.error(error)
        return { error: "Wystąpił błąd podczas tworzenia użytkownika" }
    }
}

export async function terminateEmployee(id: number, endDate: Date) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień do wykonania tej operacji." }
    }

    try {
        // Blokada przed zwolnieniem konta zalogowanego administratora
        if (id === parseInt(session.user?.id || "0")) {
            return { error: "Nie możesz zwolnić aktualnie zalogowanego konta!" }
        }

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) {
            return { error: "Nie znaleziono pracownika." }
        }

        if (user.employmentEndDate) {
            return { error: "Ten pracownik jest już zwolniony." }
        }

        const carsToDetach = await prisma.car.findMany({
            where: { caretakerId: id },
            select: { plate: true, make: true, model: true }
        })
        const carInfo = carsToDetach.length > 0 
            ? `. Odpięto z floty pojazdy: ${carsToDetach.map(c => `${c.make} ${c.model} (${c.plate})`).join(", ")}`
            : ""

        await prisma.$transaction(async (tx) => {
            // Ustawienie daty zakończenia pracy
            await tx.user.update({
                where: { id },
                data: { employmentEndDate: endDate }
            })

            // Odpięcie wszelkich powiązań z pojazdami we flocie
            await tx.car.updateMany({
                where: { caretakerId: id },
                data: { caretakerId: null }
            })
        })

        await createLog({
            action: "EMPLOYEE_TERMINATED",
            description: `Zwolniono pracownika ${user.name || user.username} (data zakończenia: ${endDate.toISOString().split('T')[0]})${carInfo}`,
            userId: session?.user?.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "EMPLOYEE_TERMINATED",
            details: { 
                targetUserId: id, 
                endDate: endDate.toISOString(),
                detachedCars: carsToDetach.map(c => c.plate)
            }
        })

        revalidatePath("/dashboard/admin")
        revalidatePath("/dashboard/fleet")
        return { success: true }
    } catch (error: any) {
        console.error("Błąd podczas zwalniania pracownika:", error)
        return { error: "Błąd bazy danych przy zwalnianiu pracownika." }
    }
}

export async function getArchivedEmployees() {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień" }
    }

    const users = await prisma.user.findMany({
        where: { employmentEndDate: { not: null } },
        include: {
            department: true,
            vacations: {
                where: { status: "APPROVED" },
                orderBy: { startDate: "desc" },
                take: 5
            },
            equipment: true,
            tools: true,
            medicalExams: true,
        },
        orderBy: { employmentEndDate: 'desc' }
    })

    return { success: true, users }
}

export async function reinstateEmployee(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user as any, "manage_users")) {
        return { error: "Brak uprawnień do wykonania tej operacji." }
    }

    try {
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) {
            return { error: "Nie znaleziono pracownika." }
        }

        if (!user.employmentEndDate) {
            return { error: "Ten pracownik nie jest zwolniony." }
        }

        await prisma.user.update({
            where: { id },
            data: { employmentEndDate: null }
        })

        await createLog({
            action: "EMPLOYEE_REINSTATED",
            description: `Przywrócono pracownika ${user.name || user.username} do aktywnej kadry`,
            userId: session?.user?.id ? parseInt(session.user.id) : undefined,
            errorCodeKey: "EMPLOYEE_REINSTATED",
            details: { targetUserId: id }
        })

        revalidatePath("/dashboard/admin")
        return { success: true }
    } catch (error: any) {
        console.error("Błąd podczas przywracania pracownika:", error)
        return { error: "Błąd bazy danych przy przywracaniu pracownika." }
    }
}
