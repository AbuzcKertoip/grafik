"use strict";
import { Progress } from "@/components/ui/progress"

interface VacationStatsProps {
    limit: number
    used: number
}

export function VacationStats({ limit, used }: VacationStatsProps) {
    const remaining = limit - used
    const percentage = Math.min((used / limit) * 100, 100)

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Twój Urlop</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{limit}</p>
                    <p className="text-xs text-gray-500 uppercase">Limit</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-blue-700">
                    <p className="text-2xl font-bold">{used}</p>
                    <p className="text-xs opacity-80 uppercase">Wykorzystane</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-green-700">
                    <p className="text-2xl font-bold">{remaining}</p>
                    <p className="text-xs opacity-80 uppercase">Pozostało</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span>Wykorzystanie limitu</span>
                    <span className="font-medium">{Math.round(percentage)}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
            </div>
        </div>
    )
}
