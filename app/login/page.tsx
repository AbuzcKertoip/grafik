"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { AnimatedBackground } from "@/components/ui/animated-background"
import { ModernClock } from "@/components/ui/modern-clock"
import { AuthBanner } from "@/components/ui/auth-banner"

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        })

        if (res?.error) {
            setError("Nieprawidłowy login lub hasło")
            setLoading(false)
        } else {
            router.push("/dashboard")
            router.refresh()
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
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Zaloguj się</CardTitle>
                    <CardDescription className="text-center">
                        HR4YOU
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Login lub E-Mail</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="np. admin lub j.kowalski@firma.pl"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Hasło</Label>
                                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                                    Zapomniałeś hasła?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Logowanie..." : "Zaloguj się"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
