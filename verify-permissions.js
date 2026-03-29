const { hasPermission, ROLES } = require('./lib/auth/permissions');

function test(role, permissions, slug, expected) {
    const user = { role, permissions };
    const result = hasPermission(user, slug);
    console.log(`Role: ${role}, Perms: [${permissions}], Check: ${slug} => ${result} (Expected: ${expected})`);
    if (result !== expected) {
        console.error('FAILED!');
        process.exit(1);
    }
}

console.log('--- Testing Inherent Permissions ---');
test('ADMIN', [], 'manage_fleet', true);
test('HR', [], 'manage_fleet', true);
test('HR', [], 'view_fleet', true);
test('SZEF', [], 'view_fleet', true);
test('SZEF', [], 'manage_fleet', false);
test('MANAGER', [], 'manage_vacations', true);
test('MANAGER', [], 'manage_fleet', false);

console.log('--- Testing Explicit Permissions ---');
test('USER', ['manage_fleet'], 'manage_fleet', true);
test('MANAGER', ['manage_fleet'], 'manage_fleet', true);
test('USER', [], 'manage_fleet', false);

console.log('--- ALL TESTS PASSED ---');
