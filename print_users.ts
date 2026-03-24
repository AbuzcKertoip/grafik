import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findMany().then(u => { console.log(JSON.stringify(u.map(x => ({id: x.id, name: x.name, dept: x.departmentId})), null, 2)); prisma.$disconnect(); });
