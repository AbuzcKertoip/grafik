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
    DialogTrigger,
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
import { createUser, updateUser } from "@/lib/actions/users"
import { useRouter } from "next/navigation"

interface UserFormDialogProps {
    user?: any
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function UserFormDialog({ user, trigger, open, onOpenChange }: UserFormDialogProps) {
    const router = useRouter()
    const [internalOpen, setInternalOpen] = useState(false)
    const isEdit = !!user

    // Use controlled or uncontrolled state for dialog open
    const isOpen = open !== undefined ? open : internalOpen
    const setIsOpen = onOpenChange || setInternalOpen

    const [formData, setFormData] = useState({
        username: user?.username || "",
        name: user?.name || "",
        role: user?.role || "USER",
        password: "",
        hourlyRate: user?.hourlyRate || 0,
        sortOrder: user?.sortOrder || 999,
        fixedShift: user?.fixedShift || "",
        skipDuties: user?.skipDuties || false,
    })

    const handleChange = (field: string, value: string | number | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        let result
        if (isEdit) {
            result = await updateUser(user.id, formData)
        } else {
            result = await createUser(formData)
        }

        if (result?.success) {
            setIsOpen(false)
            router.refresh()
            if (!isEdit) {
                setFormData({
                    username: "",
                    name: "",
                    role: "USER",
                    password: "",
                    hourlyRate: 0,
                    sortOrder: 999,
                    fixedShift: "",
                    skipDuties: false
                })
            }
        } else {
            alert(result?.error || "Wystąpił błąd")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edytuj pracownika" : "Dodaj pracownika"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Zmień dane istniejącego pracownika." : "Wprowadź dane nowego pracownika do systemu."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Imię
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="username" className="text-right">
                            Login
                        </Label>
                        <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => handleChange("username", e.target.value)}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                            Rola
                        </Label>
                        <Select
                            value={formData.role}
                            onValueChange={(val) => handleChange("role", val)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Wybierz rolę" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USER">Pracownik</SelectItem>
                                <SelectItem value="ADMIN">Manager (Admin)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="hourlyRate" className="text-right">
                            Stawka/h
                        </Label>
                        <Input
                            id="hourlyRate"
                            type="number"
                            step="0.01"
                            value={formData.hourlyRate}
                            onChange={(e) => handleChange("hourlyRate", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sortOrder" className="text-right">
                            Kolejność
                        </Label>
                        <Input
                            id="sortOrder"
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => handleChange("sortOrder", parseInt(e.target.value))}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fixedShift" className="text-right">
                            Stała zmiana
                        </Label>
                        <Select
                            value={formData.fixedShift}
                            onValueChange={(val) => handleChange("fixedShift", val === "NONE" ? "" : val)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Brak (domyślnie)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">Brak (Losowo)</SelectItem>
                                <SelectItem value="SHIFT_1">Zmiana 1 (8-16)</SelectItem>
                                <SelectItem value="SHIFT_2">Zmiana 2 (16-24/11-19)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="skipDuties" className="text-right">
                            Bez dyżurów
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="skipDuties"
                                checked={formData.skipDuties}
                                onChange={(e) => handleChange("skipDuties", e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-500">Pomiń przy losowaniu weekendów</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                            Hasło
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder={isEdit ? "(bez zmian)" : ""}
                            value={formData.password}
                            onChange={(e) => handleChange("password", e.target.value)}
                            className="col-span-3"
                            required={!isEdit}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit">Zapisz</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
