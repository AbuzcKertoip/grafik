const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { name: { contains: 'Kierownik' } },
                { name: { contains: 'serwis' } },
                { username: { contains: 'serwis' } }
            ]
        }
    })
    console.log(JSON.stringify(users, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
