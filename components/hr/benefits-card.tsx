"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Wifi, Activity, Save, FileText } from "lucide-react"
import { updateBenefits } from "@/lib/actions/hr"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function BenefitsCard({
    userId,
    initialInternet,
    initialMultisport,
    initialInternetDescription,
    initialMultisportDescription,
    isAdmin
}: {
    userId: number,
    initialInternet: boolean,
    initialMultisport: boolean,
    initialInternetDescription?: string | null,
    initialMultisportDescription?: string | null,
    isAdmin: boolean
}) {
    const [internet, setInternet] = useState(initialInternet)
    const [multisport, setMultisport] = useState(initialMultisport)
    const [internetDescription, setInternetDescription] = useState(initialInternetDescription || "")
    const [multisportDescription, setMultisportDescription] = useState(initialMultisportDescription || "")
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateBenefits(userId, internet, multisport, internetDescription, multisportDescription)
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
                <div className="flex flex-col gap-4">
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
                                setHasUnsavedChanges(val !== initialMultisport || internet !== initialInternet || multisportDescription !== (initialMultisportDescription || "") || internetDescription !== (initialInternetDescription || ""))
                            }}
                        />
                    </div>
                    <div className="pl-16 pr-4">
                        <Textarea 
                            placeholder="Uwagi do karty (np. rodzaj powiązanej firmy, numer pracownika, dopłaty)..."
                            value={multisportDescription}
                            onChange={(e) => {
                                setMultisportDescription(e.target.value)
                                setHasUnsavedChanges(e.target.value !== (initialMultisportDescription || "") || internet !== initialInternet || multisport !== initialMultisport || internetDescription !== (initialInternetDescription || ""))
                            }}
                            disabled={!isAdmin}
                            className="min-h-[60px] resize-y"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4 pt-4 border-t">
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
                                setHasUnsavedChanges(val !== initialInternet || multisport !== initialMultisport || internetDescription !== (initialInternetDescription || "") || multisportDescription !== (initialMultisportDescription || ""))
                            }}
                        />
                    </div>
                    <div className="pl-16 pr-4">
                        <Textarea 
                            placeholder="Uwagi do Internetu (np. numer telefonu do karty SIM, router, wielkość pakietu)..."
                            value={internetDescription}
                            onChange={(e) => {
                                setInternetDescription(e.target.value)
                                setHasUnsavedChanges(e.target.value !== (initialInternetDescription || "") || internet !== initialInternet || multisport !== initialMultisport || multisportDescription !== (initialMultisportDescription || ""))
                            }}
                            disabled={!isAdmin}
                            className="min-h-[60px] resize-y"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
