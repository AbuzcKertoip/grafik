"use client";

import { useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Edit2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { updateVacationBalance } from "@/lib/actions/hr"
import { useRouter } from "next/navigation"

interface VacationStatsProps {
    userId: number
    isAdmin: boolean
    limit: number
    used: number
    baseLimit: number
    carriedOver: number
}

export function VacationStats({ userId, isAdmin, limit, used, baseLimit, carriedOver }: VacationStatsProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        limit: baseLimit,
        carriedOver: carriedOver
    })

    const remaining = limit - used
    const percentage = Math.min((used / limit) * 100, 100)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await updateVacationBalance(userId, formData.limit, formData.carriedOver)
            if (res.success) {
                toast.success("Bilans urlopowy zaktualizowany")
                setIsOpen(false)
                router.refresh()
            } else {
                toast.error(res.error || "Wystąpił błąd")
            }
        } catch (error) {
            toast.error("Wystąpił błąd serwera")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Twój Urlop</h3>
                {isAdmin && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8">
                                <Edit2 className="w-4 h-4 mr-2" />
                                Edytuj Bilans
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Bilans Otwarcia Urlopu</DialogTitle>
                                <DialogDescription>
                                    Ustaw wymiar urlopu oraz wskaż zaległe dni wolne przeniesione z poprzedniego roku.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSave} className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="limit" className="text-right">
                                        Wymiar (dni)
                                    </Label>
                                    <Input
                                        id="limit"
                                        type="number"
                                        value={formData.limit}
                                        onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) || 0 })}
                                        className="col-span-3"
                                        min={0}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="carriedOver" className="text-right leading-tight">
                                        Zaległy
                                    </Label>
                                    <Input
                                        id="carriedOver"
                                        type="number"
                                        value={formData.carriedOver}
                                        onChange={(e) => setFormData({ ...formData, carriedOver: parseInt(e.target.value) || 0 })}
                                        className="col-span-3"
                                        min={0}
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? "Zapisywanie..." : "Zapisz Zmiany"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg relative group">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{limit}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Limit</p>
                    {carriedOver > 0 && (
                        <div className="absolute -top-2 -right-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800" title="W tym zaległy urlop">
                            +{carriedOver}
                        </div>
                    )}
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400">
                    <p className="text-2xl font-bold">{used}</p>
                    <p className="text-xs opacity-80 uppercase">Wykorzystane</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
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
