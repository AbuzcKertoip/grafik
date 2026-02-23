"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { createUser } from "@/lib/actions/admin"
import { ROLES } from "@/lib/auth/permissions"
import { Checkbox } from "@/components/ui/checkbox"

interface UserCreateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    departments: any[]
    onUpdate: () => void
}

export function UserCreateDialog({ open, onOpenChange, departments, onUpdate }: UserCreateDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        name: "",
        role: ROLES.USER as string,
        departmentId: "null",
        skipDuties: false,
        fixedShift: "NONE"
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSave = async () => {
        if (!formData.username || !formData.password || !formData.name || !formData.email) {
            toast.error("Wypełnij puste wymagane pola")
            return
        }

        // basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email)) {
            toast.error("Wprowadź poprawny adres e-mail")
            return
        }

        setIsLoading(true)
        const res = await createUser({
            ...formData,
            departmentId: formData.departmentId === "null" ? null : parseInt(formData.departmentId)
        })
        setIsLoading(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Użytkownik został pomyślnie dodany")
            setFormData({
                username: "",
                email: "",
                password: "",
                name: "",
                role: ROLES.USER as string,
                departmentId: "null",
                skipDuties: false,
                fixedShift: "NONE"
            })
            onUpdate()
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Dodaj nowego pracownika</DialogTitle>
                    <DialogDescription>
                        Stwórz konto dostępowe dla nowego członka zespołu określając jego rolę i dział.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Login (nazwa użytkownika) *</Label>
                                <Input id="username" name="username" value={formData.username} onChange={handleChange} placeholder="jkowalski" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Hasło startowe *</Label>
                                <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Podaj trudne hasło" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Imię i nazwisko *</Label>
                                <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Jan Kowalski" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Adres e-mail (firmowy) *</Label>
                                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="jkowalski@firma.pl" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Rola systemowa</Label>
                            <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(ROLES).map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Przynależność do działu</Label>
                            <Select value={formData.departmentId} onValueChange={(val) => setFormData({ ...formData, departmentId: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz dział" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">Brak</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Opcje Grafiku</Label>
                        <div className="grid grid-cols-1 gap-4 border rounded-md p-4 bg-muted/20">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="createSkipDuties"
                                    checked={formData.skipDuties}
                                    onCheckedChange={(val) => setFormData({ ...formData, skipDuties: val as boolean })}
                                />
                                <Label htmlFor="createSkipDuties" className="font-normal cursor-pointer">
                                    Zwolniony z obowiązków dyżurowych (weekendy, święta)
                                </Label>
                            </div>

                            <div className="grid gap-2">
                                <Label className="font-normal">Przypisz stałą zmianę (opcjonalnie)</Label>
                                <Select value={formData.fixedShift} onValueChange={(val) => setFormData({ ...formData, fixedShift: val })}>
                                    <SelectTrigger className="w-full sm:w-[250px] bg-background">
                                        <SelectValue placeholder="Brak" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Brak przypisania</SelectItem>
                                        <SelectItem value="SHIFT_1">Zmiana 1</SelectItem>
                                        <SelectItem value="SHIFT_2">Zmiana 2</SelectItem>
                                        <SelectItem value="SHIFT_3">Zmiana 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={handleSave} disabled={isLoading}>Utwórz użytkownika</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
