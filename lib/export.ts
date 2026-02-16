import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export function exportWorkLogsToExcel(logs: any[], user: any, year: number, month: number) {
    const wb = XLSX.utils.book_new()

    // Prepare data rows
    const rows: any[] = []

    // Header Info
    rows.push(["ENFORMATIC", "", "", "KARTA PRACY", "", "", ""])
    rows.push([`Imię i Nazwisko: ${user.name || user.username}`, "", "", "", "", `Miesiąc: ${format(new Date(year, month - 1), "LLLL yyyy", { locale: pl })}`, ""])
    rows.push([""]) // Empty row

    // Table Headers
    rows.push(["Dzień", "Wykonywane czynności", "", "Czas pracy", "Projekt", "Nadgodziny", "Godziny pracy"])
    rows.push(["", "", "", "Ilość godzin", "", "", "od do"])

    // Data
    const daysInMonth = new Date(year, month, 0).getDate()
    let totalHours = 0
    let totalOvertime = 0

    for (let day = 1; day <= daysInMonth; day++) {
        const dayLogs = logs.filter((log: any) => new Date(log.date).getDate() === day)

        if (dayLogs.length === 0) {
            rows.push([day, "", "", "", "", ""])
            continue;
        }

        dayLogs.forEach((log: any, index: number) => {
            totalHours += log.duration
            totalOvertime += log.overtime
            rows.push([
                index === 0 ? day : "",
                log.description,
                "", // Spacer for merged description if needed?
                log.duration,
                log.project,
                log.overtime > 0 ? log.overtime : "",
                `${log.startTime}-${log.endTime}`
            ])
        })
    }

    // Summary
    rows.push([""])
    rows.push(["", "", "SUMA", totalHours, "", "Nadgodziny suma", totalOvertime])
    rows.push(["", "", "wg kalendarza", 168, "", "Godziny nocne", ""]) // Example 168 (should calculate working days)

    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Merges
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Logo area
        { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Name
        { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } }, // Month
        { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }, // Dzien Header
        { s: { r: 3, c: 1 }, e: { r: 4, c: 2 } }, // Czynnosci Header
    ]

    // Column widths
    ws['!cols'] = [
        { wch: 5 },  // Dzien
        { wch: 40 }, // Opis
        { wch: 10 },
        { wch: 10 }, // Czas
        { wch: 15 }, // Projekt
        { wch: 12 }, // Nadgodziny
        { wch: 15 }, // Od-Do
    ]

    XLSX.utils.book_append_sheet(wb, ws, "Karta Pracy")
    XLSX.writeFile(wb, `Karta_Pracy_${user.username}_${year}_${month}.xlsx`)
}
