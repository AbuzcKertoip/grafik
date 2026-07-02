"use client"

import { useState, useEffect } from "react"
import { updateSystemSettings, testSmtpConnection } from "@/lib/actions/system-settings"
import { testDiscordWebhook } from "@/lib/actions/discord"
import { getEmailLogs, triggerManualAlerts } from "@/lib/actions/email-logs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Save, Send, RefreshCw, MailWarning, MessageCircle } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface SystemSettingsProps {
    settings: any
}

export function SystemSettingsTab({ settings }: SystemSettingsProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [isTestingDiscord, setIsTestingDiscord] = useState(false)
    const [isTriggering, setIsTriggering] = useState(false)
    const [logs, setLogs] = useState<any[]>([])
    const [formData, setFormData] = useState({
        smtpHost: settings?.smtpHost || "",
        smtpPort: settings?.smtpPort || "",
        smtpUser: settings?.smtpUser || "",
        smtpPassword: settings?.smtpPassword || "",
        smtpFromEmail: settings?.smtpFromEmail || "",
        smtpSecure: settings?.smtpSecure ?? true,
        alertEmails: settings?.alertEmails || "",
        alertDaysBefore: settings?.alertDaysBefore || 30,
        discordWebhookUrl: settings?.discordWebhookUrl || "",
    })
    const [testEmail, setTestEmail] = useState("")

    useEffect(() => {
        loadLogs()
    }, [])

    const loadLogs = async () => {
        try {
            const data = await getEmailLogs()
            setLogs(data)
        } catch (error) {
            console.error("Failed to load email logs", error)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSave = async () => {
        setIsLoading(true)
        try {
            const res = await updateSystemSettings(formData)
            if (res.success) {
                toast.success("Ustawienia zostały zapisane.")
            }
        } catch (error: any) {
            toast.error(error.message || "Błąd podczas zapisu ustawień.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleTestEmail = async () => {
        if (!testEmail) {
            toast.error("Wprowadź adres e-mail do testu.")
            return
        }
        setIsTesting(true)
        try {
            const res = await testSmtpConnection(testEmail)
            if (res.success) {
                toast.success(res.message)
                loadLogs() // Refresh logs after sending
            } else {
                toast.error(res.error)
            }
        } catch (error: any) {
            toast.error("Wystąpił błąd krytyczny.")
        } finally {
            setIsTesting(false)
        }
    }

    const handleTestDiscord = async () => {
        setIsTestingDiscord(true)
        try {
            // Save first so the test uses the URL currently typed into the form
            await updateSystemSettings(formData)
            const res = await testDiscordWebhook()
            if (res.success) {
                toast.success(res.message)
            } else {
                toast.error(res.error)
            }
        } catch (error: any) {
            toast.error("Wystąpił błąd krytyczny.")
        } finally {
            setIsTestingDiscord(false)
        }
    }

    const handleManualTrigger = async () => {
        setIsTriggering(true)
        try {
            const res = await triggerManualAlerts()
            if (res.success) {
                toast.success(res.message)
                loadLogs() // Refresh logs
            } else {
                toast.error(res.error)
            }
        } catch (error: any) {
            toast.error("Wystąpił błąd krytyczny.")
        } finally {
            setIsTriggering(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Serwer SMTP</CardTitle>
                        <CardDescription>
                            Konfiguracja poczty wychodzącej potrzebna do wysyłania alertów i powiadomień systemu.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="smtpHost">Host serwera</Label>
                                <Input id="smtpHost" name="smtpHost" value={formData.smtpHost} onChange={handleChange} placeholder="np. smtp.gmail.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="smtpPort">Port</Label>
                                <Input id="smtpPort" name="smtpPort" type="number" value={formData.smtpPort} onChange={handleChange} placeholder="np. 465, 587" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser">Użytkownik / Login</Label>
                            <Input id="smtpUser" name="smtpUser" value={formData.smtpUser} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPassword">Hasło</Label>
                            <Input id="smtpPassword" name="smtpPassword" type="password" value={formData.smtpPassword} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpFromEmail">Email Nadawcy</Label>
                            <Input id="smtpFromEmail" name="smtpFromEmail" value={formData.smtpFromEmail} onChange={handleChange} placeholder="system@firma.pl" />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="smtpSecure"
                                checked={formData.smtpSecure}
                                onCheckedChange={(checked) => setFormData({ ...formData, smtpSecure: checked })}
                            />
                            <Label htmlFor="smtpSecure">Używaj SSL/TLS (Domyślnie dla portu 465)</Label>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto">
                            {isLoading ? "Zapisywanie..." : <><Save className="w-4 h-4 mr-2" /> Zapisz konfigurację</>}
                        </Button>
                    </CardFooter>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Powiadomienia i Alerty</CardTitle>
                            <CardDescription>
                                Zasady automatycznego wysyłania e-maili o kończących się badaniach i ubezpieczeniach.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="alertEmails">Odbiorcy powiadomień</Label>
                                <Input
                                    id="alertEmails"
                                    name="alertEmails"
                                    value={formData.alertEmails}
                                    onChange={handleChange}
                                    placeholder="Wpisz adresy oddzielone przecinkiem"
                                />
                                <p className="text-xs text-muted-foreground">Adresy e-mail osób zarządzających flotą i HR (np. dyrektor@firma.pl, hr@firma.pl).</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="alertDaysBefore">Wyprzedzenie (w dniach)</Label>
                                <Input
                                    id="alertDaysBefore"
                                    name="alertDaysBefore"
                                    type="number"
                                    value={formData.alertDaysBefore}
                                    onChange={handleChange}
                                />
                                <p className="text-xs text-muted-foreground">System ostrzeże, jeśli badanie/ubezpieczenie kończy się w przeciągu X dni od teraz.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                            <Button onClick={handleSave} disabled={isLoading} variant="secondary">
                                {isLoading ? "Zapisywanie..." : "Zapisz zasady alertów"}
                            </Button>

                            <Button onClick={handleManualTrigger} disabled={isTriggering} variant="outline" className="border-indigo-500 text-indigo-600 hover:bg-indigo-50">
                                {isTriggering ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <MailWarning className="w-4 h-4 mr-2" />}
                                Wymuś sprawdzenie systemu
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="border-indigo-500/20 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Test Wysyłki</CardTitle>
                            <CardDescription>Sprawdź, czy dane SMTP są poprawne przed ustawieniem automatyzacji.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="flex space-x-2">
                                <Input
                                    placeholder="Adres testowy"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                />
                                <Button onClick={handleTestEmail} disabled={isTesting} className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white">
                                    {isTesting ? "Wysyłanie..." : <><Send className="w-4 h-4 mr-2" /> Wyślij</>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[#5865F2]/30 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[#5865F2]" /> Powiadomienia Discord
                            </CardTitle>
                            <CardDescription>
                                Zmiany w grafiku będą wysyłane na kanał Discord z oznaczeniem (@ping) pracownika.
                                Discord ID pracownika ustawisz w edycji użytkownika.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
                                <Input
                                    id="discordWebhookUrl"
                                    name="discordWebhookUrl"
                                    value={formData.discordWebhookUrl}
                                    onChange={handleChange}
                                    placeholder="https://discord.com/api/webhooks/..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Discord: Ustawienia kanału → Integracje → Webhooki → Nowy webhook → Kopiuj URL. Pozostaw puste, aby wyłączyć powiadomienia.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleSave} disabled={isLoading} variant="secondary">
                                    {isLoading ? "Zapisywanie..." : <><Save className="w-4 h-4 mr-2" /> Zapisz</>}
                                </Button>
                                <Button onClick={handleTestDiscord} disabled={isTestingDiscord} variant="outline" className="border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/10">
                                    {isTestingDiscord ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                    Wyślij test
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Historia Wysłanych Wiadomości</CardTitle>
                            <CardDescription>Ostatnie 50 wpisów wysyłki z systemu raportowania i alertów.</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={loadLogs}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Odśwież
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Odbiorca</TableHead>
                                    <TableHead>Temat</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Brak wpisów w historii.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {format(new Date(log.sentAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                                            </TableCell>
                                            <TableCell>{log.toEmail}</TableCell>
                                            <TableCell>{log.subject}</TableCell>
                                            <TableCell>
                                                {log.status === "SUCCESS" ? (
                                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50">Wysłano</Badge>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant="outline" className="w-fit bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50">Błąd</Badge>
                                                        <span className="text-xs text-red-500 max-w-[200px] truncate" title={log.errorMsg}>
                                                            {log.errorMsg}
                                                        </span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

