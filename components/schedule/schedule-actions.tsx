"use client"

import { Button } from "@/components/ui/button"
import { VacationCalendar } from "@/components/vacations/vacation-calendar"
import { generateSchedule, clearSchedule } from "@/lib/actions/schedule"
import { CalendarDays, Trash2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface ScheduleActionsProps {
    users: any[]
    vacations: any[]
    year: number
    month: number
    currentUser: any
}

export function ScheduleActions({ users, vacations, year, month, currentUser }: ScheduleActionsProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const isAdmin = currentUser?.role === 'ADMIN'

    const handleGenerate = async () => {
        if (!confirm(`Czy na pewno wygenerować grafik na ${month}/${year}? Istniejące dane dla tego miesiąca zostaną nadpisane.`)) return

        setLoading(true)
        try {
            const result = await generateSchedule(year, month)
            if (result.success) {
                router.refresh()
                alert("Grafik został wygenerowany pomyślnie.")
            } else {
                alert("Wystąpił błąd podczas generowania grafiku.")
            }
        } catch (e) {
            alert("Błąd podczas generowania grafiku: " + e)
        } finally {
            setLoading(false)
        }
    }

    const handleClear = async () => {
        if (!confirm(`Czy na pewno usunąć CAŁY grafik na ${month}/${year}? Ta operacja jest nieodwracalna.`)) return

        setLoading(true)
        try {
            const result = await clearSchedule(year, month)
            if (result.success) {
                router.refresh()
                alert("Grafik został wyczyszczony.")
            } else {
                alert(result.error || "Wystąpił błąd.")
            }
        } catch (e) {
            alert("Błąd: " + e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex gap-2">
            <VacationCalendar users={users} vacations={vacations} currentUser={currentUser} />
            {isAdmin && (
                <>
                    <Button
                        onClick={handleGenerate}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <CalendarDays className="h-4 w-4" />
                        )}
                        {loading ? "Generowanie..." : "Generuj Grafik"}
                    </Button>
                    <Button
                        onClick={handleClear}
                        variant="destructive"
                        className="gap-2 shadow-sm transition-all active:scale-95"
                        disabled={loading}
                    >
                        <Trash2 className="h-4 w-4" />
                        Wyczyść
                    </Button>
                </>
            )}
        </div>
    )
}
