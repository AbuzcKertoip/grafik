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
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import { resetPassword } from "@/lib/actions/users"
import { toast } from "sonner"
import { KeyRound, Loader2 } from "lucide-react"

interface ResetPasswordDialogProps {
    userId: number
    username: string
}

export function ResetPasswordDialog({ userId, username }: ResetPasswordDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [newPassword, setNewPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async () => {
        if (newPassword.length < 6) {
            toast.error("Nowe hasło musi mieć co najmniej 6 znaków.")
            return
        }

        setIsLoading(true)

        try {
            const result = await resetPassword(userId, newPassword)
            if (result.success) {
                toast.success(`Zresetowano hasło dla użytkownika ${username}`)
                setIsOpen(false)
                setNewPassword("")
            } else {
                toast.error(result.error || "Błąd resetowania hasła")
            }
        } catch (error) {
            toast.error("Wystąpił błąd")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50">
                    <KeyRound className="h-4 w-4" /> Resetuj Hasło
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Reset Hasła: {username}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-new-password">Nowe hasło</Label>
                        <Input
                            id="admin-new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Wpisz nowe hasło..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Anuluj</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Zapisz
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
