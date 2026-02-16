"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <Card className="w-full max-w-sm shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Zaloguj się</CardTitle>
                    <CardDescription className="text-center">
                        System Grafiku i Ewidencji Czasu Pracy
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Login</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="np. admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Hasło</Label>
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
