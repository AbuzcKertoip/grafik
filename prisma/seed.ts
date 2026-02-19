import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const password = await hash('password123', 10)

  // Create Departments
  const deptIT = await prisma.department.upsert({
    where: { name: 'IT' },
    update: {},
    create: { name: 'IT', description: 'Dział IT' },
  })

  const deptHR = await prisma.department.upsert({
    where: { name: 'HR' },
    update: {},
    create: { name: 'HR', description: 'Kadry i Płace' },
  })

  const deptSales = await prisma.department.upsert({
    where: { name: 'Sales' },
    update: {},
    create: { name: 'Sales', description: 'Sprzedaż' },
  })

  // Create Permissions
  const permissions = [
    { slug: 'manage_users', name: 'Zarządzanie użytkownikami' },
    { slug: 'manage_departments', name: 'Zarządzanie działami' },
    { slug: 'view_all_schedules', name: 'Podgląd wszystkich grafików' },
    { slug: 'manage_schedules', name: 'Zarządzanie grafikami' },
    { slug: 'view_reports', name: 'Podgląd raportów' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {},
      create: perm,
    })
  }

  // Admin user: Maciej Barc (Manager)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      sortOrder: 1,
      skipDuties: true,
      departmentId: deptIT.id,
    },
    create: {
      username: 'admin',
      password,
      name: 'Maciej Barc',
      role: 'ADMIN',
      sortOrder: 1,
      skipDuties: true,
      departmentId: deptIT.id,
    },
  })

  // Sample employee: Jan Kowalski
  await prisma.user.upsert({
    where: { username: 'user' },
    update: {
      sortOrder: 2,
      departmentId: deptSales.id,
    },
    create: {
      username: 'user',
      password,
      name: 'Jan Kowalski',
      role: 'USER',
      sortOrder: 2,
      departmentId: deptSales.id,
    },
  })

  // Sample employee: Anna Nowak (Shift 1 Only)
  await prisma.user.upsert({
    where: { username: 'anna' },
    update: {
      sortOrder: 3,
      fixedShift: 'SHIFT_1',
      departmentId: deptHR.id,
    },
    create: {
      username: 'anna',
      password,
      name: 'Anna Nowak',
      role: 'USER',
      sortOrder: 3,
      fixedShift: 'SHIFT_1',
      departmentId: deptHR.id,
    },
  })

  // HR User
  await prisma.user.upsert({
    where: { username: 'hr' },
    update: {
      sortOrder: 4,
      departmentId: deptHR.id,
    },
    create: {
      username: 'hr',
      password,
      name: 'Katarzyna HR',
      role: 'HR', // Needs role enum update if strictly typed, but schema has String
      sortOrder: 4,
      departmentId: deptHR.id,
    },
  })

  // Manager User
  await prisma.user.upsert({
    where: { username: 'manager' },
    update: {
      sortOrder: 5,
      departmentId: deptSales.id,
    },
    create: {
      username: 'manager',
      password,
      name: 'Piotr Kierownik',
      role: 'MANAGER',
      sortOrder: 5,
      departmentId: deptSales.id,
    },
  })

  console.log('Database seeded!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
