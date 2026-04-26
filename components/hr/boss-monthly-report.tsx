"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Loader2, Download, CheckCircle, Shield, Clock } from "lucide-react"
import { generateMonthlyVacationReportDoc, approveMonthlyVacationReport, getMonthlyVacationReport } from "@/lib/actions/doc-generator"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

export function BossMonthlyReport() {
    const today = new Date()
    const [month, setMonth] = useState<string>((today.getMonth() + 1).toString())
    const [year, setYear] = useState<string>(today.getFullYear().toString())
    const [isLoading, setIsLoading] = useState(false)
    const [isApproving, setIsApproving] = useState(false)
    const [isCheckingStatus, setIsCheckingStatus] = useState(false)
    const [previewCount, setPreviewCount] = useState<number | null>(null)
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
            if (res && !res.error) {
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

    const handlePreview = async () => {
        setIsLoading(true)
        try {
            const res = await generateMonthlyVacationReportDoc(parseInt(year), parseInt(month))
            if (res.error) {
                toast.error(res.error)
                setPreviewCount(null)
                return
            }
            if (res.success) {
                setPreviewCount(res.count || 0)
                toast.success(`Znaleziono ${res.count} wniosków do zatwierdzenia.`)
            }
        } catch (error) {
            toast.error("Błąd podczas generowania podglądu")
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async () => {
        if (!confirm(`Czy na pewno chcesz zatwierdzić zestawienie za ${months[parseInt(month) - 1]} ${year}?\n\nPo zatwierdzeniu na każdym wniosku pojawi się adnotacja "Zatwierdzone przez zarząd" i raport zostanie udostępniony do pobrania.`)) return

        setIsApproving(true)
        try {
            const res = await approveMonthlyVacationReport(parseInt(year), parseInt(month))
            if (res.error) {
                toast.error(res.error)
                return
            }
            if (res.success) {
                toast.success(`Zatwierdzono zestawienie (${res.count} wniosków). Powiadomienie wysłane do HR.`)
                await checkReportStatus()
            }
        } catch (error) {
            toast.error("Błąd podczas zatwierdzania")
        } finally {
            setIsApproving(false)
        }
    }

    const handleDownload = () => {
        if (!reportStatus?.fileBase64) {
            toast.error("Brak pliku do pobrania. Najpierw zatwierdź zestawienie.")
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
        <Card className="border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                    Zatwierdzanie zestawień urlopowych
                </CardTitle>
                <CardDescription>
                    Jako szef możesz zatwierdzić miesięczne zestawienie wniosków urlopowych. Po zatwierdzeniu na każdym wniosku pojawi się adnotacja &quot;Zatwierdzone przez zarząd&quot; i raport zostanie udostępniony do pobrania przez dział HR.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="space-y-1 w-full sm:w-48">
                        <label className="text-xs font-semibold text-muted-foreground ml-1">Miesiąc</label>
                        <Select value={month} onValueChange={(val) => { setMonth(val); setPreviewCount(null); }}>
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
                        <Select value={year} onValueChange={(val) => { setYear(val); setPreviewCount(null); }}>
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
                        onClick={handlePreview} 
                        disabled={isLoading || isCheckingStatus}
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sprawdzam...</>
                        ) : (
                            <><FileText className="mr-2 h-4 w-4" /> Sprawdź wnioski</>
                        )}
                    </Button>
                </div>

                {/* Status info */}
                {isCheckingStatus && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sprawdzam status...
                    </div>
                )}

                {isApproved && reportStatus && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Zestawienie zatwierdzone</span>
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
                            onClick={handleDownload}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <Download className="mr-2 h-4 w-4" /> Pobierz zatwierdzony raport .docx
                        </Button>
                    </div>
                )}

                {!isApproved && previewCount !== null && previewCount > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                            <span className="font-semibold text-amber-700 dark:text-amber-400">Oczekuje na zatwierdzenie</span>
                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
                                {previewCount} wniosków
                            </Badge>
                        </div>
                        <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                            Kliknij poniżej aby zatwierdzić zestawienie za {months[parseInt(month) - 1]} {year}. Każdy wniosek otrzyma adnotację &quot;Zatwierdzone przez zarząd&quot;.
                        </p>
                        <Button 
                            onClick={handleApprove} 
                            disabled={isApproving}
                            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isApproving ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Zatwierdzam...</>
                            ) : (
                                <><CheckCircle className="mr-2 h-4 w-4" /> Zatwierdź zestawienie</>
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
