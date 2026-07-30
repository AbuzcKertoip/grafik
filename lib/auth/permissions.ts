import { User } from "next-auth"
import { prisma } from "@/lib/prisma"

export const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPARTMENTS: "manage_departments",
    MANAGE_PERMISSIONS: "manage_permissions",
    VIEW_ALL_SCHEDULES: "view_all_schedules",
    MANAGE_SCHEDULES: "manage_schedules",
    VIEW_REPORTS: "view_reports",
    MANAGE_FLEET: "manage_fleet",
    VIEW_FLEET: "view_fleet",
    VIEW_HR_PANEL: "view_hr_panel",
    MANAGE_HR_DATA: "manage_hr_data",
    MANAGE_VACATIONS: "manage_vacations",
    MANAGE_WORK_LOGS: "manage_work_logs",
    VIEW_USERS: "view_users",
    GENERATE_SCHEDULE: "generate_schedule",
    EDIT_SCHEDULE_DEPT: "edit_schedule_dept",
    EDIT_SCHEDULE_ALL: "edit_schedule_all",
    CLEAR_SCHEDULE: "clear_schedule",
    AUTO_APPROVE_OWN_VACATIONS: "auto_approve_own_vacations",
} as const

export const ROLES = {
    ADMIN: "ADMIN",
    SZEF: "SZEF",
    HR: "HR",
    MANAGER: "MANAGER",
    USER: "USER",
} as const

/**
 * Inherent permissions granted automatically to specific roles.
 * These are enforced on the backend even if not explicitly assigned in the database.
 */
export const INHERENT_PERMISSIONS: Record<string, string[]> = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS), // Admin has everything
    [ROLES.SZEF]: [
        'view_users', 'view_hr_panel', 'view_fleet', 'view_reports',
        'manage_vacations', 'view_all_schedules', 'manage_schedules'
    ],
    [ROLES.HR]: [
        'manage_hr_data', 'manage_fleet', 'view_users', 'view_hr_panel', 'view_fleet', 'manage_vacations'
    ],
    [ROLES.MANAGER]: [
        'manage_vacations', 'view_users', 'view_hr_panel', 'view_reports',
        'generate_schedule', 'edit_schedule_dept'
    ],
    [ROLES.USER]: []
}

export function hasPermission(user: User | null | undefined, permissionSlug: string) {
    if (!user) return false

    // ADMIN has all permissions
    if (user.role === ROLES.ADMIN) return true

    // Check inherent permissions based on role
    const inherent = INHERENT_PERMISSIONS[user.role || ROLES.USER] || []
    if (inherent.includes(permissionSlug)) return true

    // Check against granular permissions attached to user session (from DB)
    const userPermissions = user.permissions || []
    if (userPermissions.includes(permissionSlug)) return true

    return false
}

/**
 * Sprawdza, czy Manager należy do działu HR.
 * Manager HR ma rozszerzone uprawnienia — widzi wszystkie działy, może edytować grafiki
 * i urlopy osób z innych działów (jak rola HR).
 */
export async function isManagerInHRDept(user: any): Promise<boolean> {
    if (user.role !== 'MANAGER') return false
    const deptId = user.departmentId ? parseInt(user.departmentId.toString()) : null
    const secDeptId = user.secondaryDepartmentId ? parseInt(user.secondaryDepartmentId.toString()) : null
    
    if (deptId) {
        const dept = await prisma.department.findUnique({ where: { id: deptId } })
        if (dept && dept.name.toUpperCase() === 'HR') return true;
    }
    
    if (secDeptId) {
        const secDept = await prisma.department.findUnique({ where: { id: secDeptId } })
        if (secDept && secDept.name.toUpperCase() === 'HR') return true;
    }
    
    return false
}

export function canManageDepartment(user: User, departmentId: number) {
    if (user.role === ROLES.ADMIN || user.role === ROLES.SZEF) return true
    if (user.role === ROLES.HR) return true // HR can usually see all
    if (user.role === ROLES.MANAGER && (user.departmentId === departmentId || (user as any).secondaryDepartmentId === departmentId)) return true
    
    // Specjalny wyjątek dla Managera BOK i HR jednocześnie
    if (user.username === 'etomczyk') {
        return true
    }

    return false
}
