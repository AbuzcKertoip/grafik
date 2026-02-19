import { User } from "next-auth"

export const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPARTMENTS: "manage_departments",
    VIEW_ALL_SCHEDULES: "view_all_schedules",
    MANAGE_SCHEDULES: "manage_schedules",
    VIEW_REPORTS: "view_reports",
} as const

export const ROLES = {
    ADMIN: "ADMIN",
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

    // Check for specific permissions assigned to the user (if we had them in session)
    // currently session doesn't carry full permissions list, usually we check DB or assume roles have sets.
    // For now, let's map Roles to implicit permissions + allow checking specific if we fetch them.

    // Simplification for now: Map roles to permission sets
    if (user.role === ROLES.HR) {
        if (permissionSlug === PERMISSIONS.MANAGE_USERS) return true // restricted to some users normally
        if (permissionSlug === PERMISSIONS.VIEW_ALL_SCHEDULES) return true
    }

    if (user.role === ROLES.MANAGER) {
        if (permissionSlug === PERMISSIONS.MANAGE_SCHEDULES) return true
        if (permissionSlug === PERMISSIONS.VIEW_ALL_SCHEDULES) return true // maybe only their department?
    }

    return false
}

export function canManageDepartment(user: User, departmentId: number) {
    if (user.role === ROLES.ADMIN) return true
    if (user.role === ROLES.HR) return true // HR can usually see all?
    if (user.role === ROLES.MANAGER && user.departmentId === departmentId) return true
    return false
}
