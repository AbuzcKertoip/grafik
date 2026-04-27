"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Loader2, Download, CheckCircle, Shield } from "lucide-react"
import { generateMonthlyVacationReportDoc, getMonthlyVacationReport } from "@/lib/actions/doc-generator"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

export function MonthlyVacationReport() {
    const today = new Date()
    const [month, setMonth] = useState<string>((today.getMonth() + 1).toString())
    const [year, setYear] = useState<string>(today.getFullYear().toString())
    const [isLoading, setIsLoading] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(false)
    const [reportStatus, setReportStatus] = useState<{
        status: string | null;
        approvedAt?: string;
        approverName?: string;
        count?: number;
        fileBase64?: string;
    } | null>(null)

    const months = [
        "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
        "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ]

    const years = Array.from({ length: 5 }, (_, i) => (today.getFullYear() - 2 + i).toString())

    // Check report status whenever month/year changes
    useEffect(() => {
        checkReportStatus()
    }, [month, year])

    const checkReportStatus = async () => {
        setIsCheckingStatus(true)
        try {
            const res = await getMonthlyVacationReport(parseInt(year), parseInt(month))
            if (res && !res.error && res.status) {
                setReportStatus(res as any)
            } else {
                setReportStatus(null)
            }
        } catch {
            setReportStatus(null)
        } finally {
            setIsCheckingStatus(false)
        }
    }

    const handleDownload = async () => {
        setIsLoading(true)
        try {
            const res = await generateMonthlyVacationReportDoc(parseInt(year), parseInt(month))
            if (res.error) {
                toast.error(res.error)
                return
            }

            if (res.success && res.fileBase64) {
                // Decode base64 to Blob
                const byteCharacters = atob(res.fileBase64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

                // Create download link
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `wnioski-urlopowe-${month.padStart(2, '0')}-${year}.docx`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)

                toast.success(`Wygenerowano zbiór ${res.count} wniosków!`)
            }
        } catch (error) {
            console.error("Download fail:", error)
            toast.error("Błąd podczas generowania pliku docx")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDownloadApproved = () => {
        if (!reportStatus?.fileBase64) {
            toast.error("Brak pliku do pobrania.")
            return
        }

        const byteCharacters = atob(reportStatus.fileBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `wnioski-urlopowe-zatwierdzone-${month.padStart(2, '0')}-${year}.docx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success("Pobrano zatwierdzony raport.")
    }

    const isApproved = reportStatus?.status === "APPROVED"

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Zbiorczy raport wniosków
                </CardTitle>
                <CardDescription>
                    Wygeneruj wszystkie zatwierdzone wnioski z danego miesiąca jako jeden plik DOCX, gotowy do druku.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="space-y-1 w-full sm:w-48">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Miesiąc</label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Wybierz miesiąc" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1 w-full sm:w-32">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Rok</label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="bg-background">
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
                        onClick={handleDownload} 
                        disabled={isLoading}
                        variant="outline"
                        className="w-full sm:w-auto mt-4 sm:mt-0"
                    >
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generuję...</>
                        ) : (
                            <><Download className="mr-2 h-4 w-4" /> Pobierz .docx</>
                        )}
                    </Button>
                </div>

                {/* Status zatwierdzonego raportu */}
                {isCheckingStatus && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sprawdzam status zatwierdzenia...
                    </div>
                )}

                {isApproved && reportStatus && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Zatwierdzone przez zarząd</span>
                            <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 text-xs">
                                {reportStatus.count} wniosków
                            </Badge>
                        </div>
                        <div className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                            <p>Zatwierdził: <span className="font-medium">{reportStatus.approverName}</span></p>
                            {reportStatus.approvedAt && (
                                <p>Data zatwierdzenia: <span className="font-medium">{format(new Date(reportStatus.approvedAt), "d MMMM yyyy, HH:mm", { locale: pl })}</span></p>
                            )}
                        </div>
                        <Button 
                            onClick={handleDownloadApproved}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Shield className="mr-2 h-4 w-4" /> Pobierz zatwierdzoną wersję .docx
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

