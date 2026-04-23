const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const permissions = await prisma.permission.findMany()
  console.log(JSON.stringify(permissions, null, 2))
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
