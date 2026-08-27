"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    FileSpreadsheet, Loader2, Download, RefreshCw, CalendarCheck2, Bot, User as UserIcon
} from "lucide-react"
import { generateVacationBalanceExcel } from "@/lib/actions/excel-generator"
import { getVacationBalanceReportData, getLastVacationBalanceReport, VacationBalanceRow } from "@/lib/actions/reports"
import { saveVacationBalanceReport } from "@/lib/actions/reports"
import { toast } from "sonner"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

const MONTHS = [
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

interface LastReport {
    year: number
    month: number
    rowCount: number
    generatedBy: number | null
    fileBase64: string | null
    createdAt: Date
    updatedAt: Date
}

export function VacationBalanceReport() {
    const today = new Date()
    const [month, setMonth] = useState<string>((today.getMonth() + 1).toString())
    const [year, setYear] = useState<string>(today.getFullYear().toString())
    const [previewData, setPreviewData] = useState<VacationBalanceRow[] | null>(null)
    const [lastReport, setLastReport] = useState<LastReport | null>(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isCheckingLast, setIsCheckingLast] = useState(false)
    const [isPending, startTransition] = useTransition()

    const years = Array.from({ length: 5 }, (_, i) => (today.getFullYear() - 2 + i).toString())

    // Load last saved report info when month/year changes
    useEffect(() => {
        loadLastReport()
    }, [month, year])

    const loadLastReport = async () => {
        setIsCheckingLast(true)
        try {
            const res = await getLastVacationBalanceReport(parseInt(year), parseInt(month))
            setLastReport(res as LastReport | null)
        } catch {
            setLastReport(null)
        } finally {
            setIsCheckingLast(false)
        }
    }

    const handlePreview = async () => {
        setIsLoadingPreview(true)
        setPreviewData(null)
        try {
            const data = await getVacationBalanceReportData(parseInt(year), parseInt(month))
            setPreviewData(data)
        } catch {
            toast.error("Nie udało się załadować danych podglądu.")
        } finally {
            setIsLoadingPreview(false)
        }
    }

    const triggerDownload = (base64: string, filename: string) => {
        const byteCharacters = atob(base64)
        const byteArray = new Uint8Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i)
        }
        const blob = new Blob([byteArray], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }

    const handleGenerateAndDownload = async () => {
        setIsGenerating(true)
        try {
            const res = await generateVacationBalanceExcel(parseInt(year), parseInt(month))
            if (res.error) {
                toast.error(res.error)
                return
            }
            if (res.fileBase64 && res.rowCount !== undefined) {
                // Save to DB for history
                await saveVacationBalanceReport(parseInt(year), parseInt(month), res.fileBase64, res.rowCount)
                await loadLastReport()

                const monthPad = month.padStart(2, "0")
                triggerDownload(res.fileBase64, `raport-sald-urlopowych-${monthPad}-${year}.xlsx`)
                toast.success(`Wygenerowano raport dla ${res.rowCount} pracowników i zapisano w historii.`)
            }
        } catch (err) {
            console.error(err)
            toast.error("Błąd podczas generowania pliku Excel.")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownloadLast = () => {
        if (!lastReport?.fileBase64) {
            toast.error("Brak zapisanego pliku dla tego miesiąca.")
            return
        }
        const monthPad = month.padStart(2, "0")
        triggerDownload(lastReport.fileBase64, `raport-sald-urlopowych-${monthPad}-${year}.xlsx`)
        toast.success("Pobrano zapisany raport.")
    }

    const monthName = MONTHS[parseInt(month) - 1]

    return (
        <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Raport sald urlopowych (Excel)
                </CardTitle>
                <CardDescription>
                    Generuj miesięczny raport salda urlopowego każdego pracownika w formacie .xlsx.
                    Stan jest obliczany na koniec wybranego miesiąca — wnioski złożone na przyszłość
                    <strong> nie są odejmowane</strong>.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Controls */}
                <div className="flex flex-col sm:flex-row items-end gap-3">
                    <div className="space-y-1 w-full sm:w-48">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Miesiąc</label>
                        <Select value={month} onValueChange={(v) => { setMonth(v); setPreviewData(null) }}>
                            <SelectTrigger className="bg-background" id="balance-report-month">
                                <SelectValue placeholder="Wybierz miesiąc" />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1 w-full sm:w-32">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Rok</label>
                        <Select value={year} onValueChange={(v) => { setYear(v); setPreviewData(null) }}>
                            <SelectTrigger className="bg-background" id="balance-report-year">
                                <SelectValue placeholder="Wybierz rok" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        variant="outline"
                        onClick={handlePreview}
                        disabled={isLoadingPreview || isGenerating}
                        id="balance-report-preview-btn"
                    >
                        {isLoadingPreview
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ładuję...</>
                            : <><RefreshCw className="mr-2 h-4 w-4" />Podgląd</>}
                    </Button>

                    <Button
                        onClick={handleGenerateAndDownload}
                        disabled={isGenerating || isLoadingPreview}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        id="balance-report-generate-btn"
                    >
                        {isGenerating
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generuję...</>
                            : <><Download className="mr-2 h-4 w-4" />Generuj i pobierz .xlsx</>}
                    </Button>
                </div>

                {/* Last auto-saved report info */}
                {isCheckingLast && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Sprawdzam historię...
                    </div>
                )}

                {!isCheckingLast && lastReport && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-emerald-950/30 px-4 py-3">
                        <div className="flex items-center gap-2 flex-1">
                            {lastReport.generatedBy === null ? (
                                <Bot className="h-4 w-4 text-blue-500 shrink-0" />
                            ) : (
                                <UserIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                            )}
                            <span className="text-sm">
                                <span className="font-medium">Zapisany raport:</span>{" "}
                                {lastReport.rowCount} pracowników,{" "}
                                {format(new Date(lastReport.updatedAt), "d MMM yyyy, HH:mm", { locale: pl })}
                            </span>
                            <Badge variant="outline" className="text-xs ml-1">
                                {lastReport.generatedBy === null ? "Automatyczny" : "Ręczny"}
                            </Badge>
                        </div>
                        {lastReport.fileBase64 && (
                            <Button size="sm" variant="outline" onClick={handleDownloadLast} id="balance-report-download-last-btn">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Pobierz zapisany
                            </Button>
                        )}
                    </div>
                )}

                {/* Preview table */}
                {previewData && (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                            <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
                            Podgląd danych — stan na koniec <strong>{monthName} {year}</strong> ({previewData.length} pracowników)
                        </p>
                        <div className="rounded-md border overflow-auto max-h-[480px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="whitespace-nowrap">Pracownik</TableHead>
                                        <TableHead className="whitespace-nowrap">Dział</TableHead>
                                        <TableHead className="whitespace-nowrap">Kontrakt</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">Wymiar</TableHead>
                                        <TableHead className="text-right whitespace-nowrap text-muted-foreground">Zaległy</TableHead>
                                        <TableHead className="text-right whitespace-nowrap text-muted-foreground">Dodatkowe</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">Łącznie</TableHead>
                                        <TableHead className="text-right whitespace-nowrap">Wykorzystano</TableHead>
                                        <TableHead className="text-right whitespace-nowrap font-bold">Saldo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row) => (
                                        <TableRow key={row.userId}>
                                            <TableCell className="font-medium whitespace-nowrap">{row.name}</TableCell>
                                            <TableCell className="text-muted-foreground whitespace-nowrap">{row.department}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-xs">
                                                    {CONTRACT_LABELS[row.contractType] ?? row.contractType}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{row.annualLimit}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {row.carriedOver > 0 ? `+${row.carriedOver}` : "0"}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {row.additionalDays > 0 ? `+${row.additionalDays}` : "0"}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{row.totalAvailable}</TableCell>
                                            <TableCell className="text-right">{row.usedUpToMonth}</TableCell>
                                            <TableCell className={`text-right font-bold ${row.balance < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                {row.balance}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            * Wnioski złożone na miesiące po <strong>{monthName} {year}</strong> nie są odejmowane od salda.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
