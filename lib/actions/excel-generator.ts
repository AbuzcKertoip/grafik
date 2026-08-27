"use server"

import * as XLSX from "xlsx"
import { getVacationBalanceReportData, VacationBalanceRow } from "./reports"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const MONTH_NAMES = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
]

const CONTRACT_LABELS: Record<string, string> = {
    UOP: "UoP",
    UOP_PART_TIME: "UoP (niepełny etat)",
    B2B: "B2B",
    ZLECENIE: "Zlecenie",
    DZIELO: "Dzieło",
}

export async function generateVacationBalanceExcel(
    year: number,
    month: number
): Promise<{ error?: string; fileBase64?: string; rowCount?: number }> {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "HR", "MANAGER", "SZEF"].includes(session.user.role as string)) {
        return { error: "Brak uprawnień" }
    }

    const rows = await getVacationBalanceReportData(year, month)

    if (rows.length === 0) {
        return { error: "Brak pracowników do uwzględnienia w raporcie." }
    }

    const monthName = MONTH_NAMES[month - 1]
    const reportTitle = `Raport sald urlopowych – ${monthName} ${year}`
    const generatedAt = new Date().toLocaleString("pl-PL", {
        timeZone: "Europe/Warsaw",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    })
    const lastDay = new Date(year, month, 0).toLocaleDateString("pl-PL")

    const wsData: (string | number)[][] = []
    wsData.push([reportTitle])
    wsData.push([`Wygenerowano: ${generatedAt}`])
    wsData.push([`Stan na koniec ${monthName} ${year}. Uwzględniono wyłącznie zatwierdzone urlopy zakończone do dnia ${lastDay}.`])
    wsData.push([])
    wsData.push([
        "Lp.",
        "Pracownik",
        "Dział",
        "Typ kontraktu",
        "Wymiar roczny (dni)",
        "Zaległy urlop (dni)",
        "Dodatkowe dni",
        "Łącznie dostępnych",
        `Wykorzystano (do ${monthName})`,
        "Saldo (pozostało)"
    ])

    rows.forEach((row: VacationBalanceRow, index: number) => {
        wsData.push([
            index + 1,
            row.name,
            row.department,
            CONTRACT_LABELS[row.contractType] ?? row.contractType,
            row.annualLimit,
            row.carriedOver,
            row.additionalDays,
            row.totalAvailable,
            row.usedUpToMonth,
            row.balance
        ])
    })

    wsData.push([])
    const totalAvailableSum = rows.reduce((s, r) => s + r.totalAvailable, 0)
    const usedSum = rows.reduce((s, r) => s + r.usedUpToMonth, 0)
    const balanceSum = rows.reduce((s, r) => s + r.balance, 0)
    wsData.push(["", "SUMA", "", "", "", "", "", totalAvailableSum, usedSum, balanceSum])

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    ws["!cols"] = [
        { wch: 5 },
        { wch: 28 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 15 },
        { wch: 20 },
        { wch: 22 },
        { wch: 20 },
    ]

    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`)

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const fileBase64 = Buffer.from(buffer).toString("base64")

    return { fileBase64, rowCount: rows.length }
}
