"use client"

import { Button } from "@/components/ui/button"
import { VacationCalendar } from "@/components/vacations/vacation-calendar"
import { generateSchedule, clearSchedule } from "@/lib/actions/schedule"
import { CalendarDays, Trash2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { SwapRequestsPanel } from "@/components/schedule/swap-requests-panel"

interface ScheduleActionsProps {
    users: any[]
    vacations: any[]
    year: number
    month: number
    currentUser: any
    departmentId?: number
    userSwapRequests: any[]
    managerSwapRequests: any[]
}

export function ScheduleActions({ users, vacations, year, month, currentUser, departmentId, userSwapRequests, managerSwapRequests }: ScheduleActionsProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SZEF' || currentUser?.role === 'MANAGER'

    const handleGenerate = async () => {
        if (!departmentId && currentUser?.role !== 'MANAGER') {
            alert("Proszę najpierw wybrać konkretny dział z filtra, aby wygenerować dla niego grafik.")
            return
        }

        if (!confirm(`Czy na pewno wygenerować grafik wybranego działu na ${month}/${year}? Istniejące dane dla tego miesiąca zostaną nadpisane.`)) return

        setLoading(true)
        try {
            const result = await generateSchedule(year, month, departmentId)
            if (result.success) {
                router.refresh()
                alert("Grafik został wygenerowany pomyślnie.")
            } else {
                alert(result.error || "Wystąpił błąd podczas generowania grafiku.")
            }
        } catch (e) {
            alert("Błąd podczas generowania grafiku: " + e)
        } finally {
            setLoading(false)
        }
    }

    const handleClear = async () => {
        if (!departmentId && currentUser?.role !== 'MANAGER') {
            alert("Proszę najpierw wybrać konkretny dział z filtra, aby usunąć dla niego grafik.")
            return
        }

        if (!confirm(`Czy na pewno usunąć grafiki wybranego działu na ${month}/${year}? Ta operacja jest nieodwracalna.`)) return

        setLoading(true)
        try {
            const result = await clearSchedule(year, month, departmentId)
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
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="flex gap-2 w-full sm:w-auto">
                <VacationCalendar users={users} vacations={vacations} currentUser={currentUser} />
                <SwapRequestsPanel users={users} currentUser={currentUser} userRequests={userSwapRequests} managerRequests={managerSwapRequests} />
                {canManage && (
                    <Button
                        onClick={handleClear}
                        variant="destructive"
                        size="icon"
                        className="sm:hidden shadow-sm transition-all active:scale-95"
                        disabled={loading}
                        title="Wyczyść grafik"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {canManage && (
                <>
                    <Button
                        onClick={handleGenerate}
                        className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <CalendarDays className="h-4 w-4" />
                        )}
                        <span className="inline">{loading ? "Generowanie..." : "Generuj Grafik"}</span>
                    </Button>
                    <Button
                        onClick={handleClear}
                        variant="destructive"
                        className="hidden sm:flex gap-2 shadow-sm transition-all active:scale-95"
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
