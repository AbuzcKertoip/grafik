"use client"

import { useState, useEffect } from "react"
import { getVacationsReport } from "@/lib/actions/reports"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface VacationsReportProps {
    departmentId?: number
}

export function VacationsReport({ departmentId }: VacationsReportProps) {
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            try {
                const report = await getVacationsReport(year, departmentId)
                setData(report)
            } catch (error) {
                console.error("Failed to load vacations report", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [year, departmentId])

    return (
        <div className="space-y-4">
            <div className="flex items-center">
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Rok" />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map(y => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pracownik</TableHead>
                            <TableHead>Dział</TableHead>
                            <TableHead className="text-right">Roczny Wymiar</TableHead>
                            <TableHead className="text-right text-muted-foreground">Zaległy</TableHead>
                            <TableHead className="text-right">Wykorzystano</TableHead>
                            <TableHead className="text-right text-orange-500">Oczekujące</TableHead>
                            <TableHead className="text-right">Pozostało</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">Ładowanie danych...</TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">Brak danych dla wybranego roku.</TableCell>
                            </TableRow>
                        ) : (
                            data.map((row) => (
                                <TableRow key={row.userId}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell>{row.department}</TableCell>
                                    <TableCell className="text-right">{row.limit}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{row.carriedOver > 0 ? `+${row.carriedOver}` : '0'}</TableCell>
                                    <TableCell className="text-right font-medium">{row.usedThisYear}</TableCell>
                                    <TableCell className="text-right text-orange-500">{row.pendingThisYear > 0 ? row.pendingThisYear : '-'}</TableCell>
                                    <TableCell className={`text-right font-bold ${row.remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {row.remaining}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
