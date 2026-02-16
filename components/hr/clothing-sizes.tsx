"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shirt, Ruler, Footprints, PenSquare } from "lucide-react" // Lucide has limited clothing icons, using approximations
import { updateClothingSizes } from "@/lib/actions/hr"
import { toast } from "sonner"

interface Sizes {
    shirt: string | null
    pants: string | null
    shoe: string | null
    jacket: string | null
}

export function ClothingSizes({
    sizes,
    userId,
    isAdmin
}: {
    sizes: Sizes,
    userId: number,
    isAdmin: boolean
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        const newSizes = {
            shirt: formData.get("shirt") as string,
            pants: formData.get("pants") as string,
            shoe: formData.get("shoe") as string,
            jacket: formData.get("jacket") as string
        }

        startTransition(async () => {
            const result = await updateClothingSizes(userId, newSizes)
            if (result.success) {
                setIsEditing(false)
                toast.success("Rozmiary zaktualizowane")
                // Optimistic update could be added here, but revalidatePath handles it
            } else {
                toast.error(result.error)
            }
        })
    }

    // Always render for now to allow editing
    // If we want read-only view for others later, pass `canEdit` prop

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Shirt className="h-5 w-5" />
                    Rozmiary Ubrań
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                    <PenSquare className="h-4 w-4 mr-1" />
                    Edytuj
                </Button>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1"><Shirt className="w-3 h-3" /> Koszulka / T-Shirt</Label>
                                <Input name="shirt" defaultValue={sizes.shirt || ''} placeholder="np. L" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1"><Ruler className="w-3 h-3" /> Spodnie (Pas/Długość)</Label>
                                <Input name="pants" defaultValue={sizes.pants || ''} placeholder="np. 32/32" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1"><Footprints className="w-3 h-3" /> Buty</Label>
                                <Input name="shoe" defaultValue={sizes.shoe || ''} placeholder="np. 43" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-1"><Shirt className="w-3 h-3" /> Kurtka / Polar</Label>
                                <Input name="jacket" defaultValue={sizes.jacket || ''} placeholder="np. XL" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Anuluj</Button>
                            <Button type="submit" disabled={isPending}>Zapisz</Button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg border">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Shirt className="w-3 h-3" /> Koszulka</p>
                            <p className="font-bold text-lg text-foreground">{sizes.shirt || '-'}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" /> Spodnie</p>
                            <p className="font-bold text-lg text-foreground">{sizes.pants || '-'}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Footprints className="w-3 h-3" /> Buty</p>
                            <p className="font-bold text-lg text-foreground">{sizes.shoe || '-'}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg border">
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><Shirt className="w-3 h-3" /> Kurtka</p>
                            <p className="font-bold text-lg text-foreground">{sizes.jacket || '-'}</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
