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
    "": "bg-white hover:bg-gray-50",
    "SHIFT_1": "bg-blue-500 text-white hover:bg-blue-600",
    "SHIFT_2": "bg-orange-400 text-white hover:bg-orange-500",
    "DUTY": "bg-red-500 text-white hover:bg-red-600",
    "VACATION": "bg-gray-200 text-gray-800 hover:bg-gray-300",
    "SICK": "bg-gray-300 text-gray-800 hover:bg-gray-400",
    "OFF": "bg-gray-400 text-white hover:bg-gray-500",
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

    const handleCellClick = (userId: number, day: number, currentType: string) => {
        const currentIndex = SHIFT_TYPES.indexOf(currentType || "")
        const nextIndex = (currentIndex + 1) % SHIFT_TYPES.length
        const nextType = SHIFT_TYPES[nextIndex]

        // Use UTC noon to ensure the date string is correct regardless of local timezone
        const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        const dateStr = dateObj.toISOString();

        startTransition(async () => {
            await upsertShift(userId, dateStr, nextType)
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

            <div className="rounded-md border bg-white overflow-x-auto">
                <Table className="min-w-max border-collapse">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] border-r sticky left-0 bg-white z-10">Pracownik</TableHead>
                            {days.map(day => {
                                const date = new Date(year, month - 1, day)
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                const isHolidayDate = isHoliday(date, holidays)
                                const isOff = isWeekend || isHolidayDate

                                return (
                                    <TableHead
                                        key={day}
                                        className={cn(
                                            "text-center w-10 p-1 border-r text-xs",
                                            isOff ? "bg-red-50 text-red-900" : ""
                                        )}
                                    >
                                        {day}
                                        <div className={cn("text-[10px] font-normal", isOff ? "text-red-700 font-semibold" : "text-gray-400")}>
                                            {format(date, "iii", { locale: pl }).slice(0, 2)}
                                        </div>
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium border-r sticky left-0 bg-white z-10">
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
                                                "p-0 border-r text-center cursor-pointer select-none transition-colors h-10 w-10",
                                                SHIFT_COLORS[type],
                                                !type && isOff ? "bg-red-50/50 hover:bg-red-100/50" : ""
                                            )}
                                            onClick={() => handleCellClick(user.id, day, type)}
                                        >
                                            <div className="flex items-center justify-center h-full w-full text-xs font-bold">
                                                {SHIFT_LABELS[type]}
                                            </div>
                                        </TableCell>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-wrap gap-4 text-sm mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded"></div> 1 - Pierwsza zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-400 rounded"></div> 2 - Druga zmiana</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div> D - Dyżur</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 rounded"></div> U - Urlop</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300 rounded"></div> L4 - Chorobowe</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-400 rounded"></div> DW - Odbiór dnia</div>
            </div>
        </div>
    )
}
