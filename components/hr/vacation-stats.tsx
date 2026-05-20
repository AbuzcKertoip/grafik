"use client";

import { useState } from "react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface VacationStatsProps {
    userId: number
    isAdmin: boolean
    limit: number
    used: number
    baseLimit: number
    carriedOver: number
    additional?: number
    baseAdditional?: number
    additionalUsed?: number
    childcareUsed?: number
    onDemandUsed?: number
    specialLeaveUsed?: number
    childcareLimit: number
    overtimeHours: number
    contractType?: string
    has10YearsSeniority?: boolean
    hasChildren?: boolean
    saturdayHolidays?: { date: Date, name: string }[]
}

export function VacationStats({ userId, isAdmin, limit, used, baseLimit, carriedOver, additional = 0, baseAdditional = 0, additionalUsed = 0, childcareUsed = 0, onDemandUsed = 0, specialLeaveUsed = 0, childcareLimit = 0, overtimeHours = 0, contractType = "UOP", has10YearsSeniority = false, hasChildren = false, saturdayHolidays = [] }: VacationStatsProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        limit: baseLimit,
        carriedOver: carriedOver,
        additional: baseAdditional,
        contractType: contractType || "UOP",
        hasChildren: hasChildren
    })

    const remaining = limit - used
    const percentage = Math.min((used / limit) * 100, 100)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await updateVacationBalance(userId, formData.limit, formData.carriedOver, formData.additional, formData.contractType, has10YearsSeniority, formData.hasChildren)
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

    const isUOP = contractType === 'UOP' || contractType === 'UOP_PART_TIME';
    const sectionTitle = isUOP ? 'Twój Urlop' : 'Twoje Nieobecności';

    const getContractLabel = (ct: string) => {
        switch (ct) {
            case 'UOP': return 'Umowa o pracę';
            case 'UOP_PART_TIME': return 'Niepełny etat (UOP)';
            case 'B2B': return 'B2B';
            case 'UMOWA_ZLECENIE': return 'Umowa zlecenie';
            case 'UMOWA_O_DZIELO': return 'Umowa o dzieło';
            case 'INNE': return 'Inne';
            default: return ct;
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{sectionTitle}</h3>
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
                                    <DialogTitle>Bilans Urlopowy</DialogTitle>
                                    <DialogDescription>
                                        Ustaw wymiar urlopu, dni zaległe oraz dodatkowe dni wolne przyznane pracownikowi.
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
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="additional" className="text-right leading-tight">
                                            Dodatkowy
                                        </Label>
                                        <Input
                                            id="additional"
                                            type="number"
                                            value={formData.additional}
                                            onChange={(e) => setFormData({ ...formData, additional: parseInt(e.target.value) || 0 })}
                                            className="col-span-3"
                                            min={0}
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="contractType" className="text-right leading-tight">
                                            Umowa
                                        </Label>
                                        <Select 
                                            value={formData.contractType} 
                                            onValueChange={(val) => setFormData({ ...formData, contractType: val })}
                                        >
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="UOP">Umowa o pracę (UOP)</SelectItem>
                                            <SelectItem value="UOP_PART_TIME">Niepełny etat (UOP)</SelectItem>
                                            <SelectItem value="B2B">Samozatrudnienie (B2B)</SelectItem>
                                            <SelectItem value="UMOWA_ZLECENIE">Umowa zlecenie</SelectItem>
                                            <SelectItem value="UMOWA_O_DZIELO">Umowa o dzieło</SelectItem>
                                            <SelectItem value="INNE">Inne</SelectItem>
                                        </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                            <Checkbox
                                                id="hrHasChildren"
                                                checked={formData.hasChildren}
                                                onCheckedChange={(checked) => setFormData({ ...formData, hasChildren: checked as boolean })}
                                            />
                                            <Label htmlFor="hrHasChildren" className="font-normal cursor-pointer leading-snug">
                                                Pracownik posiada dzieci (przysługują 2 dni zwolnienia w ciągu roku)
                                            </Label>
                                        </div>
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

                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <span className="font-semibold uppercase text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        Umowa: {getContractLabel(contractType)}
                    </span>
                    {(contractType === 'UOP' || contractType === 'UOP_PART_TIME' || contractType === 'B2B') && (
                        <span>Staż pracy: {has10YearsSeniority ? 'Powyżej 10 lat' : 'Poniżej 10 lat'}</span>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Wykorzystanie limitu</span>
                        <span className="font-medium">{Math.round(percentage)}%</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                    <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-1">Dodatkowy Urlop</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{additional - additionalUsed}</span>
                        <span className="text-xs text-gray-500">/ {additional} dni</span>
                    </div>
                </div>
                
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-center">
                    <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-1">Opieka (Dziecko)</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{childcareLimit - childcareUsed}</span>
                        <span className="text-xs text-gray-500">/ {childcareLimit} dni</span>
                    </div>
                </div>
                
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Nadgodziny do odbioru</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{overtimeHours}</span>
                        <span className="text-xs text-gray-500">h</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-center">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 mb-1">Urlop na żądanie</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{onDemandUsed}</span>
                        <span className="text-xs text-gray-500">/ 4 dni</span>
                    </div>
                </div>

                <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg text-center">
                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 mb-1">Okolicznościowy</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{specialLeaveUsed}</span>
                        <span className="text-xs text-gray-500">dni wykorzystane</span>
                    </div>
                </div>
            </div>

            {saturdayHolidays.length > 0 && (
                <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-purple-800 dark:text-purple-300 mb-1.5 flex items-center gap-2">
                        <span>🎉</span>
                        W tym automatyczny bonus za święta w sobotę:
                    </p>
                    <ul className="space-y-1 text-purple-700/80 dark:text-purple-400/80 text-xs ml-6 list-disc">
                        {saturdayHolidays.map((h, i) => (
                            <li key={i}>
                                <span className="font-medium">{format(new Date(h.date), "d MMMM yyyy", { locale: pl })}</span> - {h.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
