const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
    const password = await hash('password123', 10)

    // Admin user: Admin (Manager)
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            sortOrder: 1,
            skipDuties: true,
            name: 'Admin',
        },
        create: {
            username: 'admin',
            password,
            name: 'Admin',
            role: 'ADMIN',
            sortOrder: 1,
            skipDuties: true,
        },
    })

    // Sample employee: Jan Kowalski
    await prisma.user.upsert({
        where: { username: 'user' },
        update: {
            sortOrder: 2,
        },
        create: {
            username: 'user',
            password,
            name: 'Jan Kowalski',
            role: 'USER',
            sortOrder: 2,
        },
    })

    // Sample employee: Anna Nowak (Shift 1 Only)
    await prisma.user.upsert({
        where: { username: 'anna' },
        update: {
            sortOrder: 3,
            fixedShift: 'SHIFT_1'
        },
        create: {
            username: 'anna',
            password,
            name: 'Anna Nowak',
            role: 'USER',
            sortOrder: 3,
            fixedShift: 'SHIFT_1'
        },
    })

    // Seed default granular permissions
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
    ]

    for (const p of permissions) {
        await prisma.permission.upsert({
            where: { slug: p.slug },
            update: {
                name: p.name,
                description: p.description
            },
            create: p
        })
    }

    console.log('Database seeded successfully (via seed.js)!')
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
