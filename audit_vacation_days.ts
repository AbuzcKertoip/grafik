/**
 * Skrypt: audit_vacation_days.ts
 * Audytuje rozbieżności w liczeniu dni urlopowych.
 *
 * Uruchomienie:
 *   npx tsx audit_vacation_days.ts              (bieżący rok)
 *   npx tsx audit_vacation_days.ts --year=2025  (konkretny rok)
 *
 * Sprawdza:
 *   1. Czy getBusinessDaysCount poprawnie liczy dni robocze
 *   2. Czy daty urlopy nie mają problemów z timezone/UTC
 *   3. Czy sum(businessDays) na wnioskach == to co system pokazuje jako "used"
 */

import { PrismaClient } from "@prisma/client"
import { addDays } from "date-fns"

const prisma = new PrismaClient()

const yearArg = process.argv.find(a => a.startsWith("--year="))
const year = yearArg ? parseInt(yearArg.split("=")[1]) : new Date().getFullYear()

// === Kopia getPolishHolidays ===
function getPolishHolidays(y: number): Date[] {
    const holidays: Date[] = []
    holidays.push(new Date(y, 0, 1))
    holidays.push(new Date(y, 0, 6))
    holidays.push(new Date(y, 4, 1))
    holidays.push(new Date(y, 4, 3))
    holidays.push(new Date(y, 7, 15))
    holidays.push(new Date(y, 10, 1))
    holidays.push(new Date(y, 10, 11))
    holidays.push(new Date(y, 11, 25))
    holidays.push(new Date(y, 11, 26))

    const a = y % 19
    const b = Math.floor(y / 100)
    const c = y % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const p = (h + l - 7 * m + 114)
    const month = Math.floor(p / 31) - 1
    const day = (p % 31) + 1

    const easter = new Date(y, month, day)
    holidays.push(easter)
    holidays.push(addDays(easter, 1))
    holidays.push(addDays(easter, 60))

    return holidays
}

function isHoliday(date: Date, holidays: Date[]): boolean {
    return holidays.some(h =>
        h.getDate() === date.getDate() &&
        h.getMonth() === date.getMonth() &&
        h.getFullYear() === date.getFullYear()
    )
}

function getBusinessDaysCount(startDate: Date | string, endDate: Date | string): number {
    let count = 0

    const normalizeDate = (d: Date | string) => {
        const date = new Date(d)
        // Normalizuj do lokalnego czasu, wytnij godzinę
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    }

    const current = normalizeDate(startDate)
    const end = normalizeDate(endDate)

    const holidays = [
        ...getPolishHolidays(current.getFullYear()),
        ...(current.getFullYear() !== end.getFullYear() ? getPolishHolidays(end.getFullYear()) : [])
    ]

    while (current <= end) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(current, holidays)) {
            count++
        }
        current.setDate(current.getDate() + 1)
    }

    return count
}

// === Kopia logiki z Intl (z holidays.ts) do porównania ===
function getBusinessDaysCountIntl(startDate: Date | string, endDate: Date | string): number {
    let count = 0

    const normalizeDate = (d: Date | string) => {
        const date = new Date(d);
        const warsawDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
        const [y, m, day] = warsawDate.split('-').map(Number);
        return new Date(y, m - 1, day, 0, 0, 0, 0);
    };

    const current = normalizeDate(startDate)
    const end = normalizeDate(endDate)

    const holidays = [
        ...getPolishHolidays(current.getFullYear()),
        ...(current.getFullYear() !== end.getFullYear() ? getPolishHolidays(end.getFullYear()) : [])
    ]

    while (current <= end) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(current, holidays)) {
            count++
        }
        current.setDate(current.getDate() + 1)
    }

    return count
}

function formatDate(d: Date | string): string {
    const date = new Date(d)
    return date.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" })
}

function getDayName(d: Date | string): string {
    const date = new Date(d)
    return date.toLocaleDateString("pl-PL", { weekday: "short", timeZone: "Europe/Warsaw" })
}

async function main() {
    console.log(`\n========================================`)
    console.log(`  AUDYT DNI URLOPOWYCH – ROK ${year}`)
    console.log(`========================================\n`)

    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

    // Pobierz wszystkie zatwierdzone urlopy w roku
    const allVacations = await prisma.vacation.findMany({
        where: {
            status: "APPROVED",
            type: { in: ["VACATION", "ON_DEMAND"] },
            startDate: { lte: endOfYear },
            endDate: { gte: startOfYear }
        },
        include: { user: true },
        orderBy: [{ userId: "asc" }, { startDate: "asc" }]
    })

    console.log(`Znaleziono ${allVacations.length} zatwierdzonych wniosków (VACATION/ON_DEMAND) w ${year}.\n`)

    // Grupuj po użytkowniku
    const byUser = new Map<number, typeof allVacations>()
    for (const v of allVacations) {
        const list = byUser.get(v.userId) || []
        list.push(v)
        byUser.set(v.userId, list)
    }

    let issues = 0

    for (const [userId, vacations] of byUser) {
        const userName = vacations[0].user.name || vacations[0].user.username

        // To co liczy system (getVacationStats) — używa filtra startDate >= 1.01 AND endDate <= 31.12
        // Odtwórzmy ten filtr:
        const statsFilteredVacations = vacations.filter(v => {
            const s = new Date(v.startDate)
            const e = new Date(v.endDate)
            return s >= startOfYear && e <= new Date(year, 11, 31)
        })

        // To co powinno być (urlopy, które nachodzą na rok — prawidłowy filtr)
        const correctFilteredVacations = vacations // już przefiltrowane w query

        let statsDays = 0
        let correctDays = 0

        const details: string[] = []

        for (const v of vacations) {
            const rawStart = v.startDate
            const rawEnd = v.endDate

            const daysSimple = getBusinessDaysCount(rawStart, rawEnd)
            const daysIntl = getBusinessDaysCountIntl(rawStart, rawEnd)

            const inStatsFilter = statsFilteredVacations.includes(v)
            if (inStatsFilter) statsDays += daysIntl
            correctDays += daysIntl

            // Sprawdź problemy z timezone
            const startStr = new Date(rawStart).toISOString()
            const endStr = new Date(rawEnd).toISOString()

            let flag = ""
            if (daysSimple !== daysIntl) {
                flag += " ⚠️ ROZBIEŻNOŚĆ TIMEZONE (prosty=${daysSimple} intl=${daysIntl})"
                issues++
            }
            if (!inStatsFilter) {
                flag += " ❌ POMIJANY PRZEZ FILTR STATS"
                issues++
            }

            // Sprawdź czy startDate/endDate nie ma dziwnej godziny (sugestia UTC offset)
            const startHour = new Date(rawStart).getUTCHours()
            const endHour = new Date(rawEnd).getUTCHours()
            if (startHour !== 0 || endHour !== 0) {
                flag += ` 🕐 Godzina w dacie: start=${startHour}:00 UTC, end=${endHour}:00 UTC`
            }

            details.push(
                `    #${v.id} ${v.type.padEnd(10)} ${formatDate(rawStart)} (${getDayName(rawStart)}) – ${formatDate(rawEnd)} (${getDayName(rawEnd)})` +
                `  → ${daysIntl} dni roboczych` +
                `  [DB: ${startStr} → ${endStr}]${flag}`
            )
        }

        const hasIssue = statsDays !== correctDays || details.some(d => d.includes("⚠️") || d.includes("❌") || d.includes("🕐"))

        if (hasIssue) {
            console.log(`\n🔴 ${userName} (ID: ${userId})`)
        } else {
            console.log(`\n✅ ${userName} (ID: ${userId})`)
        }

        console.log(`   Wnioski: ${vacations.length}, Dni wg systemu (filtr stats): ${statsDays}, Dni poprawne: ${correctDays}`)

        for (const d of details) {
            console.log(d)
        }
    }

    // Podsumowanie
    console.log(`\n========================================`)
    console.log(`  PODSUMOWANIE`)
    console.log(`========================================`)
    console.log(`  Użytkowników z urlopami: ${byUser.size}`)
    console.log(`  Wniosków: ${allVacations.length}`)
    console.log(`  Znalezionych problemów: ${issues}`)

    if (issues > 0) {
        console.log(`\n  ⚠️ Znaleziono problemy! Możliwe przyczyny:`)
        console.log(`     - Daty zapisane z przesunięciem UTC (godzina != 00:00)`)
        console.log(`     - Filtr w getVacationStats pomija urlopy przelewające się między latami`)
        console.log(`     - Normalizacja timezone w getBusinessDaysCount daje inne wyniki niż proste Date()`)
    } else {
        console.log(`\n  ✅ Brak problemów — liczenie jest spójne.`)
    }

    console.log(``)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
