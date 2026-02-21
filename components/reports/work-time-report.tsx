"use client"

import { useState, useEffect } from "react"
import { getWorkTimeReport } from "@/lib/actions/reports"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

interface WorkTimeReportProps {
    departmentId?: number
}

export function WorkTimeReport({ departmentId }: WorkTimeReportProps) {
    const [data, setData] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)

    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)
    const months = Array.from({ length: 12 }, (_, i) => i + 1)

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            try {
                const report = await getWorkTimeReport(year, month, departmentId)
                setData(report)
            } catch (error) {
                console.error("Failed to load work time report", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [year, month, departmentId])

    const totalHoursAll = data.reduce((acc, curr) => acc + curr.totalHours, 0)
    const totalOvertimeAll = data.reduce((acc, curr) => acc + curr.totalOvertime, 0)

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
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

                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Miesiąc" />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map(m => (
                            <SelectItem key={m} value={m.toString()}>
                                {format(new Date(year, m - 1), "LLLL", { locale: pl })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suma Godzin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalHoursAll}h</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suma Nadgodzin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOvertimeAll}h</div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pracownik</TableHead>
                            <TableHead>Dział</TableHead>
                            <TableHead className="text-right">Godziny (Zwykłe)</TableHead>
                            <TableHead className="text-right">Nadgodziny</TableHead>
                            <TableHead className="text-right">Suma Godzin</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Ładowanie danych...</TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">Brak danych za wybrany okres.</TableCell>
                            </TableRow>
                        ) : (
                            data.map((row) => (
                                <TableRow key={row.userId}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell>{row.department}</TableCell>
                                    <TableCell className="text-right">{row.regularHours}h</TableCell>
                                    <TableCell className="text-right text-orange-600 font-medium">{row.totalOvertime > 0 ? `+${row.totalOvertime}h` : '-'}</TableCell>
                                    <TableCell className="text-right font-bold">{row.totalHours}h</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
