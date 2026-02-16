"use strict";
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { addMedicalExam, deleteMedicalExam } from "@/lib/actions/hr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"

interface MedicalExamListProps {
    exams: any[]
    userId: number
    isAdmin: boolean
}

export function MedicalExamList({ exams, userId, isAdmin }: MedicalExamListProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [newExam, setNewExam] = useState({
        type: "MEDICINE_WORK",
        date: ""
    })

    const handleAdd = async () => {
        if (!newExam.date) return
        await addMedicalExam(userId, newExam.type, new Date(newExam.date))
        setIsOpen(false)
        router.refresh()
    }

    const handleDelete = async (id: number) => {
        if (confirm("Czy na pewno usunąć badanie?")) {
            await deleteMedicalExam(id)
            router.refresh()
        }
    }

    const getStatus = (date: Date) => {
        const now = new Date()
        const diffTime = date.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays < 0) return { color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20", text: "Przeterminowane", icon: <AlertTriangle className="h-4 w-4" /> }
        if (diffDays < 30) return { color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20", text: `Wygasa za ${diffDays} dni`, icon: <AlertTriangle className="h-4 w-4" /> }
        return { color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20", text: "Ważne", icon: <CheckCircle className="h-4 w-4" /> }
    }

    const typeLabels: Record<string, string> = {
        'MEDICINE_WORK': 'Medycyna Pracy',
        'SANITARY': 'Badania Sanitarno-Epidemiologiczne',
        'SAFETY_TRAINING': 'Szkolenie BHP',
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Badania i Szkolenia</h3>
                {isAdmin && (
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">Dodaj Badanie</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Dodaj nowe badanie</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Typ</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newExam.type}
                                        onChange={(e) => setNewExam({ ...newExam, type: e.target.value })}
                                    >
                                        <option value="MEDICINE_WORK">Medycyna Pracy</option>
                                        <option value="SANITARY">Sanitarno-Epidemiologiczne</option>
                                        <option value="SAFETY_TRAINING">Szkolenie BHP</option>
                                    </select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Data ważności</Label>
                                    <Input
                                        type="date"
                                        value={newExam.date}
                                        onChange={(e) => setNewExam({ ...newExam, date: e.target.value })}
                                    />
                                </div>
                                <Button onClick={handleAdd}>Zapisz</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid gap-3">
                {exams.length === 0 ? (
                    <p className="text-muted-foreground italic">Brak wpisów.</p>
                ) : (
                    exams.map((exam) => {
                        const status = getStatus(new Date(exam.validUntil))
                        return (
                            <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg bg-card text-card-foreground shadow-sm dark:border-slate-800">
                                <div>
                                    <p className="font-medium">{typeLabels[exam.type] || exam.type}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Ważne do: {format(new Date(exam.validUntil), "d MMMM yyyy", { locale: pl })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                                        {status.icon} {status.text}
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(exam.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
