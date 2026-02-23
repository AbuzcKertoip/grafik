"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { requestPasswordReset } from "@/lib/actions/auth-actions"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { ModernClock } from "@/components/ui/modern-clock"
import { AuthBanner } from "@/components/ui/auth-banner"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) {
            toast.error("Wprowadź adres e-mail")
            return
        }

        setIsLoading(true)
        const res = await requestPasswordReset(email)
        setIsLoading(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            setIsSuccess(true)
            toast.success(res.message || "Wysłano link resetujący")
        }
    }

    return (
        <div className="relative flex flex-col gap-8 h-screen items-center justify-center bg-background overflow-hidden p-4 pt-16">
            <AuthBanner />
            <AnimatedBackground />

            <div className="z-10 w-full max-w-sm">
                <ModernClock />
            </div>

            <Card className="z-10 w-full max-w-sm shadow-2xl border-white/10 bg-card/80 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Resetowanie hasła</CardTitle>
                    <CardDescription>
                        Wprowadź swój adres e-mail używany w firmie, aby otrzymać link do wygenerowania nowego hasła.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {isSuccess ? (
                            <div className="p-4 bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300 rounded-md text-sm text-center">
                                Sprawdź swoją skrzynkę odbiorczą. Jeśli Twoje konto istnieje, otrzymasz wkrótce e-mail z instrukcją ustawienia nowego hasła.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="jkowalski@firma.pl"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        {!isSuccess && (
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "Wysyłanie..." : "Wyślij link do resetowania"}
                            </Button>
                        )}
                        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Powrót do logowania
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
