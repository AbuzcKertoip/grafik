"use client"

import { useState, useTransition } from "react"
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
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { upsertShifts } from "@/lib/actions/schedule"
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

interface ScheduleGridProps {
    users: any[]
    schedule: any[] // ScheduleDay[]
    year: number
    month: number
    currentUser: any // Current session user
}

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { getPolishHolidays, isHoliday } from "@/lib/holidays"

const SHIFT_TYPES = ["", "SHIFT_1", "SHIFT_2", "DUTY", "VACATION", "SPECIAL_LEAVE", "CHILDCARE", "ADDITIONAL", "OVERTIME", "SICK", "HOLIDAY", "OFF"]
const SHIFT_LABELS: Record<string, string> = {
    "": "",
    "SHIFT_1": "1",
    "SHIFT_2": "2",
    "DUTY": "D",
    "VACATION": "U",
    "SPECIAL_LEAVE": "UO",
    "CHILDCARE": "OD",
    "ADDITIONAL": "UD",
    "OVERTIME": "UN",
    "SICK": "L4",
    "HOLIDAY": "ŚW",
    "OFF": "DW",
}
const SHIFT_COLORS: Record<string, string> = {
    "": "bg-white dark:bg-slate-950 hover:bg-gray-50 dark:hover:bg-slate-900",
    "SHIFT_1": "bg-blue-500 text-white hover:bg-blue-600",
    "SHIFT_2": "bg-orange-400 text-white hover:bg-orange-500",
    "DUTY": "bg-red-500 text-white hover:bg-red-600",
    "VACATION": "bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600",
    "SPECIAL_LEAVE": "bg-purple-200 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 hover:bg-purple-300 dark:hover:bg-purple-800/40",
    "CHILDCARE": "bg-rose-200 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 hover:bg-rose-300 dark:hover:bg-rose-800/40",
    "ADDITIONAL": "bg-indigo-200 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-300 dark:hover:bg-indigo-800/40",
    "OVERTIME": "bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-800/40",
    "SICK": "bg-gray-300 dark:bg-slate-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-slate-500",
    "HOLIDAY": "bg-pink-500 dark:bg-pink-600 text-white hover:bg-pink-600 dark:hover:bg-pink-700",
    "OFF": "bg-gray-400 dark:bg-slate-500 text-white hover:bg-gray-500 dark:hover:bg-slate-400",
}

export function ScheduleGrid({ users, schedule, year, month, currentUser }: ScheduleGridProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isDragging, setIsDragging] = useState(false)
    const [selectedCells, setSelectedCells] = useState<{userId: number, day: number}[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const gridRef = useRef<HTMLDivElement>(null)

    const isDraggingRef = useRef(isDragging)
    const selectedCellsRef = useRef(selectedCells)

    useEffect(() => {
        isDraggingRef.current = isDragging
        selectedCellsRef.current = selectedCells
    }, [isDragging, selectedCells])

    useEffect(() => {
        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                setIsDragging(false)
                if (selectedCellsRef.current.length > 0) {
                    setIsModalOpen(true)
                }
            }
        }
        window.addEventListener('mouseup', handleMouseUp)
        return () => window.removeEventListener('mouseup', handleMouseUp)
    }, [])

    // Determine if the current user has permission to edit the schedule
    const isEditable = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER'

    const daysInMonth = getDaysInMonth(new Date(year, month - 1))
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const holidays = getPolishHolidays(year)

    // Helper to find shift for user and day
    const getShift = (userId: number, day: number) => {
        // Dates from DB are Date objects. We need to compare day.
        return schedule.find(s => {
            const sDate = new Date(s.date)
            return s.userId === userId && getDate(sDate) === day
        })
    }

    const handleMouseDown = (userId: number, day: number) => {
        if (!isEditable) return
        setIsDragging(true)
        setSelectedCells([{ userId, day }])
    }

    const handleMouseEnter = (userId: number, day: number) => {
        if (!isDragging || !isEditable) return
        // Sprawdź czy już jest by nie dublować
        if (!selectedCells.find(c => c.userId === userId && c.day === day)) {
            setSelectedCells(prev => [...prev, { userId, day }])
        }
    }

    const handleApplyBulk = (selectedType: string) => {
        setIsModalOpen(false)
        startTransition(async () => {
            const shifts = selectedCells.map(c => ({
                userId: c.userId,
                year,
                month,
                day: c.day,
                type: selectedType
            }))
            const res = await upsertShifts(shifts)
            setSelectedCells([])
            if (res?.error) {
                toast.error(res.error)
            } else {
                toast.success("Zapisano zmiany")
            }
        })
    }

    const handlePrevMonth = () => {
        const date = new Date(year, month - 2) // month is 1-indexed
        router.push(`/dashboard/schedule?month=${date.getMonth() + 1}&year=${date.getFullYear()}`)
    }

    const handleNextMonth = () => {
        const date = new Date(year, month)
        router.push(`/dashboard/schedule?month=${date.getMonth() + 1}&year=${date.getFullYear()}`)
    }

    return (
        <div className="space-y-4">
            <div className="h-5 flex items-center">
                <span className={cn("text-xs text-muted-foreground ml-2 transition-opacity", isPending ? "opacity-100" : "opacity-0")}>
                    Zapisywanie...
                </span>
            </div>

            <div className="rounded-md border bg-card text-card-foreground w-full overflow-hidden dark:border-slate-800">
                <div className="overflow-x-auto">
                    <Table className="w-max min-w-full border-collapse">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[168px] min-w-[168px] max-w-[168px] border-r sticky left-0 bg-card z-10 text-card-foreground">Pracownik</TableHead>
                                {days.map(day => {
                                    const date = new Date(year, month - 1, day)
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                    const isHolidayDate = isHoliday(date, holidays)
                                    const isOff = isWeekend || isHolidayDate

                                    return (
                                        <TableHead
                                            key={day}
                                            className={cn(
                                                "text-center min-w-[34px] w-[34px] p-0.5 border-r text-xs dark:border-slate-800",
                                                isOff ? "bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-300" : "bg-card text-card-foreground"
                                            )}
                                        >
                                            {day}
                                            <div className={cn("text-[10px] font-normal", isOff ? "text-red-700 dark:text-red-400 font-semibold" : "text-muted-foreground")}>
                                                {format(date, "iii", { locale: pl }).slice(0, 2)}
                                            </div>
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id} className="hover:bg-muted/50 dark:hover:bg-slate-900/50">
                                    <TableCell className="w-[168px] min-w-[168px] max-w-[168px] font-medium border-r sticky left-0 bg-card z-10 dark:border-slate-800 truncate text-sm">
                                        {user.name}
                                    </TableCell>
                                    {days.map(day => {
                                        const shift = getShift(user.id, day)
                                        const type = shift?.type || ""

                                        const date = new Date(year, month - 1, day)
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                        const isHolidayDate = isHoliday(date, holidays)
                                        const isOff = isWeekend || isHolidayDate

                                        const isSelected = selectedCells.some(c => c.userId === user.id && c.day === day)
                                        return (
                                            <TableCell
                                                key={day}
                                                className={cn(
                                                    "p-0 border-r text-center select-none transition-colors min-w-[34px] w-[34px] h-9 overflow-hidden dark:border-slate-800",
                                                    isSelected ? "ring-2 ring-primary ring-inset opacity-80" : "",
                                                    !isSelected && SHIFT_COLORS[type],
                                                    !isSelected && !type && isOff ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20" : ""
                                                )}
                                                onMouseDown={() => handleMouseDown(user.id, day)}
                                                onMouseEnter={() => handleMouseEnter(user.id, day)}
                                            >
                                                <div className={cn("flex items-center justify-center h-full w-full text-xs font-bold leading-none", isEditable && "cursor-crosshair")}>
                                                    {!isSelected && SHIFT_LABELS[type]}
                                                    {isSelected && <span className="opacity-50 blur-[2px]">{SHIFT_LABELS[type]}</span>}
                                                </div>
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setSelectedCells([]); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Zmień przydział ({selectedCells.length} dni)</DialogTitle>
                        <DialogDescription>Wybierz status grafiku, który ma zostać zastosowany do wszystkich zaznaczonych komórek.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 mt-4 max-h-[350px] overflow-y-auto px-2">
                        {SHIFT_TYPES.map(shiftType => (
                            <Button
                                key={shiftType}
                                variant="outline"
                                onClick={() => handleApplyBulk(shiftType)}
                                className="justify-start h-auto py-3 px-3"
                            >
                                <div className={cn("w-4 h-4 rounded border shrink-0 mr-3", SHIFT_COLORS[shiftType] || "bg-white dark:bg-slate-950")} />
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="text-xs font-bold text-wrap text-left break-words">
                                        {shiftType === "" ? "Wyczyść" : SHIFT_LABELS[shiftType]}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground truncate w-full text-left">
                                        {shiftType === "" ? "Zostaw puste" : (
                                            shiftType === "SHIFT_1" ? "1 Zmiana" :
                                            shiftType === "SHIFT_2" ? "2 Zmiana" :
                                            shiftType === "DUTY" ? "Dyżur" :
                                            shiftType === "VACATION" ? "Urlop Wypoczynkowy" :
                                            shiftType === "SPECIAL_LEAVE" ? "Urlop Okolicznościowy" :
                                            shiftType === "CHILDCARE" ? "Opieka nad dzieckiem" :
                                            shiftType === "ADDITIONAL" ? "Dodatkowy Urlop" :
                                            shiftType === "OVERTIME" ? "Odbiór nadgodzin" :
                                            shiftType === "SICK" ? "Chorobowe" :
                                            shiftType === "HOLIDAY" ? "Święto Państwowe" :
                                            shiftType === "OFF" ? "Odbiór dnia" : ""
                                        )}
                                    </span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            <div className="flex flex-wrap gap-4 text-sm mt-4 p-4 bg-muted/40 rounded-lg border dark:border-slate-800">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div> 1 - Pierwsza zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-400 rounded"></div> 2 - Druga zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> D - Dyżur</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded border border-gray-300"></div> U - Urlop</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-purple-200 dark:bg-purple-900/40 rounded border border-purple-300"></div> UO - Okolicznościowy</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-rose-200 dark:bg-rose-900/40 rounded border border-rose-300"></div> OD - Opieka</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-indigo-200 dark:bg-indigo-900/40 rounded border border-indigo-300"></div> UD - Dodatkowy</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-amber-200 dark:bg-amber-900/40 rounded border border-amber-300"></div> UN - Nadgodziny</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300 dark:bg-slate-600 rounded"></div> L4 - Chorobowe</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 dark:bg-slate-500 rounded"></div> DW - Odbiór dnia</div>
            </div>
        </div>
    )
}
