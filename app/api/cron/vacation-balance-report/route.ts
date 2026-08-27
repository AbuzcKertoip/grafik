import { NextResponse } from "next/server"
import { getVacationBalanceReportData, saveVacationBalanceReport } from "@/lib/actions/reports"
import { createLog } from "@/lib/actions/log-actions"
import * as XLSX from "xlsx"

const MONTH_NAMES = [
    "Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec",
    "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien"
]

const MONTH_NAMES_PL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
]

const CONTRACT_LABELS: Record<string, string> = {
    UOP: "UoP",
    UOP_PART_TIME: "UoP (niepelny etat)",
    B2B: "B2B",
    ZLECENIE: "Zlecenie",
    DZIELO: "Dzielo",
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 })
    }

    try {
        // Generate report for the PREVIOUS month
        const now = new Date()
        const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const year = reportDate.getFullYear()
        const month = reportDate.getMonth() + 1

        const rows = await getVacationBalanceReportData(year, month)

        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Brak pracownikow." }, { status: 400 })
        }

        const monthNamePL = MONTH_NAMES_PL[month - 1]
        const monthName = MONTH_NAMES[month - 1]
        const reportTitle = `Raport sald urlopowych - ${monthNamePL} ${year}`
        const generatedAt = new Date().toLocaleString("pl-PL", {
            timeZone: "Europe/Warsaw",
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        })
        const lastDay = new Date(year, month, 0).toLocaleDateString("pl-PL")

        const wsData: (string | number)[][] = []
        wsData.push([reportTitle])
        wsData.push([`Wygenerowano: ${generatedAt}`])
        wsData.push([`Stan na koniec ${monthNamePL} ${year}. Uwzgledniono wylacznie zatwierdzone urlopy zakonczone do dnia ${lastDay}.`])
        wsData.push([])
        wsData.push([
            "Lp.", "Pracownik", "Dzial", "Typ kontraktu",
            "Wymiar roczny (dni)", "Zalegly urlop (dni)", "Dodatkowe dni",
            "Lacznie dostepnych", `Wykorzystano (do ${monthNamePL})`, "Saldo (pozostalo)"
        ])
        rows.forEach((row, index) => {
            wsData.push([
                index + 1, row.name, row.department,
                CONTRACT_LABELS[row.contractType] ?? row.contractType,
                row.annualLimit, row.carriedOver, row.additionalDays,
                row.totalAvailable, row.usedUpToMonth, row.balance
            ])
        })
        wsData.push([])
        wsData.push([
            "", "SUMA", "", "", "", "", "",
            rows.reduce((s, r) => s + r.totalAvailable, 0),
            rows.reduce((s, r) => s + r.usedUpToMonth, 0),
            rows.reduce((s, r) => s + r.balance, 0)
        ])

        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws["!cols"] = [
            { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
            { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 20 },
        ]
        ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
        ]
        XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`)

        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
        const fileBase64 = Buffer.from(buffer).toString("base64")

        await saveVacationBalanceReport(year, month, fileBase64, rows.length, null)

        await createLog({
            action: "CRON_VACATION_BALANCE_REPORT",
            description: `Automatyczny raport sald urlopowych za ${monthNamePL} ${year} - ${rows.length} pracownikow.`,
            userId: null,
            errorCodeKey: "CRON_VACATION_BALANCE_REPORT",
        })

        return NextResponse.json({
            success: true,
            message: `Raport sald urlopowych za ${monthNamePL} ${year} wygenerowany (${rows.length} pracownikow).`
        })

    } catch (error: any) {
        console.error("Cron VacationBalanceReport Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
