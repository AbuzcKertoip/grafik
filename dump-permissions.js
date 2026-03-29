const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const permissions = await prisma.permission.findMany()
    console.log(JSON.stringify(permissions, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
