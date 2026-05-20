/**
 * Skrypt diagnostyczny: Audyt puli urlopowej wszystkich pracowników
 * 
 * Sprawdza:
 * 1. Wnioski APPROVED vs suma dni roboczych
 * 2. Nakładające się wnioski (duplikaty)
 * 3. Osierocone wpisy ScheduleDay bez powiązanego wniosku
 * 4. Rozbieżności między wnioskami a wpisami w grafiku
 * 
 * Uruchomienie: npx tsx scripts/audit_vacation_balance.ts
 */

import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";

const prisma = new PrismaClient();

// ---- Holidays (copied from lib/holidays.ts to keep script standalone) ----
function getPolishHolidays(year: number): Date[] {
    const holidays: Date[] = [];
    holidays.push(new Date(year, 0, 1));
    holidays.push(new Date(year, 0, 6));
    holidays.push(new Date(year, 4, 1));
    holidays.push(new Date(year, 4, 3));
    holidays.push(new Date(year, 7, 15));
    holidays.push(new Date(year, 10, 1));
    holidays.push(new Date(year, 10, 11));
    holidays.push(new Date(year, 11, 25));
    holidays.push(new Date(year, 11, 26));

    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const p = (h + l - 7 * m + 114);
    const month = Math.floor(p / 31) - 1;
    const day = (p % 31) + 1;

    const easter = new Date(year, month, day);
    holidays.push(easter);
    holidays.push(addDays(easter, 1));
    holidays.push(addDays(easter, 60));
    return holidays;
}

function isHoliday(date: Date, holidays: Date[]): boolean {
    return holidays.some(h =>
        h.getDate() === date.getDate() &&
        h.getMonth() === date.getMonth() &&
        h.getFullYear() === date.getFullYear()
    );
}

function getBusinessDaysCount(startDate: Date | string, endDate: Date | string): number {
    let count = 0;
    const normalizeDate = (d: Date | string) => {
        const date = new Date(d);
        const warsawDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
        const [y, m, day] = warsawDate.split('-').map(Number);
        return new Date(y, m - 1, day, 0, 0, 0, 0);
    };
    const current = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    const holidays = [
        ...getPolishHolidays(current.getFullYear()),
        ...(current.getFullYear() !== end.getFullYear() ? getPolishHolidays(end.getFullYear()) : [])
    ];
    while (current <= end) {
        const dow = current.getDay();
        if (dow !== 0 && dow !== 6 && !isHoliday(current, holidays)) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function formatDate(d: Date): string {
    return new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(d));
}

// ---- Types ----
const VACATION_TYPES: Record<string, string> = {
    VACATION: "Wypoczynkowy",
    ON_DEMAND: "Na żądanie",
    SPECIAL_LEAVE: "Okolicznościowy",
    CHILDCARE: "Opiekuńczy",
    ADDITIONAL: "Dodatkowy",
    UNPAID: "Bezpłatny",
    OVERTIME: "Odbiór nadgodzin",
    SICK: "L4/Chorobowe",
};

// ---- Main ----
async function main() {
    const YEAR = new Date().getFullYear(); // 2026
    console.log(`\n${"=".repeat(80)}`);
    console.log(`  AUDYT PULI URLOPOWEJ — ROK ${YEAR}`);
    console.log(`${"=".repeat(80)}\n`);

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            vacationDaysLimit: true,
            carriedOverVacationDays: true,
            additionalVacationDays: true,
            contractType: true,
            has10YearsSeniority: true,
            hasChildren: true,
            department: { select: { name: true } },
        },
        orderBy: { name: 'asc' }
    });

    const yearStart = new Date(YEAR, 0, 1);
    const yearEnd = new Date(YEAR, 11, 31);

    let issuesFound = 0;
    const issues: string[] = [];

    for (const user of users) {
        const displayName = user.name || user.username;

        // 1. Get all APPROVED vacations for this year (VACATION + ON_DEMAND that count towards pool)
        const allVacations = await prisma.vacation.findMany({
            where: {
                userId: user.id,
                status: 'APPROVED',
                startDate: { gte: yearStart },
                endDate: { lte: yearEnd },
            },
            orderBy: { startDate: 'asc' }
        });

        const poolVacations = allVacations.filter(v => v.type === 'VACATION' || v.type === 'ON_DEMAND');
        const otherVacations = allVacations.filter(v => v.type !== 'VACATION' && v.type !== 'ON_DEMAND');

        // Calculate business days for pool vacations
        const poolDetails = poolVacations.map(v => ({
            id: v.id,
            type: v.type,
            start: formatDate(v.startDate),
            end: formatDate(v.endDate),
            days: getBusinessDaysCount(v.startDate, v.endDate),
            createdAt: formatDate(v.createdAt),
        }));
        const totalPoolDays = poolDetails.reduce((sum, d) => sum + d.days, 0);

        // Calculate base limit (same logic as hr.ts)
        let baseLimit = user.vacationDaysLimit;
        let carriedOver = user.carriedOverVacationDays || 0;
        if (user.contractType === 'B2B') {
            carriedOver = 0;
        } else if (user.contractType === 'UOP' || !user.contractType) {
            if (baseLimit === 26 && !user.has10YearsSeniority) baseLimit = 20;
            else if (baseLimit === 20 && user.has10YearsSeniority) baseLimit = 26;
        }
        const totalLimit = baseLimit + carriedOver;
        const remaining = totalLimit - totalPoolDays;

        // 2. Check for overlapping vacations
        const overlaps: string[] = [];
        for (let i = 0; i < poolVacations.length; i++) {
            for (let j = i + 1; j < poolVacations.length; j++) {
                const a = poolVacations[i];
                const b = poolVacations[j];
                if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
                    overlaps.push(
                        `  ⚠️  NAKŁADANIE: Wniosek #${a.id} (${formatDate(a.startDate)}–${formatDate(a.endDate)}) ` +
                        `nakłada się z #${b.id} (${formatDate(b.startDate)}–${formatDate(b.endDate)})`
                    );
                }
            }
        }

        // 3. Check orphaned ScheduleDay entries (type U/VACATION without linked vacation)
        const LEAVE_SCHEDULE_TYPES = ['VACATION', 'ON_DEMAND', 'SPECIAL_LEAVE', 'CHILDCARE', 'ADDITIONAL', 'OVERTIME'];
        const scheduleDays = await prisma.scheduleDay.findMany({
            where: {
                userId: user.id,
                date: { gte: yearStart, lte: yearEnd },
                type: { in: LEAVE_SCHEDULE_TYPES },
            },
            orderBy: { date: 'asc' }
        });

        const orphanedDays = scheduleDays.filter(sd => !sd.vacationId);
        const linkedDays = scheduleDays.filter(sd => sd.vacationId);

        // 4. Check if linked schedule days point to existing vacations
        const linkedVacationIds = new Set(allVacations.map(v => v.id));
        const danglingDays = linkedDays.filter(sd => !linkedVacationIds.has(sd.vacationId!));

        // 5. Check schedule day count vs vacation day count
        const scheduleVacDays = scheduleDays.filter(sd => sd.type === 'VACATION' || sd.type === 'ON_DEMAND');
        const scheduleDayCount = scheduleVacDays.length;

        const hasIssues = overlaps.length > 0 || orphanedDays.length > 0 || danglingDays.length > 0 || scheduleDayCount !== totalPoolDays;

        if (hasIssues || poolVacations.length > 0) {
            console.log(`─── ${displayName} (ID: ${user.id}, Dział: ${user.department?.name || "brak"}) ───`);
            console.log(`  Pula: ${totalLimit} dni (baza: ${baseLimit}, przeniesione: ${carriedOver})`);
            console.log(`  Wnioski APPROVED (urlop wyp. + na żądanie): ${poolVacations.length}`);

            if (poolDetails.length > 0) {
                console.log(`  Szczegóły wniosków:`);
                for (const d of poolDetails) {
                    console.log(`    #${d.id} ${VACATION_TYPES[d.type] || d.type}: ${d.start} – ${d.end} = ${d.days} dni rob. (złożony: ${d.createdAt})`);
                }
            }

            console.log(`  Suma dni z wniosków: ${totalPoolDays}`);
            console.log(`  Wpisy w grafiku (U/ON_DEMAND): ${scheduleDayCount}`);
            console.log(`  Pozostało: ${remaining} dni`);

            if (otherVacations.length > 0) {
                console.log(`  Inne typy urlopów:`);
                for (const v of otherVacations) {
                    const days = getBusinessDaysCount(v.startDate, v.endDate);
                    console.log(`    #${v.id} ${VACATION_TYPES[v.type] || v.type}: ${formatDate(v.startDate)} – ${formatDate(v.endDate)} = ${days} dni`);
                }
            }

            // Problems
            if (overlaps.length > 0) {
                issuesFound += overlaps.length;
                overlaps.forEach(o => { console.log(o); issues.push(`${displayName}: ${o.trim()}`); });
            }

            if (orphanedDays.length > 0) {
                issuesFound++;
                const msg = `  ⚠️  OSIEROCONE WPISY W GRAFIKU: ${orphanedDays.length} dni (bez powiązanego wniosku)`;
                console.log(msg);
                for (const od of orphanedDays) {
                    console.log(`    📅 ${formatDate(od.date)} typ: ${od.type} (ScheduleDay ID: ${od.id})`);
                }
                issues.push(`${displayName}: ${orphanedDays.length} osieroconych wpisów w grafiku`);
            }

            if (danglingDays.length > 0) {
                issuesFound++;
                const msg = `  ⚠️  WPISY WSKAZUJĄCE NA NIEISTNIEJĄCE WNIOSKI: ${danglingDays.length}`;
                console.log(msg);
                for (const dd of danglingDays) {
                    console.log(`    📅 ${formatDate(dd.date)} → vacationId: ${dd.vacationId} (nie istnieje/usunięty)`);
                }
                issues.push(`${displayName}: ${danglingDays.length} wpisów z brakującym wnioskiem`);
            }

            if (scheduleDayCount !== totalPoolDays) {
                issuesFound++;
                const diff = scheduleDayCount - totalPoolDays;
                const msg = `  ⚠️  ROZBIEŻNOŚĆ: Grafik ma ${scheduleDayCount} dni, wnioski mają ${totalPoolDays} dni (różnica: ${diff > 0 ? '+' : ''}${diff})`;
                console.log(msg);
                issues.push(`${displayName}: rozbieżność grafik(${scheduleDayCount}) vs wnioski(${totalPoolDays}), diff=${diff}`);
            }

            console.log();
        }
    }

    // Summary
    console.log(`${"=".repeat(80)}`);
    if (issuesFound === 0) {
        console.log(`  ✅ BRAK PROBLEMÓW — wszystko wygląda poprawnie.`);
    } else {
        console.log(`  ❌ ZNALEZIONO ${issuesFound} PROBLEMÓW:`);
        issues.forEach(i => console.log(`    • ${i}`));
        console.log(`\n  Aby naprawić, możesz:`);
        console.log(`    1. Usunąć osierocone ScheduleDay (bez powiązanego wniosku)`);
        console.log(`    2. Usunąć zduplikowane/nakładające się wnioski`);
        console.log(`    3. Przeliczyć pulę na podstawie istniejących wniosków`);
    }
    console.log(`${"=".repeat(80)}\n`);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error("Błąd:", e);
    prisma.$disconnect();
    process.exit(1);
});
