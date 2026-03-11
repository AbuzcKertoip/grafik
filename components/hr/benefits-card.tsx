"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Wifi, Activity, Save } from "lucide-react"
import { updateBenefits } from "@/lib/actions/hr"
import { toast } from "sonner"

export function BenefitsCard({
    userId,
    initialInternet,
    initialMultisport,
    isAdmin
}: {
    userId: number,
    initialInternet: boolean,
    initialMultisport: boolean,
    isAdmin: boolean
}) {
    const [internet, setInternet] = useState(initialInternet)
    const [multisport, setMultisport] = useState(initialMultisport)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateBenefits(userId, internet, multisport)
            if (result.success) {
                toast.success("Zaktualizowano benefity")
                setHasUnsavedChanges(false)
            } else {
                toast.error(result.error)
            }
        })
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pakiety i Benefity</CardTitle>
                {isAdmin && hasUnsavedChanges && (
                    <Button size="sm" onClick={handleSave} disabled={isPending} className="h-8">
                        <Save className="h-4 w-4 mr-2" />
                        {isPending ? "Zapisywanie..." : "Zapisz Zmiany"}
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <Label htmlFor="multisport" className="text-base">Karta Multisport</Label>
                            <p className="text-sm text-muted-foreground">Pracownik korzysta z pakietu sportowego</p>
                        </div>
                    </div>
                    <Switch
                        id="multisport"
                        checked={multisport}
                        disabled={!isAdmin}
                        onCheckedChange={(val) => {
                            setMultisport(val)
                            setHasUnsavedChanges(val !== initialMultisport || internet !== initialInternet)
                        }}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                            <Wifi className="h-5 w-5" />
                        </div>
                        <div className="space-y-0.5">
                            <Label htmlFor="internet" className="text-base">Internet Pracowniczy</Label>
                            <p className="text-sm text-muted-foreground">Pracownik korzysta z firmowego pakietu internetowego</p>
                        </div>
                    </div>
                    <Switch
                        id="internet"
                        checked={internet}
                        disabled={!isAdmin}
                        onCheckedChange={(val) => {
                            setInternet(val)
                            setHasUnsavedChanges(val !== initialInternet || multisport !== initialMultisport)
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
