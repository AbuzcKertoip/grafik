"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { resetPassword } from "@/lib/actions/auth-actions"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { ModernClock } from "@/components/ui/modern-clock"
import { AuthBanner } from "@/components/ui/auth-banner"

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get("token")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!token) {
            toast.error("Brak tokenu resetującego w adresie URL.")
            return
        }

        if (password !== confirmPassword) {
            toast.error("Podane hasła nie są takie same.")
            return
        }

        if (password.length < 6) {
            toast.error("Hasło musi składać się z minimum 6 znaków.")
            return
        }

        setIsLoading(true)
        const res = await resetPassword(token, password)
        setIsLoading(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            setIsSuccess(true)
            toast.success("Hasło zostało pomyślnie zresetowane! Przekierowanie do logowania...")
            setTimeout(() => {
                router.push("/login")
            }, 3000)
        }
    }

    if (!token) {
        return (
            <div className="p-4 bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded-md text-sm text-center">
                Błędny lub brakujący link resetujący. Spróbuj wygenerować nowy e-mail przypominający.
                <div className="mt-4">
                    <Link href="/forgot-password">
                        <Button variant="outline">Wygeneruj nowy link</Button>
                    </Link>
                </div>
            </div>
        )
    }

    if (isSuccess) {
        return (
            <div className="p-4 bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300 rounded-md text-sm text-center">
                Ustalanie nowego hasła zakończyło się powodzeniem.<br /><br />
                <Link href="/login">
                    <Button>Przejdź do logowania</Button>
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="password">Nowe hasło</Label>
                <Input
                    id="password"
                    type="password"
                    placeholder="Wprowadź docelowe nowo utworzone hasło"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Powtórz nowe hasło</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Wpisz nowe hasło ponownie"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />
            </div>
            <Button type="submit" className="w-full mt-4" disabled={isLoading}>
                {isLoading ? "Zapisywanie..." : "Zapisz i Zmień hasło"}
            </Button>
        </form>
    )
}

export default function ResetPasswordPage() {
    return (
        <div className="relative flex flex-col gap-8 h-screen items-center justify-center bg-background overflow-hidden p-4 pt-16">
            <AuthBanner />
            <AnimatedBackground />

            <div className="z-10 w-full max-w-sm">
                <ModernClock />
            </div>

            <Card className="z-10 w-full max-w-sm shadow-2xl border-white/10 bg-card/80 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Utwórz nowe hasło</CardTitle>
                    <CardDescription>
                        Ustal swoje stałe nowe hasło powiązane do Twojego konta poczty by móc zalogować się do profilu pracowniczego.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Suspense fallback={<div className="text-center py-4">Ładowanie opcji resetu...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}
