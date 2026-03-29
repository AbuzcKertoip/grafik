const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        include: {
            permissions: {
                include: {
                    permission: true
                }
            }
        }
    })
    console.log(JSON.stringify(users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        permissions: u.permissions.map(p => p.permission.slug)
    })), null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
