const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const perm = {
    slug: 'auto_approve_own_vacations',
    name: 'Auto-akceptacja własnych urlopów',
    description: 'Umożliwia branie urlopu bez wymaganej akceptacji i automatyczne generowanie dokumentu.'
  }

  console.log('Ensuring auto_approve_own_vacations permission exists...')
  
  await prisma.permission.upsert({
    where: { slug: perm.slug },
    update: { 
      name: perm.name, 
      description: perm.description 
    },
    create: perm
  })

  console.log('Done!')
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
