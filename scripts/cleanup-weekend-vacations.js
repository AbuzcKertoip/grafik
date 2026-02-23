const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanupWeekendVacations() {
    console.log("🔍 Szukam weekendowych rekordów urlopowych w ScheduleDay...");

    // Pobierz wszystkie dni urlopowe (nie-WORK, nie-DUTY, nie-WORK_WEEKEND)
    const allVacationDays = await prisma.scheduleDay.findMany({
        where: {
            type: { notIn: ["WORK", "DUTY", "WORK_WEEKEND", "OFF"] }
        },
        select: { id: true, date: true, type: true, userId: true }
    });

    // Odfiltruj rekordy przypadające na sobotę (6) lub niedzielę (0)
    const weekendRecords = allVacationDays.filter(day => {
        const dow = new Date(day.date).getDay();
        return dow === 0 || dow === 6;
    });

    console.log(`📅 Znaleziono ${weekendRecords.length} weekendowych rekordów do usunięcia.`);

    if (weekendRecords.length === 0) {
        console.log("✅ Nic do czyszczenia!");
        return;
    }

    const ids = weekendRecords.map(r => r.id);

    // Usuń wszystkie
    const result = await prisma.scheduleDay.deleteMany({
        where: { id: { in: ids } }
    });

    console.log(`✅ Usunięto ${result.count} weekendowych rekordów urlopowych z ScheduleDay.`);
}

cleanupWeekendVacations()
    .catch(e => {
        console.error("❌ Błąd:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
