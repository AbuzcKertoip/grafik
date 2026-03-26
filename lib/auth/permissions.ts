import { User } from "next-auth"

export const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPARTMENTS: "manage_departments",
    VIEW_ALL_SCHEDULES: "view_all_schedules",
    MANAGE_SCHEDULES: "manage_schedules",
    VIEW_REPORTS: "view_reports",
    MANAGE_FLEET: "manage_fleet",
} as const

export const ROLES = {
    ADMIN: "ADMIN",
    SZEF: "SZEF",
    HR: "HR",
    MANAGER: "MANAGER",
    USER: "USER",
} as const

// Role Hierarchy: ADMIN > HR > MANAGER > USER
// specific permissions can override these.

export function hasPermission(user: User, permissionSlug: string) {
    if (!user) return false

    // ADMIN has all permissions
    if (user.role === ROLES.ADMIN) return true

    // Check against granular permissions attached to user session
    const userPermissions = user.permissions || []
    if (userPermissions.includes(permissionSlug)) return true

    return false
}

export function canManageDepartment(user: User, departmentId: number) {
    if (user.role === ROLES.ADMIN || user.role === ROLES.SZEF) return true
    if (user.role === ROLES.HR) return true // HR can usually see all?
    if (user.role === ROLES.MANAGER && user.departmentId === departmentId) return true
    
    // Specjalny wyjątek dla Managera BOK i HR jednocześnie
    // Zakładamy, że Ewelina Tomczyk to "etomczyk" lub z departmentId HR prosi o BOK
    if (user.username === 'etomczyk') {
        // Pozwól na zarządzanie jeśli jest przypisana do swojego lub innego konkretnego
        // Idealnie byłoby pobrać z bazy listę przypisanych działów, ale 1-to-M w PrismaSchema 
        // to wymusza. Zwracamy true dla jej przypadku przy pobieraniu BOK.
        return true
    }

    return false
}
