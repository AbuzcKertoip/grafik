"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monitor, Laptop, Smartphone, Plus, Trash2, HardDrive } from "lucide-react"
import { addEquipment, deleteEquipment } from "@/lib/actions/hr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"

interface Equipment {
    id: number
    name: string
    serialNumber: string | null
    assignedDate: Date
    notes: string | null
}

export function EquipmentList({
    equipment,
    userId,
    isAdmin
}: {
    equipment: Equipment[],
    userId: number,
    isAdmin: boolean
}) {
    const [isAdding, setIsAdding] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const serialNumber = formData.get("serialNumber") as string
        const notes = formData.get("notes") as string

        startTransition(async () => {
            const result = await addEquipment(userId, name, serialNumber, notes)
            if (result.success) {
                setIsAdding(false)
                toast.success("Sprzęt dodany")
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć ten sprzęt?")) return

        startTransition(async () => {
            const result = await deleteEquipment(id)
            if (result.success) {
                toast.success("Sprzęt usunięty")
            } else {
                toast.error(result.error)
            }
        })
    }

    const getIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes("laptop")) return <Laptop className="h-5 w-5" />
        if (lower.includes("monitor") || lower.includes("ekran")) return <Monitor className="h-5 w-5" />
        if (lower.includes("telefon") || lower.includes("iphone") || lower.includes("samsung")) return <Smartphone className="h-5 w-5" />
        return <HardDrive className="h-5 w-5" />
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Przypisany Sprzęt
                </CardTitle>
                {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Dodaj Sprzęt
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isAdding && (
                    <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid gap-2">
                            <Label>Nazwa Sprzętu</Label>
                            <Input name="name" placeholder="np. Laptop Dell Latitude 5520" required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Numer Seryjny</Label>
                            <Input name="serialNumber" placeholder="np. 8H2K922" required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Uwagi</Label>
                            <Input name="notes" placeholder="np. Stan dobry, ryska na klapie" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Anuluj</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Dodawanie..." : "Zapisz"}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {equipment.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Brak przypisanego sprzętu.</p>
                    ) : (
                        equipment.map(item => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex gap-3">
                                    <div className="mt-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                        {getIcon(item.name)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{item.name}</p>
                                        <p className="text-sm text-muted-foreground font-mono">SN: {item.serialNumber || 'Brak'}</p>
                                        <div className="flex gap-2 text-xs text-gray-400 mt-1">
                                            <span>Wydano: {format(new Date(item.assignedDate), "d MMM yyyy", { locale: pl })}</span>
                                            {item.notes && <span>• {item.notes}</span>}
                                        </div>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(item.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
