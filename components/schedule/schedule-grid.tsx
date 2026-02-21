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
import { upsertShift } from "@/lib/actions/schedule"
import { cn } from "@/lib/utils"

interface ScheduleGridProps {
    users: any[]
    schedule: any[] // ScheduleDay[]
    year: number
    month: number
}

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPolishHolidays, isHoliday } from "@/lib/holidays"

const SHIFT_TYPES = ["", "SHIFT_1", "SHIFT_2", "DUTY", "VACATION", "SICK", "OFF"]
const SHIFT_LABELS: Record<string, string> = {
    "": "",
    "SHIFT_1": "1",
    "SHIFT_2": "2",
    "DUTY": "D",
    "VACATION": "U",
    "SICK": "L4",
    "OFF": "DW",
}
const SHIFT_COLORS: Record<string, string> = {
    "": "bg-white dark:bg-slate-950 hover:bg-gray-50 dark:hover:bg-slate-900",
    "SHIFT_1": "bg-blue-500 text-white hover:bg-blue-600",
    "SHIFT_2": "bg-orange-400 text-white hover:bg-orange-500",
    "DUTY": "bg-red-500 text-white hover:bg-red-600",
    "VACATION": "bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-600",
    "SICK": "bg-gray-300 dark:bg-slate-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-slate-500",
    "OFF": "bg-gray-400 dark:bg-slate-500 text-white hover:bg-gray-500 dark:hover:bg-slate-400",
}

export function ScheduleGrid({ users, schedule, year, month }: ScheduleGridProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

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

    const handleCellClick = (userId: number, day: number, selectedType: string) => {
        // Use UTC noon to ensure the date string is correct regardless of local timezone
        const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        const dateStr = dateObj.toISOString();

        startTransition(async () => {
            await upsertShift(userId, dateStr, selectedType)
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
            {isPending && <span className="text-xs text-muted-foreground ml-2">Zapisywanie...</span>}

            <div className="rounded-md border bg-card text-card-foreground overflow-x-auto dark:border-slate-800">
                <Table className="min-w-max border-collapse table-fixed w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] border-r sticky left-0 bg-card z-10 text-card-foreground">Pracownik</TableHead>
                            {days.map(day => {
                                const date = new Date(year, month - 1, day)
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                const isHolidayDate = isHoliday(date, holidays)
                                const isOff = isWeekend || isHolidayDate

                                return (
                                    <TableHead
                                        key={day}
                                        className={cn(
                                            "text-center min-w-[40px] w-10 p-1 border-r text-xs dark:border-slate-800",
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
                                <TableCell className="font-medium border-r sticky left-0 bg-card z-10 dark:border-slate-800">
                                    {user.name}
                                </TableCell>
                                {days.map(day => {
                                    const shift = getShift(user.id, day)
                                    const type = shift?.type || ""

                                    const date = new Date(year, month - 1, day)
                                    const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                    const isHolidayDate = isHoliday(date, holidays)
                                    const isOff = isWeekend || isHolidayDate

                                    return (
                                        <TableCell
                                            key={day}
                                            className={cn(
                                                "p-0 border-r text-center select-none transition-colors min-w-[40px] w-10 h-10 overflow-hidden dark:border-slate-800",
                                                SHIFT_COLORS[type],
                                                !type && isOff ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20" : ""
                                            )}
                                        >
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div className="flex items-center justify-center h-full w-full text-xs font-bold leading-none cursor-pointer">
                                                        {SHIFT_LABELS[type]}
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="center" className="min-w-[120px]">
                                                    {SHIFT_TYPES.map(shiftType => (
                                                        <DropdownMenuItem
                                                            key={shiftType}
                                                            onClick={() => handleCellClick(user.id, day, shiftType)}
                                                            className="cursor-pointer font-medium flex items-center gap-2"
                                                        >
                                                            <div className={cn("w-3 h-3 rounded-full border", SHIFT_COLORS[shiftType] || "bg-white dark:bg-slate-950")} />
                                                            {shiftType === "" ? "Wyczyść" : SHIFT_LABELS[shiftType] + " - " + (
                                                                shiftType === "SHIFT_1" ? "1 Zmiana" :
                                                                    shiftType === "SHIFT_2" ? "2 Zmiana" :
                                                                        shiftType === "DUTY" ? "Dyżur" :
                                                                            shiftType === "VACATION" ? "Urlop" :
                                                                                shiftType === "SICK" ? "Chorobowe" :
                                                                                    shiftType === "OFF" ? "Odbiór" : ""
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-wrap gap-4 text-sm mt-4 p-4 bg-muted/40 rounded-lg border dark:border-slate-800">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div> 1 - Pierwsza zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-400 rounded"></div> 2 - Druga zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> D - Dyżur</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded"></div> U - Urlop</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300 dark:bg-slate-600 rounded"></div> L4 - Chorobowe</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 dark:bg-slate-500 rounded"></div> DW - Odbiór dnia</div>
            </div>
        </div>
    )
}
