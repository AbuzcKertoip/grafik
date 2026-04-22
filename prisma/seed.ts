import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'
import { fakerPL as faker } from '@faker-js/faker';
import fs from 'fs';

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

  const permissions = [
    { slug: 'manage_departments', name: 'Zarządzanie Działami', description: 'Tworzenie, edycja i usuwanie działów organizacyjnych.' },
    { slug: 'manage_users', name: 'Zarządzanie Pracownikami', description: 'Tworzenie, edycja ról/działów i usuwanie użytkowników.' },
    { slug: 'manage_permissions', name: 'Zarządzanie Uprawnieniami', description: 'Dostęp do bazy uprawnień i ich nadawanie użytkownikom.' },
    { slug: 'manage_hr_data', name: 'Zarządzanie Danymi HR', description: 'Edycja badań medycznych, sprzętu, rozmiarów odzieży i limitów urlopowych.' },
    { slug: 'manage_fleet', name: 'Zarządzanie Flotą', description: 'Dodawanie i edycja pojazdów służbowych oraz przypisywanie opiekunów.' },
    { slug: 'manage_vacations', name: 'Zarządzanie Urlopami', description: 'Akceptowanie i odrzucanie wniosków urlopowych (względem swojego działu lub globalnie).' },
    { slug: 'manage_work_logs', name: 'Zarządzanie Kartami Pracy', description: 'Wgląd, zatwierdzanie i usuwanie kart pracy pracowników.' },
    { slug: 'view_users', name: 'Przeglądanie Użytkowników', description: 'Podgląd listy pracowników w organizacji.' },
    { slug: 'view_hr_panel', name: 'Wgląd w Panel HR', description: 'Dostęp do zakładki HR z kartotekami pracowników.' },
    { slug: 'view_fleet', name: 'Wgląd we Flotę', description: 'Podgląd wszystkich aut w systemie.' },
    { slug: 'view_reports', name: 'Wgląd w Raporty', description: 'Dostęp do generowania list obecności i podsumowań urlopowych.' },
    { slug: 'generate_schedule', name: 'Generowanie Grafiku', description: 'Automatyczne i ręczne generowanie planu na dany miesiąc.' },
    { slug: 'edit_schedule_dept', name: 'Edycja Grafiku (Własny Dział)', description: 'Możliwość modyfikacji pojedynczych dyżurów w ramach jednego działu.' },
    { slug: 'edit_schedule_all', name: 'Edycja Grafiku (Globalna)', description: 'Możliwość modyfikacji dyżurów u wszystkich pracowników w firmie.' },
    { slug: 'clear_schedule', name: 'Czyszczenie Grafiku', description: 'Możliwość kasowania masowego całego wygenerowanego zapisu.' },
    { slug: 'auto_approve_own_vacations', name: 'Auto-akceptacja własnych urlopów', description: 'Umożliwia branie urlopu bez wymaganej akceptacji i automatyczne generowanie dokumentu.' },
  ]
  for (const perm of permissions) {
    await prisma.permission.upsert({ where: { slug: perm.slug }, update: { name: perm.name, description: perm.description }, create: perm })
  }

  // Admin user - top level
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { name: 'Admin', role: 'ADMIN', skipDuties: true },
    create: {
      username: 'admin', password, name: 'Admin', role: 'ADMIN', sortOrder: 1,
      skipDuties: true
    },
  })

  // Read required realistic structure
  const rawData = fs.readFileSync('/tmp/grafik-seed-data.json', 'utf8')
  const departmentsData = JSON.parse(rawData)

  const userIds = []
  let sortBase = 100

  for (const d of departmentsData) {
    // Create department
    const dept = await prisma.department.upsert({
      where: { name: d.department }, update: { description: d.description }, create: { name: d.department, description: d.description }
    })

    for (let i = 0; i < d.users.length; i++) {
      const u = d.users[i];
      const parts = u.name.split(' ')
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ')
      
      const username = toSimpleUsername(firstName, lastName)
      
      let existingUser = await prisma.user.findUnique({ where: { username } })
      let finalUsername = username
      let attempt = 1
      while (existingUser) {
        finalUsername = `${username}${attempt}`
        existingUser = await prisma.user.findUnique({ where: { username: finalUsername } })
        attempt++
      }

      const createdUser = await prisma.user.upsert({
        where: { username: finalUsername },
        update: {
            name: u.name,
            role: u.role,
            sortOrder: sortBase + i + 1,
            departmentId: dept.id,
            skipDuties: u.role !== 'USER', // Example: managers/admins skip duties
        },
        create: {
          username: finalUsername,
          password,
          name: u.name,
          role: u.role,
          sortOrder: sortBase + i + 1,
          departmentId: dept.id,
          skipDuties: u.role !== 'USER',
        }
      })
      
      userIds.push(createdUser.id)

      // Random Medical Exam
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

      // Random Equipment
      await prisma.equipment.create({
        data: {
          userId: createdUser.id,
          name: `Laptop ${faker.helpers.arrayElement(['Dell Latitude', 'Lenovo ThinkPad', 'HP ProBook', 'MacBook Air'])}`,
          serialNumber: faker.string.uuid(),
        }
      })
    }
    
    sortBase += 100
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
