import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { hashPassword } from '../lib/password'

const prisma = new PrismaClient()

const employees = [
    { name: 'Admin', username: 'mbarc' },
    { name: 'Dawid Borowiec', username: 'dborowiec' },
    { name: 'Piotr Czuba', username: 'pczuba' }, // Assuming this isn't the admin acc
    { name: 'Brunon Socha', username: 'bsocha' },
    { name: 'Łukasz Rakowski', username: 'lrakowski' },
    { name: 'Adrian Para', username: 'apara' },
    { name: 'Krystian Adamski', username: 'kadamski' },
    { name: 'Sebastian Rataj', username: 'srataj' },
    { name: 'Mateusz Mierucki', username: 'mmierucki' },
    { name: 'Andrzej Lech', username: 'alech' },
]

async function main() {
    console.log('Seeding employees...')

    const defaultPassword = await hashPassword('user123')

    for (const emp of employees) {
        await prisma.user.upsert({
            where: { username: emp.username },
            update: {},
            create: {
                username: emp.username,
                password: defaultPassword,
                name: emp.name,
                role: 'USER',
                hourlyRate: 35.0, // Default rate
            }
        })
        console.log(`Added ${emp.name}`)
    }

    console.log('Done.')
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
