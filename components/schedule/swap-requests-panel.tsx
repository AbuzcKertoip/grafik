"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { createSwapRequest, acceptColleagueSwap, approveManagerSwap, rejectSwap } from "@/lib/actions/shift-swaps"
import { useRouter } from "next/navigation"
import { formatName } from "@/lib/utils"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { CheckCircle, XCircle, ArrowLeftRight, Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"

interface SwapRequestsPanelProps {
    users: any[]
    currentUser: any
    userRequests: any[]
    managerRequests: any[]
}

export function SwapRequestsPanel({ users, currentUser, userRequests, managerRequests }: SwapRequestsPanelProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Formularz nowego wniosku
    const [step, setStep] = useState(1)
    const [selectedUser, setSelectedUser] = useState<string>("")
    const [reqDate, setReqDate] = useState<Date | undefined>()
    const [targetDate, setTargetDate] = useState<Date | undefined>()
    const [isWeekend, setIsWeekend] = useState(false)

    const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SZEF' || currentUser?.role === 'MANAGER'
    const pendingColleagueCount = userRequests.filter(r => r.targetUserId === parseInt(currentUser.id) && r.status === 'PENDING_COLLEAGUE').length
    const pendingManagerCount = canManage ? managerRequests.length : 0
    const totalPending = pendingColleagueCount + pendingManagerCount

    const sortedUsers = [...users].filter(u => u.id !== parseInt(currentUser.id)).sort((a, b) => {
        return formatName(a.name || a.username).localeCompare(formatName(b.name || b.username));
    });

    const handleCreate = async () => {
        if (!reqDate || !targetDate || !selectedUser || loading) return

        setLoading(true)
        try {
            const result = await createSwapRequest(
                parseInt(selectedUser),
                reqDate,
                targetDate,
                isWeekend
            )
            if (result.success) {
                setReqDate(undefined)
                setTargetDate(undefined)
                setSelectedUser("")
                setIsWeekend(false)
                setStep(1)
                router.refresh()
                alert("Wniosek został wysłany.")
            } else {
                alert(result.error || "Wystąpił błąd.")
            }
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (action: 'acceptColleague' | 'approveManager' | 'reject', id: number) => {
        if (loading) return
        setLoading(true)
        try {
            let result
            if (action === 'acceptColleague') {
                result = await acceptColleagueSwap(id)
            } else if (action === 'approveManager') {
                result = await approveManagerSwap(id)
            } else if (action === 'reject') {
                const reason = window.prompt("Podaj powód odrzucenia (opcjonalnie):")
                if (reason === null) {
                    setLoading(false)
                    return
                }
                result = await rejectSwap(id, reason)
            }

            if (result?.success) {
                router.refresh()
            } else {
                alert(result?.error || "Błąd wykonania operacji.")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(val) => {
            setIsOpen(val)
            if (!val) setStep(1)
        }}>
            <DialogTrigger asChild>
                <Button variant="default" className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm relative">
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Wnioski o zamianę
                    {totalPending > 0 && (
                        <span className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-white">
                            {totalPending}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ArrowLeftRight className="w-6 h-6 text-sky-600" />
                        Zamiana Zmian / Dyżurów
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                    {/* Lewa kolumna - Formularz (Multi-step) */}
                    <div className="md:col-span-4 space-y-6">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg text-foreground">Nowy wniosek</h3>
                                <span className="text-xs font-medium bg-muted px-2 py-1 rounded-md text-muted-foreground">Krok {step} z 3</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {step === 1 && "Wybierz osobę do zamiany."}
                                {step === 2 && "Wybierz datę, którą oddajesz."}
                                {step === 3 && "Wybierz datę, którą bierzesz w zamian."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Z kim chcesz się zamienić?</label>
                                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                                            <SelectTrigger className="bg-muted border-border">
                                                <SelectValue placeholder="Wybierz z listy..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sortedUsers.map(u => (
                                                    <SelectItem key={u.id} value={u.id.toString()}>
                                                        {formatName(u.name || u.username)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center space-x-2 pt-2">
                                        <Checkbox 
                                            id="isWeekend" 
                                            checked={isWeekend} 
                                            onCheckedChange={(c) => setIsWeekend(c as boolean)} 
                                        />
                                        <label htmlFor="isWeekend" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Zamiana całego weekendu (Sob+Ndz)
                                        </label>
                                    </div>

                                    <Button
                                        className="w-full mt-4"
                                        onClick={() => setStep(2)}
                                        disabled={!selectedUser}
                                    >
                                        Dalej
                                    </Button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="border border-border rounded-lg p-3 bg-card shadow-sm flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={reqDate}
                                            onSelect={(d) => {
                                                setReqDate(d as Date);
                                                if (d) setTimeout(() => setStep(3), 300); // Auto-advance
                                            }}
                                            className="w-full border-0 shadow-none"
                                            disabled={(date) => isWeekend && date.getDay() !== 6}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="w-1/3" onClick={() => setStep(1)}>Wstecz</Button>
                                        <Button className="w-2/3" onClick={() => setStep(3)} disabled={!reqDate}>Dalej</Button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="border border-border rounded-lg p-3 bg-card shadow-sm flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={targetDate}
                                            onSelect={setTargetDate}
                                            className="w-full border-0 shadow-none"
                                            disabled={(date) => isWeekend && date.getDay() !== 6}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 pt-2">
                                        {reqDate && targetDate && (
                                            <div className="bg-sky-50 dark:bg-sky-900/20 p-3 rounded-md text-sm border border-sky-100 dark:border-sky-800">
                                                <div className="font-semibold text-sky-700 dark:text-sky-300 mb-1">Podsumowanie:</div>
                                                <div>Oddajesz: <strong>{format(reqDate, 'd MMM yyyy', { locale: pl })}</strong></div>
                                                <div>Bierzesz: <strong>{format(targetDate, 'd MMM yyyy', { locale: pl })}</strong></div>
                                                <div className="text-[10px] text-muted-foreground mt-1">{isWeekend ? "(+ Niedziele)" : ""}</div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="outline" className="w-1/3" onClick={() => setStep(2)}>Wstecz</Button>
                                            <Button
                                                className="w-2/3 bg-sky-600 hover:bg-sky-700 text-white"
                                                onClick={handleCreate}
                                                disabled={!reqDate || !targetDate || !selectedUser || loading}
                                            >
                                                {loading ? "Wysyłanie..." : "Wyślij Wniosek"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prawa kolumna - Listy */}
                    <div className="md:col-span-8 bg-muted/30 rounded-lg p-6 border border-border h-full flex flex-col">
                        <Tabs defaultValue="mine" className="w-full flex-1 flex flex-col">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="mine" className="relative">
                                    Moje Wnioski
                                    {pendingColleagueCount > 0 && (
                                        <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingColleagueCount}</span>
                                    )}
                                </TabsTrigger>
                                {canManage && (
                                    <TabsTrigger value="manager" className="relative">
                                        Do Akceptacji
                                        {pendingManagerCount > 0 && (
                                            <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{pendingManagerCount}</span>
                                        )}
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            {/* Moje Wnioski */}
                            <TabsContent value="mine" className="flex-1 mt-4 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">
                                {userRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">Brak wniosków o zamianę.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {userRequests.map(r => {
                                            const isTarget = r.targetUserId === parseInt(currentUser.id)
                                            const needsMyAction = isTarget && r.status === 'PENDING_COLLEAGUE'

                                            let statusColor = "bg-gray-100 text-gray-700"
                                            let statusText = r.status
                                            if (r.status === 'PENDING_COLLEAGUE') { statusColor = "bg-amber-100 text-amber-700"; statusText = "Czeka na kolegę" }
                                            if (r.status === 'PENDING_MANAGER') { statusColor = "bg-blue-100 text-blue-700"; statusText = "Czeka na managera" }
                                            if (r.status === 'APPROVED') { statusColor = "bg-green-100 text-green-700"; statusText = "Zaakceptowany" }
                                            if (r.status === 'REJECTED') { statusColor = "bg-red-100 text-red-700"; statusText = "Odrzucony" }

                                            if (isTarget && r.status === 'PENDING_COLLEAGUE') statusText = "Czeka na Twoją akceptację"

                                            return (
                                                <div key={r.id} className={`bg-card p-4 rounded-xl border shadow-sm ${needsMyAction ? 'border-sky-300 ring-1 ring-sky-200' : 'border-border'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-semibold text-foreground flex items-center gap-2">
                                                                {r.isWeekend ? "Zamiana weekendu" : "Zamiana dnia"}
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor}`}>
                                                                    {statusText}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm mt-2 text-muted-foreground flex gap-4">
                                                                <div>
                                                                    <div className="text-[10px] uppercase font-bold text-gray-400">Ty dajesz</div>
                                                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                                                        {isTarget ? format(new Date(r.targetUserDate), "d MMM yyyy", { locale: pl }) : format(new Date(r.requesterDate), "d MMM yyyy", { locale: pl })}
                                                                    </div>
                                                                </div>
                                                                <ArrowLeftRight className="w-4 h-4 text-gray-300 mt-3" />
                                                                <div>
                                                                    <div className="text-[10px] uppercase font-bold text-gray-400">{isTarget ? r.requester.name || r.requester.username : r.targetUser.name || r.targetUser.username} daje</div>
                                                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                                                        {isTarget ? format(new Date(r.requesterDate), "d MMM yyyy", { locale: pl }) : format(new Date(r.targetUserDate), "d MMM yyyy", { locale: pl })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {r.note && (
                                                                <div className="text-xs text-red-500 mt-2 font-medium">Notatka: {r.note}</div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {needsMyAction && (
                                                                <>
                                                                    <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleAction('acceptColleague', r.id)} disabled={loading}>
                                                                        <CheckCircle className="w-4 h-4 mr-1" /> Zgadzam się
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleAction('reject', r.id)} disabled={loading}>
                                                                        <XCircle className="w-4 h-4 mr-1" /> Odrzuć
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Wnioski Managera */}
                            {canManage && (
                                <TabsContent value="manager" className="flex-1 mt-4 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2">
                                    {managerRequests.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">Brak wniosków oczekujących na zatwierdzenie.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {managerRequests.map(r => (
                                                <div key={r.id} className="bg-card p-4 rounded-xl border border-amber-200 shadow-sm">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-semibold text-foreground flex items-center gap-2">
                                                                {r.isWeekend ? "Zamiana weekendu" : "Zamiana dnia"}
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> Czeka na Ciebie
                                                                </span>
                                                            </div>
                                                            <div className="text-sm mt-2 text-muted-foreground flex gap-4">
                                                                <div>
                                                                    <div className="text-[10px] uppercase font-bold text-gray-400">{r.requester.name || r.requester.username} oddaje</div>
                                                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                                                        {format(new Date(r.requesterDate), "d MMM yyyy", { locale: pl })}
                                                                    </div>
                                                                </div>
                                                                <ArrowLeftRight className="w-4 h-4 text-gray-300 mt-3" />
                                                                <div>
                                                                    <div className="text-[10px] uppercase font-bold text-gray-400">{r.targetUser.name || r.targetUser.username} oddaje</div>
                                                                    <div className="font-medium text-gray-700 dark:text-gray-300">
                                                                        {format(new Date(r.targetUserDate), "d MMM yyyy", { locale: pl })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50 border-green-200" onClick={() => handleAction('approveManager', r.id)} disabled={loading}>
                                                                <CheckCircle className="w-4 h-4 mr-1" /> Akceptuj
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleAction('reject', r.id)} disabled={loading}>
                                                                <XCircle className="w-4 h-4 mr-1" /> Odrzuć
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                            )}
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
