import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    const password = await hash('password123', 10)

    const users = [
        { name: 'Admin', username: 'mbarc', role: 'ADMIN', sortOrder: 1, skipDuties: true },
        { name: 'Dawid Borowiec', username: 'dborowiec', role: 'USER', sortOrder: 2 },
        { name: 'Piotr Czuba', username: 'pczuba', role: 'USER', sortOrder: 3 },
        { name: 'Brunon Socha', username: 'bsocha', role: 'USER', sortOrder: 4, fixedShift: 'SHIFT_1' }, // Assumption based on previous context or just default
        { name: 'Łukasz Rakowski', username: 'lrakowski', role: 'USER', sortOrder: 5 },
        { name: 'Adrian Para', username: 'apara', role: 'USER', sortOrder: 6 },
        { name: 'Krystian Adamski', username: 'kadamski', role: 'USER', sortOrder: 7 },
        { name: 'Sebastian Rataj', username: 'srataj', role: 'USER', sortOrder: 8 },
        { name: 'Mateusz Mierucki', username: 'mmierucki', role: 'USER', sortOrder: 9 },
        { name: 'Andrzej Lech', username: 'alech', role: 'USER', sortOrder: 10 },
    ]

    // Cleanup existing users to avoid duplicates/conflicts if we want a clean slate matching the screenshot
    // Or just upsert. Upsert is safer to keep existing IDs if they match, but here we probably want to ensure this exact list.
    // Let's upsert by username.

    for (const user of users) {
        await prisma.user.upsert({
            where: { username: user.username },
            update: {
                name: user.name,
                role: user.role,
                sortOrder: user.sortOrder,
                skipDuties: user.skipDuties || false,
                fixedShift: user.fixedShift || null,
            },
            create: {
                username: user.username,
                password,
                name: user.name,
                role: user.role,
                sortOrder: user.sortOrder,
                skipDuties: user.skipDuties || false,
                fixedShift: user.fixedShift || null,
            },
        })
    }

    console.log('Users restored!')
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
