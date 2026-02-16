const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
    const password = await hash('password123', 10)

    // Admin user: Maciej Barc (Manager)
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            sortOrder: 1,
            skipDuties: true,
        },
        create: {
            username: 'admin',
            password,
            name: 'Maciej Barc',
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
