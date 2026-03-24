/**
 * Skrypt: reset_vacation_days.ts
 * Uruchomienie: npx tsx reset_vacation_days.ts
 * Opcje:
 *   --execute  – Wykonuje zmiany w bazie (domyślnie: tryb dry-run)
 *
 * Logika:
 *   - 20 dni urlopu → pracownicy bez 10-letniego stażu
 *   - 26 dni urlopu → pracownicy z 10-letnim stażem (has10YearsSeniority = true)
 *   - carriedOverVacationDays → reset do 0
 *   - additionalVacationDays  → reset do 0
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const dryRun = !process.argv.includes("--execute")

async function main() {
    console.log(`\n--- Reset Dni Urlopowych ${dryRun ? "(DRY RUN)" : "(WYKONANIE)"} ---\n`)

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            has10YearsSeniority: true,
            vacationDaysLimit: true,
            carriedOverVacationDays: true,
            additionalVacationDays: true,
        },
        orderBy: { name: "asc" },
    })

    let changes = 0

    for (const u of users) {
        const newLimit = u.has10YearsSeniority ? 26 : 20
        const wouldChange =
            u.vacationDaysLimit !== newLimit ||
            u.carriedOverVacationDays !== 0 ||
            u.additionalVacationDays !== 0

        if (!wouldChange) {
            console.log(`  ✓ ${u.name || u.username} – bez zmian (limit: ${u.vacationDaysLimit})`)
            continue
        }

        console.log(
            `  → ${u.name || u.username}:` +
            `  limit ${u.vacationDaysLimit}→${newLimit}` +
            (u.carriedOverVacationDays !== 0 ? `  przenos ${u.carriedOverVacationDays}→0` : ``) +
            (u.additionalVacationDays !== 0 ? `  dodatkowe ${u.additionalVacationDays}→0` : ``)
        )

        if (!dryRun) {
            await prisma.user.update({
                where: { id: u.id },
                data: {
                    vacationDaysLimit: newLimit,
                    carriedOverVacationDays: 0,
                    additionalVacationDays: 0,
                },
            })
        }
        changes++
    }

    console.log(`\nPodsumowanie: ${changes} pracownik${changes === 1 ? "" : "ów"} wymaga aktualizacji.`)

    if (dryRun && changes > 0) {
        console.log(`\nAby zastosować zmiany, uruchom:\n  npx tsx reset_vacation_days.ts --execute\n`)
    } else if (!dryRun) {
        console.log("Gotowe! Dni urlopowe zostały zresetowane.\n")
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
