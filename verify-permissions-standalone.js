const ROLES = {
    ADMIN: "ADMIN",
    SZEF: "SZEF",
    HR: "HR",
    MANAGER: "MANAGER",
    USER: "USER",
};

const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPARTMENTS: "manage_departments",
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
};

const INHERENT_PERMISSIONS = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS),
    [ROLES.SZEF]: [
        'view_users', 'view_hr_panel', 'view_fleet', 'view_reports'
    ],
    [ROLES.HR]: [
        'manage_hr_data', 'manage_fleet', 'view_users', 'view_hr_panel', 'view_fleet'
    ],
    [ROLES.MANAGER]: [
        'manage_vacations', 'view_users', 'view_hr_panel', 'view_reports',
        'generate_schedule', 'edit_schedule_dept'
    ],
    [ROLES.USER]: []
};

function hasPermission(user, permissionSlug) {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;
    const inherent = INHERENT_PERMISSIONS[user.role || ROLES.USER] || [];
    if (inherent.includes(permissionSlug)) return true;
    const userPermissions = user.permissions || [];
    if (userPermissions.includes(permissionSlug)) return true;
    return false;
}

function test(role, permissions, slug, expected) {
    const user = { role, permissions };
    const result = hasPermission(user, slug);
    console.log(`Role: ${role}, Perms: [${permissions}], Check: ${slug} => ${result} (Expected: ${expected})`);
    if (result !== expected) {
        throw new Error('FAILED!');
    }
}

test('ADMIN', [], 'manage_fleet', true);
test('HR', [], 'manage_fleet', true);
test('SZEF', [], 'view_fleet', true);
test('SZEF', [], 'manage_fleet', false);
test('MANAGER', [], 'manage_vacations', true);
test('USER', ['manage_fleet'], 'manage_fleet', true);
test('USER', [], 'manage_fleet', false);

console.log('--- ALL LOGIC TESTS PASSED ---');
