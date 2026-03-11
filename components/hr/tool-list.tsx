"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wrench, Hammer, Plus, Trash2, PenTool } from "lucide-react"
import { addTool, deleteTool } from "@/lib/actions/hr"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { toast } from "sonner"

interface ToolItem {
    id: number
    name: string
    assignedDate: Date
    notes: string | null
}

export function ToolList({
    tools,
    userId,
    isAdmin
}: {
    tools: ToolItem[],
    userId: number,
    isAdmin: boolean
}) {
    const [isAdding, setIsAdding] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const notes = formData.get("notes") as string

        startTransition(async () => {
            const result = await addTool(userId, name, notes)
            if (result.success) {
                setIsAdding(false)
                toast.success("Narzędzie wydane")
            } else {
                toast.error(result.error)
            }
        })
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć/zdać to narzędzie?")) return

        startTransition(async () => {
            const result = await deleteTool(id)
            if (result.success) {
                toast.success("Narzędzie usunięte z konta pracownika")
            } else {
                toast.error(result.error)
            }
        })
    }

    const getIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes("wkrętarka") || lower.includes("młot")) return <Hammer className="h-5 w-5" />
        if (lower.includes("klucz") || lower.includes("klucze")) return <Wrench className="h-5 w-5" />
        return <PenTool className="h-5 w-5" />
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    Wydane Narzędzia
                </CardTitle>
                {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Wydaj Narzędzie
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {isAdding && (
                    <form onSubmit={handleSubmit} className="mb-6 p-4 border rounded-lg bg-muted/50 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid gap-2">
                            <Label>Nazwa Narzędzia</Label>
                            <Input name="name" placeholder="np. Wkrętarka Makita, Zestaw kluczy" required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Uwagi / Nr Seryjny</Label>
                            <Input name="notes" placeholder="np. Kompletne z 2 bateriami" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Anuluj</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Zapisywanie..." : "Wydaj"}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="space-y-4">
                    {tools.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Brak wydanych narzędzi.</p>
                    ) : (
                        tools.map(item => (
                            <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex gap-3">
                                    <div className="mt-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg">
                                        {getIcon(item.name)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{item.name}</p>
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
