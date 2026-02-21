import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

import { fakerPL as faker } from '@faker-js/faker';

const prisma = new PrismaClient()

async function main() {
  const password = await hash('password123', 10)

  // System Roles (just to be sure permissions exist)
  const permissions = [
    { slug: 'manage_users', name: 'Zarządzanie użytkownikami' },
    { slug: 'manage_departments', name: 'Zarządzanie działami' },
    { slug: 'view_all_schedules', name: 'Podgląd wszystkich grafików' },
    { slug: 'manage_schedules', name: 'Zarządzanie grafikami' },
    { slug: 'view_reports', name: 'Podgląd raportów' },
  ]
  for (const perm of permissions) {
    await prisma.permission.upsert({ where: { slug: perm.slug }, update: {}, create: perm })
  }

  // Create Departments
  const departmentsData = [
    { name: 'IT', description: 'Wsparcie Informatyczne' },
    { name: 'HR', description: 'Zasoby Ludzkie i Kadry' },
    { name: 'Sales', description: 'Sprzedaż i Pozyskiwanie Klienta' },
    { name: 'Logistics', description: 'Transport i Planowanie' },
    { name: 'Marketing', description: 'Promocja i PR' }
  ]

  const createdDepartments = []
  for (const d of departmentsData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name }, update: {}, create: d
    })
    createdDepartments.push(dept)
  }

  // Base System Users
  const baseUsers = [
    { user: 'admin', name: 'Admin', role: 'ADMIN', dept: 'IT', skipDuties: true },
    { user: 'user', name: 'Jan Kowalski', role: 'USER', dept: 'Sales', skipDuties: false },
    { user: 'anna', name: 'Anna Nowak', role: 'USER', dept: 'HR', skipDuties: false },
    { user: 'hr', name: 'Katarzyna Kadrowa', role: 'HR', dept: 'HR', skipDuties: false },
  ]

  for (let i = 0; i < baseUsers.length; i++) {
    const b = baseUsers[i]
    const assignedDept = createdDepartments.find(d => d.name === b.dept)
    await prisma.user.upsert({
      where: { username: b.user },
      update: { name: b.name, departmentId: assignedDept?.id, role: b.role },
      create: {
        username: b.user, password, name: b.name, role: b.role, sortOrder: i + 1,
        skipDuties: b.skipDuties, departmentId: assignedDept?.id
      },
    })
  }

  // Generate a dedicated MANAGER for every created department
  for (let i = 0; i < createdDepartments.length; i++) {
    const dept = createdDepartments[i]
    const managerUsername = `manager_${dept.name.toLowerCase()}`

    await prisma.user.upsert({
      where: { username: managerUsername },
      update: { departmentId: dept.id, role: 'MANAGER' },
      create: {
        username: managerUsername,
        password,
        name: `Kierownik ${dept.name}`,
        role: 'MANAGER',
        sortOrder: 100 + i,
        skipDuties: true,
        departmentId: dept.id
      },
    })
  }

  console.log('--- Generating Mock Users (Faker.js) ---')

  const userIds = []
  // Generate ~30 mock employees
  for (let i = 0; i < 30; i++) {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const randomDept = createdDepartments[Math.floor(Math.random() * createdDepartments.length)]

    // Some basic phone numbers and emergency contacts
    const phone = faker.phone.number({ style: 'national' })
    const email = faker.internet.email({ firstName, lastName }).toLowerCase()

    const createdUser = await prisma.user.create({
      data: {
        username: faker.internet.username({ firstName, lastName }).toLowerCase().replace(/[^a-z0-9]/g, ''),
        password,
        name: `${firstName} ${lastName}`,
        role: 'USER',
        sortOrder: i + 10,
        departmentId: randomDept.id,
      }
    })
    userIds.push(createdUser.id)

    // Generate Medical Exam
    // ~20% chance of expiring soon (<30 days), ~10% expired, rest OK
    const examSeed = Math.random()
    let validUntil = new Date()
    if (examSeed < 0.1) {
      validUntil = faker.date.recent({ days: 60 }) // expired
    } else if (examSeed < 0.3) {
      validUntil = faker.date.soon({ days: 25 }) // expiring soon
    } else {
      validUntil = faker.date.future({ years: 2 }) // valid
    }

    await prisma.medicalExam.create({
      data: {
        userId: createdUser.id,
        validUntil: validUntil,
        type: faker.helpers.arrayElement(['MEDICINE_WORK', 'SANITARY', 'SAFETY_TRAINING']),
        status: validUntil < new Date() ? 'EXPIRED' : 'VALID'
      } as any // Ignoring status as it might not be in the original schema if we use custom components locally
    }).catch(() => {
      return prisma.medicalExam.create({
        data: {
          userId: createdUser.id,
          validUntil: validUntil,
          type: faker.helpers.arrayElement(['MEDICINE_WORK', 'SANITARY', 'SAFETY_TRAINING']),
        }
      })
    })

    // Generate Basic Equipment
    await prisma.equipment.create({
      data: {
        userId: createdUser.id,
        name: `Laptop ${faker.helpers.arrayElement(['Dell', 'Lenovo ThinkPad', 'HP', 'Apple MacBook'])}`,
        serialNumber: faker.string.uuid(),
        notes: `Wydano ${faker.date.past({ years: 2 }).toLocaleDateString()}`
      }
    })

    // Randomize Phone
    if (Math.random() > 0.3) {
      await prisma.equipment.create({
        data: {
          userId: createdUser.id,
          name: `Telefon ${faker.helpers.arrayElement(['Samsung Galaxy', 'Apple iPhone', 'Google Pixel'])}`,
          serialNumber: faker.string.uuid(),
        }
      })
    }

    // Generate Vacations
    const vacationsCount = faker.number.int({ min: 1, max: 4 })
    for (let v = 0; v < vacationsCount; v++) {
      const type = faker.helpers.arrayElement(['VACATION', 'SICK', 'OTHER'])
      const approved = faker.datatype.boolean()
      const startDate = faker.date.between({ from: '2025-01-01', to: '2026-12-31' })
      const duration = faker.number.int({ min: 1, max: 14 })
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + duration)

      await prisma.vacation.create({
        data: {
          userId: createdUser.id,
          startDate: startDate,
          endDate: endDate,
          type: type,
          approved: approved
        }
      })
    }
  }

  console.log('--- Generating Mock Cars (Faker.js) ---')

  // Generating fleet cars
  for (let i = 0; i < 15; i++) {
    const isAssigned = Math.random() > 0.4
    const caretakerId = isAssigned ? faker.helpers.arrayElement(userIds) : null

    // ~20% chance of expiring policy or review
    const inspectionValidUntil = Math.random() < 0.2 ? faker.date.soon({ days: 15 }) : faker.date.future({ years: 1 })
    const insuranceValidUntil = Math.random() < 0.2 ? faker.date.soon({ days: 20 }) : faker.date.future({ years: 1 })

    await prisma.car.create({
      data: {
        make: faker.vehicle.manufacturer(),
        model: faker.vehicle.model(),
        plate: faker.vehicle.vrm(),
        vin: faker.vehicle.vin(),
        productionYear: faker.number.int({ min: 2015, max: 2024 }),
        inspectionValidUntil: inspectionValidUntil,
        insuranceValidUntil: insuranceValidUntil,
        policyNumber: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
        status: faker.helpers.arrayElement(['ACTIVE', 'SERVICE', 'ACTIVE', 'ACTIVE']),
        caretakerId: caretakerId
      }
    })
  }

  console.log('Database successfully seeded with realistic mock data!')
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
