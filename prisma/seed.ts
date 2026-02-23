import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'
import { fakerPL as faker } from '@faker-js/faker';

const prisma = new PrismaClient()

// Removes polish accents from string to generate valid simple username
function toSimpleUsername(firstName: string, lastName: string) {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o', 'Ś': 's', 'Ź': 'z', 'Ż': 'z'
  };
  const str = `${firstName}.${lastName}`.toLowerCase().replace(/[ąćęłńóśźż]/g, match => map[match] || match);
  return str.replace(/[^a-z0-9.]/g, ''); // leave only alpha-numeric and dot
}

async function main() {
  const password = await hash('password123', 10)

  // System Roles
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

  // Create Departments IT, BOK, Przedstawiciele Handlowi
  const departmentsData = [
    { name: 'IT', description: 'Technologia i Rozwój' },
    { name: 'BOK', description: 'Biuro Obsługi Klienta' },
    { name: 'Przedstawiciele Handlowi', description: 'Sprzedaż w Terenie' }
  ]

  const createdDepartments = []
  for (const d of departmentsData) {
    const dept = await prisma.department.upsert({
      where: { name: d.name }, update: { description: d.description }, create: d
    })
    createdDepartments.push(dept)
  }

  // Admin user
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { name: 'Admin', role: 'ADMIN', skipDuties: true },
    create: {
      username: 'admin', password, name: 'Admin', role: 'ADMIN', sortOrder: 1,
      skipDuties: true
    },
  })

  // Data structure for employee generation
  const departmentCounts = {
    'IT': 10,
    'BOK': 5,
    'Przedstawiciele Handlowi': 3
  }

  const userIds = []
  let sortBase = 100

  // Managers & Users for each department
  for (const dept of createdDepartments) {
    // Generate Manager
    const managerFirstName = faker.person.firstName()
    const managerLastName = faker.person.lastName()
    const managerUsername = toSimpleUsername(managerFirstName, managerLastName)

    const manager = await prisma.user.upsert({
      where: { username: managerUsername },
      update: { departmentId: dept.id, role: 'MANAGER' },
      create: {
        username: managerUsername,
        password,
        name: `${managerFirstName} ${managerLastName}`,
        role: 'MANAGER',
        sortOrder: sortBase,
        skipDuties: true,
        departmentId: dept.id
      },
    })
    userIds.push(manager.id)
    sortBase++

    // Generate Users for this department
    const employeeCount = departmentCounts[dept.name as keyof typeof departmentCounts] || 0
    for (let i = 0; i < employeeCount; i++) {
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      const username = toSimpleUsername(firstName, lastName)

      let existingUser = await prisma.user.findUnique({ where: { username } })
      let finalUsername = username
      let attempt = 1
      while (existingUser) {
        finalUsername = `${username}${attempt}`
        existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
        attempt++
      }

      const createdUser = await prisma.user.create({
        data: {
          username: finalUsername,
          password,
          name: `${firstName} ${lastName}`,
          role: 'USER',
          sortOrder: sortBase + i + 1,
          departmentId: dept.id,
          skipDuties: false,
        }
      })
      userIds.push(createdUser.id)

      // Medical Exam
      const validUntil = faker.date.future({ years: 2 })
      await prisma.medicalExam.create({
        data: {
          userId: createdUser.id,
          validUntil: validUntil,
          type: faker.helpers.arrayElement(['MEDICINE_WORK', 'SANITARY', 'SAFETY_TRAINING']),
          status: 'VALID'
        } as any
      }).catch(() => {
        return prisma.medicalExam.create({
          data: {
            userId: createdUser.id,
            validUntil: validUntil,
            type: faker.helpers.arrayElement(['MEDICINE_WORK', 'SANITARY', 'SAFETY_TRAINING']),
          }
        })
      })

      // Equipment
      await prisma.equipment.create({
        data: {
          userId: createdUser.id,
          name: `Laptop ${faker.helpers.arrayElement(['Dell Latitude', 'Lenovo ThinkPad', 'HP ProBook', 'MacBook Air'])}`,
          serialNumber: faker.string.uuid(),
        }
      })
    }
    sortBase += 100 // separate sorts per department nicely
  }

  console.log('--- Generating Realistic Mock Cars ---')

  const realisticCars = [
    { make: 'Skoda', model: 'Octavia' },
    { make: 'Toyota', model: 'Corolla' },
    { make: 'Volkswagen', model: 'Golf' },
    { make: 'Ford', model: 'Focus' },
    { make: 'Kia', model: 'Ceed' },
  ]

  for (let i = 0; i < 5; i++) {
    const carData = realisticCars[i]
    // random caretaker from created users
    const caretakerId = faker.helpers.arrayElement(userIds)

    await prisma.car.create({
      data: {
        make: carData.make,
        model: carData.model,
        plate: `W${faker.string.alpha({ length: 1, casing: 'upper' })} ${faker.number.int({ min: 10000, max: 99999 })}`,
        vin: faker.vehicle.vin(),
        productionYear: faker.number.int({ min: 2020, max: 2024 }),
        inspectionValidUntil: faker.date.future({ years: 1 }),
        insuranceValidUntil: faker.date.future({ years: 1 }),
        policyNumber: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
        status: 'ACTIVE',
        caretakerId: caretakerId
      }
    })
  }

  console.log('Database successfully seeded with requested specific requirements!')
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
