import { addDays } from "date-fns"

export function getPolishHolidays(year: number): Date[] {
    const holidays: Date[] = []

    // Fixed holidays
    holidays.push(new Date(year, 0, 1)) // New Year
    holidays.push(new Date(year, 0, 6)) // Epiphany
    holidays.push(new Date(year, 4, 1)) // Labor Day
    holidays.push(new Date(year, 4, 3)) // Constitution Day
    holidays.push(new Date(year, 7, 15)) // Assumption of Mary
    holidays.push(new Date(year, 10, 1)) // All Saints' Day
    holidays.push(new Date(year, 10, 11)) // Independence Day
    holidays.push(new Date(year, 11, 25)) // Christmas Day
    holidays.push(new Date(year, 11, 26)) // Second Day of Christmas

    // Easter calculation (Meeus/Jones/Butcher's algorithm)
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
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
    const month = Math.floor(p / 31) - 1 // 0-indexed month
    const day = (p % 31) + 1

    const easter = new Date(year, month, day)
    holidays.push(easter)
    holidays.push(addDays(easter, 1)) // Easter Monday
    holidays.push(addDays(easter, 60)) // Corpus Christi

    return holidays
}

export function getSaturdayHolidaysCount(year: number): number {
    const holidays = getPolishHolidays(year)
    return holidays.filter(h => h.getDay() === 6).length
}

export function getPolishHolidaysWithNames(year: number): { date: Date, name: string }[] {
    const holidays: { date: Date, name: string }[] = []

    // Fixed holidays
    holidays.push({ date: new Date(year, 0, 1), name: "Nowy Rok" })
    holidays.push({ date: new Date(year, 0, 6), name: "Święto Trzech Króli" })
    holidays.push({ date: new Date(year, 4, 1), name: "Święto Pracy" })
    holidays.push({ date: new Date(year, 4, 3), name: "Święto Konstytucji 3 Maja" })
    holidays.push({ date: new Date(year, 7, 15), name: "Wniebowzięcie NMP" })
    holidays.push({ date: new Date(year, 10, 1), name: "Wszystkich Świętych" })
    holidays.push({ date: new Date(year, 10, 11), name: "Święto Niepodległości" })
    holidays.push({ date: new Date(year, 11, 25), name: "Pierwszy dzień Bożego Narodzenia" })
    holidays.push({ date: new Date(year, 11, 26), name: "Drugi dzień Bożego Narodzenia" })

    // Easter
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
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

    const easter = new Date(year, month, day)
    holidays.push({ date: easter, name: "Wielkanoc" })
    holidays.push({ date: addDays(easter, 1), name: "Poniedziałek Wielkanocny" })
    holidays.push({ date: addDays(easter, 60), name: "Boże Ciało" })

    return holidays
}

export function getSaturdayHolidaysDetails(year: number): { date: Date, name: string }[] {
    const holidays = getPolishHolidaysWithNames(year)
    return holidays.filter(h => h.date.getDay() === 6)
}

export function isHoliday(date: Date, holidays: Date[]): boolean {
    return holidays.some(h =>
        h.getDate() === date.getDate() &&
        h.getMonth() === date.getMonth() &&
        h.getFullYear() === date.getFullYear()
    )
}

export function getBusinessDaysCount(startDate: Date | string, endDate: Date | string): number {
    let count = 0
    
    // Normalize to Europe/Warsaw to avoid timezone shifts during processing
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

    const current = normalizeDate(startDate);
    const end = normalizeDate(endDate);

    // Wczytaj raz tablicę na obydwa obejmujące lata w pętli
    const holidays = [
        ...getPolishHolidays(current.getFullYear()),
        ...(current.getFullYear() !== end.getFullYear() ? getPolishHolidays(end.getFullYear()) : [])
    ]

    while (current <= end) {
        const dayOfWeek = current.getDay()

        if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday(current, holidays)) {
            current.setDate(current.getDate() + 1)
            continue
        }

        count++
        current.setDate(current.getDate() + 1)
    }

    return count
}
