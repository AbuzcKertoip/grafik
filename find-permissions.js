const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const userPermissions = await prisma.userPermission.findMany({
        include: {
            user: true,
            permission: true
        }
    })
    console.log(JSON.stringify(userPermissions.map(up => ({
        username: up.user.username,
        permission: up.permission.slug
    })), null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
