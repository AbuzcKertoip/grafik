"use client"

import { useState } from "react"
import { format, getDaysInMonth, getDate } from "date-fns"
import { pl } from "date-fns/locale"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Edit, Trash2, Download } from "lucide-react"
import { WorkLogDialog } from "./work-log-dialog"
import { deleteWorkLog, syncScheduleToWorkLogs, clearWorkLogs, submitWorkLogToManager } from "@/lib/actions/work-logs"
import { useRouter } from "next/navigation"
import { Loader2, Send } from "lucide-react"

interface WorkLogTableProps {
    logs: any[]
    year: number
    month: number
    user: any
}

export function WorkLogTable({ logs, year, month, user }: WorkLogTableProps) {
    const router = useRouter()
    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const isAdmin = user?.role === 'ADMIN'

    const [selectedLog, setSelectedLog] = useState<any>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())

    const getLogsForDay = (day: number) => {
        return logs.filter(log => getDate(new Date(log.date)) === day)
    }

    const handleAdd = (day: number) => {
        // Create date at noon UTC
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
        setSelectedDate(d)
        setSelectedLog(null)
        setIsDialogOpen(true)
    }

    const handleEdit = (log: any) => {
        setSelectedDate(new Date(log.date))
        setSelectedLog(log)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (confirm("Usunąć ten wpis?")) {
            await deleteWorkLog(id)
            router.refresh()
        }
    }

    const handleClear = async () => {
        if (confirm("Czy na pewno usunąć WSZYSTKIE wpisy z karty pracy dla tego użytkownika w tym miesiącu? Operacja jest nieodwracalna.")) {
            const res = await clearWorkLogs(user.id, year, month)
            if (res.success) {
                alert("Karta pracy została wyczyszczona.")
                router.refresh()
            } else {
                alert(`Błąd: ${res.error}`)
            }
        }
    }

    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmitToManager = async () => {
        if (confirm("Czy na pewno chcesz wysłać kartę pracy do akceptacji? Ta akcja wygeneruje plik Excel i wyśle go e-mailem bezpośrednio na skrzynkę do Twojego Przełożonego. \n\nUWAGA: Twoja robocza wersja w systemie zostanie po wysłaniu BEZPOWROTNIE WYCZYSZCZONA! To jest wersja ostateczna.")) {
            setIsSubmitting(true)
            try {
                const res = await submitWorkLogToManager(user.id, year, month)
                if (res.success) {
                    alert("Karta pracy została pomyślnie wysłana i przekazana Twojemu przełożonemu do akceptacji.")
                    router.refresh()
                } else {
                    alert(`Błąd: ${res.error}`)
                }
            } catch (err) {
                alert("Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie później.")
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end border bg-muted/40 p-4 rounded-lg">
                <Button
                    onClick={handleSubmitToManager}
                    className="gap-2 font-semibold py-6 w-full sm:w-auto"
                    disabled={isSubmitting || logs.length === 0}
                >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    Wyślij Ewidencję do Menadżera Działu (Akcja Ostateczna)
                </Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Ewidencja Czasu Pracy</h2>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="destructive"
                        onClick={handleClear}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Wyczyść Miesiąc (Reset)
                    </Button>
                    <Button
                        variant="outline"
                        onClick={async () => {
                            if (confirm("Czy na pewno chcesz pobrać dane z grafiku? Istniejące wpisy nie zostaną nadpisane.")) {
                                const res = await syncScheduleToWorkLogs(user.id, year, month)
                                if (res.success) {
                                    alert(`Zsynchronizowano wpisów: ${res.count}`)
                                    router.refresh() // Refresh to show new logs
                                } else {
                                    alert(`Błąd synchronizacji: ${res.error}`)
                                }
                            }
                        }}
                    >
                        🔄 Pobierz z Grafiku
                    </Button>
                    <Button onClick={() => handleAdd(new Date().getDate())}>
                        <Plus className="mr-2 h-4 w-4" /> Nowy wpis
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Dzień</TableHead>
                            <TableHead className="w-[150px]">Godziny</TableHead>
                            <TableHead>Opis czynności</TableHead>
                            <TableHead className="w-[150px]">Projekt</TableHead>
                            <TableHead className="w-[80px] text-right">Czas (h)</TableHead>
                            <TableHead className="w-[80px] text-right">Nadgodziny</TableHead>
                            <TableHead className="w-[100px] text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {days.map(day => {
                            const dayLogs = getLogsForDay(day)
                            const dateObj = new Date(year, month - 1, day)
                            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                            const rowClass = isWeekend ? "bg-green-50 dark:bg-green-900/25" : ""

                            if (dayLogs.length === 0) {
                                return (
                                    <TableRow key={day} className={`hover:bg-muted/50 transition-colors ${rowClass}`}>
                                        <TableCell className="font-medium align-top py-4">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-bold">{day}</span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                    {format(dateObj, "EEEE", { locale: pl })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={5} className="text-muted-foreground italic align-middle">
                                            Brak wpisów
                                        </TableCell>
                                        <TableCell className="text-right align-middle">
                                            <Button variant="ghost" size="sm" onClick={() => handleAdd(day)}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            }

                            return dayLogs.map((log, index) => (
                                <TableRow key={log.id} className={rowClass}>
                                    {index === 0 && (
                                        <TableCell rowSpan={dayLogs.length} className="font-medium align-top py-4 border-r">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-bold">{day}</span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                    {format(dateObj, "EEEE", { locale: pl })}
                                                </span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-2 w-full text-xs h-7"
                                                onClick={() => handleAdd(day)}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Dodaj
                                            </Button>
                                        </TableCell>
                                    )}
                                    <TableCell className="align-top">
                                        {log.startTime} - {log.endTime}
                                    </TableCell>
                                    <TableCell className="align-top whitespace-pre-line">
                                        {log.description}
                                    </TableCell>
                                    <TableCell className="align-top">
                                        {log.project}
                                    </TableCell>
                                    <TableCell className="align-top text-right font-medium">
                                        {log.duration}
                                    </TableCell>
                                    <TableCell className="align-top text-right text-red-600 dark:text-red-400 font-medium">
                                        {log.overtime > 0 ? log.overtime : "-"}
                                    </TableCell>
                                    <TableCell className="align-top text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(log)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300" onClick={() => handleDelete(log.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        })}
                    </TableBody>
                </Table>
            </div>

            <WorkLogDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                log={selectedLog}
                date={selectedDate}
            />
        </div>
    )
}
