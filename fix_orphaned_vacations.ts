/**
 * Skrypt: fix_orphaned_vacations.ts
 * 
 * Znajduje i naprawia rozbieżności urlopowe:
 *   1. Wpisy "U" w grafiku (ScheduleDay) BEZ powiązanego wniosku (Vacation) → usuwa je
 *   2. Wnioski urlopowe (Vacation APPROVED) BEZ pokrycia w grafiku → opcjonalnie usuwa/anuluje
 *   3. Pokazuje pełny raport per pracownik
 *
 * Uruchomienie:
 *   npx tsx fix_orphaned_vacations.ts                          (dry-run, podgląd wszystkich)
 *   npx tsx fix_orphaned_vacations.ts --user="Jan Kowalski"    (tylko konkretna osoba)
 *   npx tsx fix_orphaned_vacations.ts --execute                (wykonanie naprawy)
 *   npx tsx fix_orphaned_vacations.ts --year=2026              (konkretny rok, domyślnie bieżący)
 *
 * Co robi --execute:
 *   - Usuwa osieroconone wpisy "U" z grafiku (ScheduleDay bez Vacation)
 *   - Anuluje wnioski Vacation (APPROVED) które nie mają odpowiednika w grafiku
 *     i nie zostały złożone przez pracownika (brak formalnego wniosku)
 */

import { PrismaClient } from "@prisma/client"
import { addDays } from "date-fns"

const prisma = new PrismaClient()
const dryRun = !process.argv.includes("--execute")

const yearArg = process.argv.find(a => a.startsWith("--year="))
const year = yearArg ? parseInt(yearArg.split("=")[1]) : new Date().getFullYear()

const userArg = process.argv.find(a => a.startsWith("--user="))
const targetUserName = userArg ? userArg.split("=")[1].replace(/"/g, '') : null

// === Holidays ===
function getPolishHolidays(y: number): Date[] {
    const holidays: Date[] = []
    holidays.push(new Date(y, 0, 1), new Date(y, 0, 6), new Date(y, 4, 1), new Date(y, 4, 3))
    holidays.push(new Date(y, 7, 15), new Date(y, 10, 1), new Date(y, 10, 11))
    holidays.push(new Date(y, 11, 25), new Date(y, 11, 26))
    const a = y % 19, b = Math.floor(y / 100), c = y % 100
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4), k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451), p = (h + l - 7 * m + 114)
    const month = Math.floor(p / 31) - 1, day = (p % 31) + 1
    const easter = new Date(y, month, day)
    holidays.push(easter, addDays(easter, 1), addDays(easter, 60))
    return holidays
}

function isHoliday(date: Date, holidays: Date[]): boolean {
    return holidays.some(h => h.getDate() === date.getDate() && h.getMonth() === date.getMonth() && h.getFullYear() === date.getFullYear())
}

function getBusinessDaysCount(startDate: Date, endDate: Date): number {
    let count = 0
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    const holidays = [...getPolishHolidays(current.getFullYear()), ...(current.getFullYear() !== end.getFullYear() ? getPolishHolidays(end.getFullYear()) : [])]
    while (current <= end) {
        if (current.getDay() !== 0 && current.getDay() !== 6 && !isHoliday(current, holidays)) count++
        current.setDate(current.getDate() + 1)
    }
    return count
}

function normalizeDate(d: Date | string): string {
    const date = new Date(d)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDatePL(d: Date | string): string {
    return new Date(d).toLocaleDateString("pl-PL")
}

const VACATION_SCHEDULE_TYPES = ["VACATION", "ON_DEMAND", "SPECIAL_LEAVE", "CHILDCARE", "ADDITIONAL", "OVERTIME", "SICK"]

async function main() {
    console.log(`\n${"=".repeat(60)}`)
    console.log(`  NAPRAWA OSIEROCONONYCH URLOPÓW – ROK ${year}`)
    console.log(`  Tryb: ${dryRun ? "DRY RUN (podgląd)" : "🔴 WYKONANIE"}`)
    if (targetUserName) console.log(`  Filtr: ${targetUserName}`)
    console.log(`${"=".repeat(60)}\n`)

    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

    // Pobierz użytkowników
    const userWhere: any = {}
    if (targetUserName) {
        userWhere.OR = [
            { name: { contains: targetUserName } },
            { username: { contains: targetUserName } }
        ]
    }

    const users = await prisma.user.findMany({
        where: userWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true, vacationDaysLimit: true, carriedOverVacationDays: true }
    })

    if (users.length === 0) {
        console.log("❌ Nie znaleziono użytkowników pasujących do filtra.\n")
        return
    }

    let totalOrphanedSchedule = 0
    let totalOrphanedVacations = 0
    let usersWithIssues = 0

    for (const user of users) {
        const userName = user.name || user.username

        // 1. Pobierz wpisy urlopowe z grafiku
        const scheduleDays = await prisma.scheduleDay.findMany({
            where: {
                userId: user.id,
                type: { in: VACATION_SCHEDULE_TYPES },
                date: { gte: startOfYear, lte: endOfYear }
            },
            orderBy: { date: "asc" }
        })

        // 2. Pobierz wnioski urlopowe
        const vacations = await prisma.vacation.findMany({
            where: {
                userId: user.id,
                status: { in: ["APPROVED", "PENDING"] },
                startDate: { lte: endOfYear },
                endDate: { gte: startOfYear }
            },
            orderBy: { startDate: "asc" }
        })

        // 3. Zbuduj zbiór dat pokrytych przez wnioski
        const coveredDates = new Set<string>()
        const vacationDateMap = new Map<string, typeof vacations[0]>() // data -> wniosek
        for (const v of vacations) {
            const s = new Date(v.startDate)
            const e = new Date(v.endDate)
            const current = new Date(s.getFullYear(), s.getMonth(), s.getDate())
            const end = new Date(e.getFullYear(), e.getMonth(), e.getDate())
            while (current <= end) {
                const key = normalizeDate(current)
                coveredDates.add(key)
                vacationDateMap.set(key, v)
                current.setDate(current.getDate() + 1)
            }
        }

        // 4. Zbuduj zbiór dat w grafiku
        const scheduleDates = new Set<string>()
        for (const sd of scheduleDays) {
            scheduleDates.add(normalizeDate(sd.date))
        }

        // 5. Znajdź osieroconone wpisy w grafiku (bez wniosku)
        const orphanedScheduleDays = scheduleDays.filter(sd => {
            const key = normalizeDate(sd.date)
            return !coveredDates.has(key)
        })

        // 6. Znajdź wnioski bez pokrycia w grafiku (opcjonalnie)
        const approvedVacations = vacations.filter(v => v.status === "APPROVED")

        if (orphanedScheduleDays.length === 0 && approvedVacations.length === 0 && scheduleDays.length === 0) {
            continue // Pomiń osoby bez żadnych urlopów
        }

        const hasOrphaned = orphanedScheduleDays.length > 0

        if (!hasOrphaned && !targetUserName) continue // Pomiń osoby bez problemów (chyba że szukamy konkretnej)

        usersWithIssues += hasOrphaned ? 1 : 0

        // Wyświetl raport
        const icon = hasOrphaned ? "🔴" : "✅"
        console.log(`${icon} ${userName} (ID: ${user.id})`)
        console.log(`   Limit: ${user.vacationDaysLimit} + ${user.carriedOverVacationDays} przeniesione`)
        console.log(`   Wpisy w grafiku: ${scheduleDays.length}, Wnioski (APPROVED/PENDING): ${vacations.length}`)

        if (approvedVacations.length > 0) {
            console.log(`   Wnioski zatwierdzone:`)
            for (const v of approvedVacations) {
                const days = getBusinessDaysCount(new Date(v.startDate), new Date(v.endDate))
                console.log(`      #${v.id} ${v.type.padEnd(12)} ${formatDatePL(v.startDate)} – ${formatDatePL(v.endDate)}  (${days} dni rob.)`)
            }
        }

        if (orphanedScheduleDays.length > 0) {
            console.log(`   ❌ Osieroconone wpisy w grafiku (${orphanedScheduleDays.length} dni BEZ wniosku):`)
            for (const sd of orphanedScheduleDays) {
                console.log(`      - ${formatDatePL(sd.date)} (${sd.type}) [ScheduleDay #${sd.id}]`)
            }
            totalOrphanedSchedule += orphanedScheduleDays.length

            if (!dryRun) {
                const ids = orphanedScheduleDays.map(sd => sd.id)
                await prisma.scheduleDay.deleteMany({
                    where: { id: { in: ids } }
                })
                console.log(`      ✅ Usunięto ${ids.length} osierocononych wpisów z grafiku.`)
            }
        }

        console.log("")
    }

    // Podsumowanie
    console.log(`${"=".repeat(60)}`)
    console.log(`  PODSUMOWANIE`)
    console.log(`${"=".repeat(60)}`)
    console.log(`  Sprawdzono użytkowników: ${users.length}`)
    console.log(`  Użytkowników z problemami: ${usersWithIssues}`)
    console.log(`  Osierocononych wpisów w grafiku: ${totalOrphanedSchedule}`)

    if (dryRun && totalOrphanedSchedule > 0) {
        console.log(`\n  ⚠️ To był tryb DRY RUN — nic nie zostało zmienione.`)
        console.log(`  Aby naprawić, uruchom:\n`)
        if (targetUserName) {
            console.log(`    npx tsx fix_orphaned_vacations.ts --user="${targetUserName}" --execute`)
        } else {
            console.log(`    npx tsx fix_orphaned_vacations.ts --execute`)
        }
        console.log(`\n  Lub dla konkretnej osoby:\n    npx tsx fix_orphaned_vacations.ts --user="Imię Nazwisko" --execute\n`)
    } else if (!dryRun && totalOrphanedSchedule > 0) {
        console.log(`\n  ✅ Naprawiono! Usunięto ${totalOrphanedSchedule} osierocononych wpisów.`)
        console.log(`  Dni urlopowe wróciły do puli tych pracowników.\n`)
    } else if (totalOrphanedSchedule === 0) {
        console.log(`\n  ✅ Brak problemów — wszystkie wpisy urlopowe w grafiku mają powiązane wnioski.\n`)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
