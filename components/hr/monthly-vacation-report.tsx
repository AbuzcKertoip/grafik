"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Loader2, Download } from "lucide-react"
import { generateMonthlyVacationReportDoc } from "@/lib/actions/doc-generator"
import { toast } from "sonner"

export function MonthlyVacationReport() {
    const today = new Date()
    const [month, setMonth] = useState<string>((today.getMonth() + 1).toString())
    const [year, setYear] = useState<string>(today.getFullYear().toString())
    const [isLoading, setIsLoading] = useState(false)

    const months = [
        "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
        "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ]

    const years = Array.from({ length: 5 }, (_, i) => (today.getFullYear() - 2 + i).toString())

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

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Zbiorczy raport wniosków
                </CardTitle>
                <CardDescription>
                    Wygeneruj wszystkie zatwierdzone wnioski z danego miesiąca jako jeden pilk DOCX, gotowy do druku.
                </CardDescription>
            </CardHeader>
            <CardContent>
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
                        className="w-full sm:w-auto mt-4 sm:mt-0"
                    >
                        {isLoading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generuję...</>
                        ) : (
                            <><Download className="mr-2 h-4 w-4" /> Pobierz .docx</>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
