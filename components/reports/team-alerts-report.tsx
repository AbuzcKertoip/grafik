"use client"

import { useState, useEffect } from "react"
import { getAlertsReport } from "@/lib/actions/reports"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { AlertCircle, FileWarning, Car } from "lucide-react"

interface TeamAlertsReportProps {
    departmentId?: number
}

export function TeamAlertsReport({ departmentId }: TeamAlertsReportProps) {
    const [data, setData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            try {
                const report = await getAlertsReport(departmentId)
                setData(report)
            } catch (error) {
                console.error("Failed to load alerts report", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [departmentId])

    if (isLoading) {
        return <div className="text-center py-8">Ładowanie danych...</div>
    }

    if (!data) return null

    const hasNoAlerts = data.medicalExams.length === 0 && data.cars.length === 0

    return (
        <div className="space-y-6">
            {hasNoAlerts && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                        <AlertCircle className="h-6 w-6 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">Wszystko w porządku!</h3>
                    <p className="text-muted-foreground mt-2">Brak zbliżających się terminów badań lekarskich czy przeglądów w ciągu najbliższych 2 miesięcy.</p>
                </div>
            )}

            {data.medicalExams.length > 0 && (
                <Card className="border-orange-500/20 shadow-sm">
                    <CardHeader className="bg-orange-500/5 pb-4">
                        <div className="flex items-center gap-2">
                            <FileWarning className="h-5 w-5 text-orange-500" />
                            <CardTitle>Badania Lekarskie (Wygasające)</CardTitle>
                        </div>
                        <CardDescription>
                            Zestawienie badań kończących się w ciągu najbliższych 60 dni.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Pracownik</TableHead>
                                    <TableHead>Typ Badania</TableHead>
                                    <TableHead>Ważne do</TableHead>
                                    <TableHead className="text-right pr-6">Pozostało dni</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.medicalExams.map((exam: any, idx: number) => (
                                    <TableRow key={`med-${idx}`}>
                                        <TableCell className="font-medium pl-6">{exam.name}</TableCell>
                                        <TableCell>{exam.type}</TableCell>
                                        <TableCell>{format(new Date(exam.validUntil), "dd.MM.yyyy")}</TableCell>
                                        <TableCell className={`text-right pr-6 font-bold ${exam.daysRemaining <= 7 ? 'text-red-500' : 'text-orange-500'}`}>
                                            {exam.daysRemaining < 0 ? 'Wygasło' : `${exam.daysRemaining} dni`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {data.cars.length > 0 && (
                <Card className="border-blue-500/20 shadow-sm">
                    <CardHeader className="bg-blue-500/5 pb-4">
                        <div className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-blue-500" />
                            <CardTitle>Flota (Ubezpieczenia i Przeglądy)</CardTitle>
                        </div>
                        <CardDescription>
                            Pojazdy z wygasającym OC/AC lub przeglądem technicznym (60 dni).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Pojazd</TableHead>
                                    <TableHead>Nr Rej.</TableHead>
                                    <TableHead>Przegląd do</TableHead>
                                    <TableHead>Ubezpieczenie do</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.cars.map((car: any) => (
                                    <TableRow key={`car-${car.carId}`}>
                                        <TableCell className="font-medium pl-6">{car.make} {car.model}</TableCell>
                                        <TableCell>{car.plate}</TableCell>
                                        <TableCell className={car.inspectionDaysRemaining <= 14 ? 'text-red-500 font-bold' : car.inspectionDaysRemaining <= 60 ? 'text-orange-500 font-medium' : ''}>
                                            {format(new Date(car.inspectionValidUntil), "dd.MM.yyyy")}
                                            {car.inspectionDaysRemaining <= 60 && ` (${car.inspectionDaysRemaining} dni)`}
                                        </TableCell>
                                        <TableCell className={car.insuranceDaysRemaining <= 14 ? 'text-red-500 font-bold' : car.insuranceDaysRemaining <= 60 ? 'text-orange-500 font-medium' : ''}>
                                            {format(new Date(car.insuranceValidUntil), "dd.MM.yyyy")}
                                            {car.insuranceDaysRemaining <= 60 && ` (${car.insuranceDaysRemaining} dni)`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
