"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isWithinInterval,
    isToday,
    addDays,
    differenceInDays
} from "date-fns"
import { pl } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface CalendarProps {
    mode?: "range" | "single"
    selected?: { from?: Date; to?: Date } | Date
    onSelect?: (value: any) => void
    className?: string
}

export function Calendar({
    mode = "single",
    selected,
    onSelect,
    className,
}: CalendarProps) {
    const [currentMonth, setCurrentMonth] = React.useState(new Date())

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { locale: pl })
    const endDate = endOfWeek(monthEnd, { locale: pl })

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const handleDateClick = (day: Date) => {
        if (!onSelect) return

        if (mode === "single") {
            onSelect(day)
            return
        }

        if (mode === "range") {
            const range = selected as { from?: Date; to?: Date } || {}

            if (!range.from || (range.from && range.to)) {
                onSelect({ from: day, to: undefined })
            } else {
                if (day < range.from) {
                    onSelect({ from: day, to: range.from })
                } else {
                    onSelect({ from: range.from, to: day })
                }
            }
        }
    }

    const isWithinRange = (day: Date) => {
        if (mode !== "range" || !selected) return false
        const range = selected as { from?: Date; to?: Date }
        if (range.from && range.to) {
            return isWithinInterval(day, { start: range.from, end: range.to })
        }
        return false
    }

    const isDateSelected = (day: Date) => {
        if (!selected) return false

        if (mode === "single") {
            return isSameDay(day, selected as Date)
        }

        const range = selected as { from?: Date; to?: Date }
        return (range.from && isSameDay(day, range.from)) || (range.to && isSameDay(day, range.to))
    }

    const isRangeStart = (day: Date) => {
        if (mode !== "range") return false
        const range = selected as { from?: Date; to?: Date }
        return range?.from && isSameDay(day, range.from)
    }

    const isRangeEnd = (day: Date) => {
        if (mode !== "range") return false
        const range = selected as { from?: Date; to?: Date }
        return range?.to && isSameDay(day, range.to)
    }

    const dayLabels = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]

    let statusText = "Wybierz datę początkową";
    if (mode === "range") {
        const range = selected as { from?: Date; to?: Date }
        if (range?.from && !range?.to) {
            statusText = "Wybierz datę końcową (lub tę samą dla 1 dnia)";
        } else if (range?.from && range?.to) {
            const daysCount = Math.abs(differenceInDays(range.to, range.from)) + 1;
            statusText = `Wybrano: ${daysCount} dni`;
        }
    }

    return (
        <div className={cn("p-4 w-full bg-white select-none", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 px-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-10 w-10 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>

                <div className="text-center group cursor-pointer">
                    <h2 className="text-lg font-bold text-gray-900 capitalize tracking-tight group-hover:text-emerald-600 transition-colors">
                        {format(currentMonth, "LLLL yyyy", { locale: pl })}
                    </h2>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-10 w-10 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
                >
                    <ChevronRight className="h-6 w-6" />
                </Button>
            </div>

            {/* Day Labels */}
            <div
                className="grid grid-cols-7 gap-1 mb-4"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
            >
                {dayLabels.map((label) => (
                    <div key={label} className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest pb-2 border-b border-gray-50">
                        {label}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div
                className="grid grid-cols-7 gap-y-2 gap-x-1"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
            >
                {calendarDays.map((day, idx) => {
                    const isSelected = isDateSelected(day)
                    const isInRange = isWithinRange(day)
                    const rangeStart = isRangeStart(day)
                    const rangeEnd = isRangeEnd(day)
                    const currentMonthDay = isSameMonth(day, monthStart)

                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleDateClick(day)}
                            disabled={!currentMonthDay}
                            className={cn(
                                "h-12 w-full text-sm transition-all relative flex items-center justify-center font-semibold rounded-xl group",
                                // Base styles
                                !currentMonthDay && "opacity-0 pointer-events-none",
                                currentMonthDay && !isInRange && !isSelected && "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm",

                                // Today style
                                isToday(day) && currentMonthDay && !isSelected && !isInRange && "text-emerald-600 bg-emerald-50/30 ring-1 ring-emerald-100 ring-inset",

                                // Range styles
                                isInRange && currentMonthDay && "bg-emerald-50 text-emerald-700 rounded-none",
                                rangeStart && "bg-emerald-600 text-white rounded-l-xl rounded-r-none hover:bg-emerald-700 shadow-md scale-105 z-20",
                                rangeEnd && "bg-emerald-600 text-white rounded-r-xl rounded-l-none hover:bg-emerald-700 shadow-md scale-105 z-20",

                                // Single selected or Start only
                                isSelected && !rangeStart && !rangeEnd && "bg-emerald-600 text-white shadow-lg scale-105 z-20 hover:bg-emerald-700",

                                // Interactive feedback
                                "active:scale-95"
                            )}
                        >
                            <span className="relative z-10">{format(day, "d")}</span>
                            {/* Decorative dot for today */}
                            {isToday(day) && currentMonthDay && !isSelected && !isInRange && (
                                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Status Bar */}
            <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Status</span>
                    {mode === 'range' && (selected as any)?.from && (
                        <button
                            onClick={() => onSelect && onSelect(undefined)}
                            className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                        >
                            Wyczyść
                        </button>
                    )}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 font-medium text-center">
                    {statusText}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Dziś</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Start/Koniec</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-100" />
                    <span>Zakres</span>
                </div>
            </div>
        </div>
    )
}
