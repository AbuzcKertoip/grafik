/**
 * Skrypt: fix_vacation_days.ts
 * Usuwa wpisy VACATION/ON_DEMAND z grafiku (ScheduleDay) dla pracownikow,
 * ktorzy nie maja zadnego zatwierdzonego urlopu w tabeli Vacation (status APPROVED).
 *
 * Uruchomienie:
 *   npx tsx fix_vacation_days.ts          (dry-run, podglad)
 *   npx tsx fix_vacation_days.ts --execute (wykonanie)
 *   npx tsx fix_vacation_days.ts --year 2025  (inny rok, domyslnie biezacy)
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = !process.argv.includes("--execute")
const yearArg = process.argv.find(a => a.startsWith("--year=") || a === "--year")
let year = new Date().getFullYear()
if (yearArg) {
    const idx = process.argv.indexOf("--year")
    if (idx !== -1 && process.argv[idx + 1]) year = parseInt(process.argv[idx + 1])
    if (yearArg.includes("=")) year = parseInt(yearArg.split("=")[1])
}

async function main() {
    console.log(`\n--- Naprawa blednych dni urlopowych ${year} ${dryRun ? "(DRY RUN)" : "(WYKONANIE)"} ---\n`)

    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Pobierz wszystkich uzytkownikow z wpisami urlopowymi w grafiku w danym roku
    const scheduleDays = await prisma.scheduleDay.groupBy({
        by: ["userId"],
        where: {
            type: { in: ["VACATION", "ON_DEMAND"] },
            date: { gte: startDate, lte: endDate }
        },
        _count: { id: true }
    })

    if (scheduleDays.length === 0) {
        console.log("Brak wpisow urlopowych w grafiku dla danego roku. Wszystko w porzadku!\n")
        return
    }

    let totalFixed = 0

    for (const entry of scheduleDays) {
        const userId = entry.userId
        const scheduleCount = entry._count.id

        // Sprawdz czy uzytkownik ma zatwierdzone urlopy
        const approvedVacations = await prisma.vacation.findMany({
            where: {
                userId,
                status: "APPROVED",
                startDate: { gte: startDate },
                endDate: { lte: endDate }
            }
        })

        // Zbierz daty pokryte przez zatwierdzone urlopy
        const approvedDates = new Set<string>()
        for (const v of approvedVacations) {
            for (let d = new Date(v.startDate); d <= new Date(v.endDate); d.setDate(d.getDate() + 1)) {
                if (d.getDay() !== 0 && d.getDay() !== 6) { // Pomijamy weekendy
                    approvedDates.add(d.toISOString().split("T")[0])
                }
            }
        }

        // Znajdz wpisy w grafiku ktore NIE sa pokryte zatwierdzonymi urlopami
        const orphanedDays = await prisma.scheduleDay.findMany({
            where: {
                userId,
                type: { in: ["VACATION", "ON_DEMAND"] },
                date: { gte: startDate, lte: endDate }
            },
            include: { user: true }
        })

        const toDelete = orphanedDays.filter(s => {
            const dateStr = new Date(s.date).toISOString().split("T")[0]
            return !approvedDates.has(dateStr)
        })

        if (toDelete.length === 0) continue

        const userName = orphanedDays[0]?.user?.name || `ID:${userId}`
        console.log(`  → ${userName}: ${scheduleCount} dni w grafiku, ${approvedDates.size} pokrytych zatwierdzonymi urlopami → do usuniecia: ${toDelete.length}`)
        toDelete.forEach(s => {
            const d = new Date(s.date).toLocaleDateString("pl-PL")
            console.log(`      - ${d} (${s.type})`)
        })

        if (!dryRun) {
            await prisma.scheduleDay.deleteMany({
                where: { id: { in: toDelete.map(s => s.id) } }
            })
        }
        totalFixed += toDelete.length
    }

    console.log(`\nPodsumowanie: ${totalFixed} blednych wpisow${totalFixed > 0 && dryRun ? " (nieusunietych, tryb dry-run)" : totalFixed > 0 ? " usunieto" : " - brak bledow"}.`)
    if (dryRun && totalFixed > 0) {
        console.log(`\nAby zatwierdzic usuniecie, uruchom:\n  npx tsx fix_vacation_days.ts --execute\n`)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
