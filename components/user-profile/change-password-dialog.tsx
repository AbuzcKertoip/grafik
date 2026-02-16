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
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { changePassword } from "@/lib/actions/users"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface ChangePasswordDialogProps {
    userId: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ userId, open, onOpenChange }: ChangePasswordDialogProps) {
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (newPassword !== confirmPassword) {
            toast.error("Nowe hasła nie są identyczne.")
            return
        }

        if (newPassword.length < 6) {
            toast.error("Nowe hasło musi mieć co najmniej 6 znaków.")
            return
        }

        setIsLoading(true)

        try {
            const result = await changePassword(userId, oldPassword, newPassword)
            if (result.success) {
                toast.success("Hasło zostało zmienione.")
                setOldPassword("")
                setNewPassword("")
                setConfirmPassword("")
                onOpenChange(false)
            } else {
                toast.error(result.error || "Błąd zmiany hasła")
            }
        } catch (error) {
            toast.error("Wystąpił błąd")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Zmiana Hasła</DialogTitle>
                    <DialogDescription>
                        Wprowadź swoje obecne hasło oraz nowe hasło, aby je zmienić.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="old-password">Obecne hasło</Label>
                        <Input
                            id="old-password"
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password">Nowe hasło</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Potwierdź nowe hasło</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Zmień Hasło
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
