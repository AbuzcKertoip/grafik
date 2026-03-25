"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Trash2, Wrench, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getCarRepairs, addCarRepair, deleteCarRepair } from "@/lib/actions/fleet"
import { useRouter } from "next/navigation"

interface CarRepair {
    id: number
    carId: number
    date: Date
    cost: number
    description: string
    notes: string | null
    invoiceUrl: string | null
}

interface CarRepairsDialogProps {
    carId: number
    carName: string
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    isAdmin: boolean
}

export function CarRepairsDialog({ carId, carName, isOpen, onOpenChange, isAdmin }: CarRepairsDialogProps) {
    const [repairs, setRepairs] = useState<CarRepair[]>([])
    const [isLoadingRepairs, setIsLoadingRepairs] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const router = useRouter()

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        cost: 0,
        description: "",
        notes: ""
    })

    useEffect(() => {
        if (isOpen && carId) {
            loadRepairs()
        }
    }, [isOpen, carId])

    const loadRepairs = async () => {
        setIsLoadingRepairs(true)
        try {
            const data = await getCarRepairs(carId)
            setRepairs(data)
        } catch (error) {
            toast.error("Nie udało się pobrać historii napraw")
        } finally {
            setIsLoadingRepairs(false)
        }
    }

    const handleSubmit = async () => {
        if (!formData.description || formData.cost < 0 || !formData.date) {
            toast.error("Wypełnij wymagane pola: Opis prac i Koszt.")
            return
        }

        setIsSaving(true)
        try {
            let uploadedInvoiceUrl = null

            // Wgrywanie pliku, jeśli istnieje
            if (file) {
                const form = new FormData()
                form.append("file", file)

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: form
                })

                if (!uploadRes.ok) throw new Error("Błąd wgrywania pliku")
                const uploadData = await uploadRes.json()
                uploadedInvoiceUrl = uploadData.url
            }

            // Zapis do bazy
            const result = await addCarRepair(carId, {
                date: new Date(formData.date),
                cost: Number(formData.cost),
                description: formData.description,
                notes: formData.notes,
                invoiceUrl: uploadedInvoiceUrl
            })

            if (result.success) {
                toast.success("Zapisano wprowadzony serwis!")
                setFormData({
                    date: new Date().toISOString().split('T')[0],
                    cost: 0,
                    description: "",
                    notes: ""
                })
                setFile(null)
                // Odśwież listę po prawej stronie
                await loadRepairs()
            } else {
                toast.error(result.error || "Wystąpił błąd zapisu naprawy.")
            }
        } catch (e) {
            toast.error("Wystąpił błąd podczas operacji na formularzu.")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć wybrany wpis serwisowy? Tej operacji nie cofniemy.")) return

        const result = await deleteCarRepair(id)
        if (result.success) {
            toast.success("Wpis został usunięty.")
            await loadRepairs()
        } else {
            toast.error("Błąd podczas usuwania. Sprawdź uprawnienia.")
        }
    }

    const totalCost = repairs.reduce((sum, item) => sum + item.cost, 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-[90vw] md:max-w-[1000px] h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Wrench className="w-5 h-5 text-indigo-500" />
                        Naprawy Serwisowe: {carName}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
                    {/* Lista Napraw */}
                    <div className="border-r overflow-y-auto bg-muted/10 p-6 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                Historia Napraw
                            </h3>
                            <div className="text-sm font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">
                                Suma: {totalCost.toFixed(2)} PLN
                            </div>
                        </div>

                        {isLoadingRepairs ? (
                            <div className="flex items-center justify-center p-8 text-muted-foreground flex-1">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Ładowanie historii...
                            </div>
                        ) : repairs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground flex-1 border-2 border-dashed rounded-lg bg-card">
                                <Wrench className="h-8 w-8 mb-2 opacity-20" />
                                <p>Brak zgłoszonych napraw dla tego pojazdu.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 pb-8">
                                {repairs.map(repair => (
                                    <div key={repair.id} className="bg-card border rounded-lg p-4 shadow-sm hover:border-indigo-200 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-medium text-base text-foreground">
                                                {repair.description}
                                            </div>
                                            <div className="font-bold text-red-600 shrink-0">
                                                -{repair.cost.toFixed(2)} PLN
                                            </div>
                                        </div>
                                        
                                        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
                                            <span className="bg-muted px-2 py-0.5 rounded">
                                                {format(new Date(repair.date), "dd MMMM yyyy", { locale: pl })}
                                            </span>
                                        </div>

                                        {repair.notes && (
                                            <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border mb-3">
                                                {repair.notes}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                            <div>
                                                {repair.invoiceUrl ? (
                                                    <a href={repair.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors">
                                                        <Download className="w-3 h-3" /> Zobacz załącznik
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Brak dokumentu</span>
                                                )}
                                            </div>
                                            {isAdmin && (
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(repair.id)} className="h-7 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Formularz dodawania */}
                    <div className="overflow-y-auto p-6 bg-card flex flex-col">
                        {isAdmin ? (
                            <>
                                <h3 className="font-semibold text-lg mb-4 text-indigo-900 dark:text-indigo-200">Zarejestruj Nowy Serwis</h3>
                                <div className="space-y-4 flex-1">
                                    <div className="space-y-2">
                                        <Label htmlFor="repair-desc" className="text-xs font-semibold uppercase text-muted-foreground">Krótki opis naprawy *</Label>
                                        <Input 
                                            id="repair-desc" 
                                            placeholder="np. Wymiana klocków przód" 
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="repair-date" className="text-xs font-semibold uppercase text-muted-foreground">Data Serwisu *</Label>
                                            <Input 
                                                id="repair-date" 
                                                type="date" 
                                                value={formData.date}
                                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="repair-cost" className="text-xs font-semibold uppercase text-muted-foreground">Całkowity Koszt (PLN) *</Label>
                                            <Input 
                                                id="repair-cost" 
                                                type="number" 
                                                step="0.01"
                                                min="0"
                                                value={formData.cost}
                                                onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="repair-notes" className="text-xs font-semibold uppercase text-muted-foreground">Szczegółowe Notatki</Label>
                                        <Textarea 
                                            id="repair-notes" 
                                            placeholder="Dodatkowy opis robocizny, użyte części wyższego rzędu..." 
                                            rows={4}
                                            value={formData.notes}
                                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                            className="resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2 border-t pt-4">
                                        <Label htmlFor="repair-file" className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Skan faktury / Rachunku</Label>
                                        <div className="flex items-center gap-3">
                                            <Input 
                                                id="repair-file" 
                                                type="file" 
                                                accept="image/*,application/pdf"
                                                onChange={e => setFile(e.target.files?.[0] || null)}
                                                className="cursor-pointer file:bg-muted file:text-foreground file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md hover:file:bg-muted/80"
                                            />
                                            {file && (
                                                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="shrink-0 text-red-500 hover:text-red-700">
                                                    Wyczyść
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Max 5MB. Przyjmowane formaty: PDF, JPG, PNG.</p>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t">
                                    <Button onClick={handleSubmit} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                                        {isSaving ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Trwa dodawanie...</>
                                        ) : (
                                            <><Wrench className="mr-2 h-4 w-4" /> Zarejestruj wpis serwisowy</>
                                        )}
                                    </Button>
                                    </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground flex-1">
                                <Wrench className="h-12 w-12 mb-4 opacity-20" />
                                <p className="text-center font-medium mb-1">Tylko odczyt</p>
                                <p className="text-sm text-center">Dodawanie wpisów jest zastrzeżone dla Administracji / Managera HR.</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
