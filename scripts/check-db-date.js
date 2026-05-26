const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    console.log("=== DIAGNOSTYKA BAZY DANYCH ===");

    // Ostatnie logi systemowe
    const lastLogs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log("\nOstatnie logi systemowe (SystemLog):");
    if (lastLogs.length === 0) console.log("Brak logów");
    lastLogs.forEach(l => {
      console.log(`- [${l.createdAt.toISOString()}] ${l.action}: ${l.description}`);
    });

    // Ostatni użytkownicy
    const lastUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log("\nOstatnio utworzeni użytkownicy (User):");
    if (lastUsers.length === 0) console.log("Brak użytkowników");
    lastUsers.forEach(u => {
      console.log(`- [${u.createdAt.toISOString()}] ID: ${u.id}, Login: ${u.username}, Nazwa: ${u.name}`);
    });

    // Ostatnie urlopy
    const lastVacations = await prisma.vacation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log("\nOstatnio dodane wnioski urlopowe (Vacation):");
    if (lastVacations.length === 0) console.log("Brak urlopów");
    lastVacations.forEach(v => {
      console.log(`- [${v.createdAt.toISOString()}] ID: ${v.id}, UserID: ${v.userId}, Od: ${v.startDate.toISOString().split('T')[0]}, Do: ${v.endDate.toISOString().split('T')[0]}, Status: ${v.status}`);
    });

    // Ostatnie maile
    const lastEmails = await prisma.emailLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 5
    });
    console.log("\nOstatnio wysłane maile (EmailLog):");
    if (lastEmails.length === 0) console.log("Brak maili");
    lastEmails.forEach(e => {
      console.log(`- [${e.sentAt.toISOString()}] Do: ${e.toEmail}, Temat: ${e.subject}, Status: ${e.status}`);
    });

  } catch (err) {
    console.error("Błąd podczas odczytu bazy:", err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
