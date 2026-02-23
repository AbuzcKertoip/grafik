"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

export function ModernClock() {
    const [time, setTime] = useState<Date | null>(null)

    useEffect(() => {
        // Zabezpieczenie przed błędem hydratacji Next.js (renderujemy dopiero po załadowaniu na kliencie)
        setTime(new Date())
        const timer = setInterval(() => {
            setTime(new Date())
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    if (!time) return null

    const timeString = time.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })

    const dateString = time.toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    })

    return (
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card/60 backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300 hover:bg-card/80">
            <div className="flex items-center space-x-2 text-primary mb-1">
                <Clock className="w-5 h-5 animate-pulse" />
                <span className="text-3xl font-bold tracking-wider font-mono">
                    {timeString}
                </span>
            </div>
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                {dateString}
            </div>
        </div>
    )
}
