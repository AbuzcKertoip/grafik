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
import { createVacation, approveVacation, rejectVacation, cancelVacation } from "@/lib/actions/vacations"
import { groupVacations } from "@/lib/vacation-utils"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { CheckCircle, XCircle, Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface VacationCalendarProps {
    users: any[]
    vacations: any[]
    currentUser: any
}

export function VacationCalendar({ users, vacations, currentUser }: VacationCalendarProps) {
    const router = useRouter()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()
    const [selectedUser, setSelectedUser] = useState<string>(currentUser?.role === 'ADMIN' ? "" : currentUser?.id.toString())
    const [isOpen, setIsOpen] = useState(false)
    const [type, setType] = useState("VACATION")
    const [loading, setLoading] = useState(false)
 
    const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER'
 
    const handleAdd = async () => {
        if (!dateRange?.from || !dateRange?.to || !selectedUser || loading) return
 
        setLoading(true)
        try {
            const result = await createVacation({
                userId: selectedUser,
                startDate: dateRange.from,
                endDate: dateRange.to,
                type
            })
    
            if (result?.success) {
                setDateRange(undefined)
                if (canManage) setSelectedUser("")
                router.refresh()
                alert(canManage ? "Urlop dodany." : "Wniosek został wysłany do akceptacji.")
            } else {
                alert(result?.error || "Błąd dodawania wniosku")
            }
        } finally {
            setLoading(false)
        }
    }
 
    const handleApprove = async (id: number | number[]) => {
        if (loading) return
        setLoading(true)
        try {
            const ids = Array.isArray(id) ? id : [id]
            for (const i of ids) {
                const result = await approveVacation(i)
                if (!result?.success) {
                    alert(`Błąd zatwierdzania (ID: ${i})`)
                    break
                }
            }
            router.refresh()
        } finally {
            setLoading(false)
        }
    }
 
    const handleReject = async (id: number | number[]) => {
        if (loading) return
        const reason = window.prompt("Podaj powód odrzucenia wniosku:")
        if (reason === null) return
        if (reason.trim() === "") {
            alert("Odrzucenie wymaga podania oficjalnego powodu.")
            return
        }
 
        setLoading(true)
        try {
            const ids = Array.isArray(id) ? id : [id]
            for (const i of ids) {
                const result = await rejectVacation(i, reason.trim())
                if (!((result as any)?.success)) {
                    alert(`Błąd odrzucania (ID: ${i})`)
                    break
                }
            }
            router.refresh()
        } finally {
            setLoading(false)
        }
    }
 
    const handleCancel = async (id: number | number[]) => {
        if (loading) return
        if (confirm("Czy na pewno chcesz anulować ten urlop? Dni zostaną zwrócone do puli.")) {
            setLoading(true)
            try {
                const ids = Array.isArray(id) ? id : [id]
                for (const i of ids) {
                    const result = await cancelVacation(i)
                    if (!result?.success) {
                        alert(result?.error || `Błąd anulowania (ID: ${i})`)
                        break
                    }
                }
                router.refresh()
            } finally {
                setLoading(false)
            }
        }
    }

    const visibleVacations = canManage
        ? vacations
        : vacations.filter(v => Number(v.userId) === Number(currentUser?.id))

    const groupedVisible = groupVacations(visibleVacations)

    const pendingVacations = groupedVisible.filter(v => v.status === "PENDING")
    const approvedVacations = groupedVisible.filter(v => v.status !== "PENDING")

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm relative">
                    {canManage ? "Centrum Urlopowe" : "Złóż Wniosek"}
                    {canManage && pendingVacations.length > 0 && (
                        <span className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-white">
                            {pendingVacations.length}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-2xl font-bold text-foreground">
                        {canManage ? "Centrum Zarządzania Urlopami" : "Twoje Wnioski Urlopowe"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                    {/* Left Sidebar: Form */}
                    <div className="md:col-span-4 space-y-6">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-lg text-foreground">Nowy wniosek</h3>
                            <p className="text-sm text-muted-foreground">
                                {canManage ? "Dodaj urlop lub zwolnienie." : "Wybierz termin urlopu."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {canManage && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">Pracownik</label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger className="bg-muted border-border">
                                            <SelectValue placeholder="Wybierz z listy..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.map(u => (
                                                <SelectItem key={u.id} value={u.id.toString()}>
                                                    {u.name || u.username}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Rodzaj</label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger className="bg-muted border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VACATION">🏖️ Urlop wypoczynkowy</SelectItem>
                                        <SelectItem value="ON_DEMAND">🔥 Urlop na żądanie</SelectItem>
                                        <SelectItem value="SPECIAL_LEAVE">🎉 Urlop okolicznościowy</SelectItem>
                                        <SelectItem value="CHILDCARE">👶 Opieka nad dzieckiem</SelectItem>
                                        <SelectItem value="ADDITIONAL">🎁 Dodatkowy urlop</SelectItem>
                                        <SelectItem value="OVERTIME">⏳ Odbiór nadgodzin</SelectItem>
                                        {canManage && (
                                            <SelectItem value="SICK">🤒 L4 / Chorobowe</SelectItem>
                                        )}
                                        <SelectItem value="OTHER">❓ Inne</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Termin</label>
                                <div className="border border-border rounded-lg p-3 bg-card shadow-sm flex justify-center">
                                    <Calendar
                                        mode="range"
                                        selected={dateRange}
                                        onSelect={(range: any) => setDateRange(range)}
                                        className="w-full border-0 shadow-none"
                                    />
                                </div>
                            </div>

                            <Button
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={handleAdd}
                                disabled={!dateRange?.from || !dateRange?.to || !selectedUser || loading}
                            >
                                {loading ? "Przetwarzanie..." : (canManage ? "Zatwierdź Urlop" : "Wyślij Wniosek")}
                            </Button>
                        </div>
                    </div>

                    {/* Right Content: Lists */}
                    <div className="md:col-span-8 bg-muted/30 rounded-lg p-6 space-y-6 border border-border h-full flex flex-col">
                        <Tabs defaultValue={canManage && pendingVacations.length > 0 ? "pending" : "all"} className="w-full flex-1 flex flex-col">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pending" className="relative">
                                    Oczekujące
                                    {pendingVacations.length > 0 && (
                                        <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 rounded-full">{pendingVacations.length}</span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="all">Zatwierdzone / Historia</TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending" className="flex-1 mt-4 overflow-y-auto max-h-[45vh] custom-scrollbar pr-2">
                                {pendingVacations.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">Brak oczekujących wniosków.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingVacations.map(v => (
                                            <div key={v.id} className="bg-card p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-semibold text-foreground flex items-center gap-2">
                                                            {v.user?.name || v.user?.username || "Nieznany"}
                                                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <Clock className="w-3 h-3" /> Oczekuje
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground mt-1">
                                                            {format(new Date(v.startDate), "d MMM", { locale: pl })} - {format(new Date(v.endDate), "d MMM yyyy", { locale: pl })}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground/80 mt-1 font-medium">
                                                            <div className="text-sm font-medium">
                                                                {v.type === 'VACATION' && '🏖️ Urlop'}
                                                                {v.type === 'ON_DEMAND' && '🔥 Na żądanie'}
                                                                {v.type === 'SPECIAL_LEAVE' && '🎉 Okolicznościowy'}
                                                                {v.type === 'CHILDCARE' && '👶 Opieka nad dzieckiem'}
                                                                {v.type === 'ADDITIONAL' && '🎁 Dodatkowy urlop'}
                                                                {v.type === 'OVERTIME' && '⏳ Odbiór nadgodzin'}
                                                                {v.type === 'SICK' && '🤒 Chorobowe'}
                                                                {v.type === 'OTHER' && '❓ Inne'}
                                                            </div>
                                                            {v.note && (
                                                                <div className="text-[10px] italic text-muted-foreground mt-1 bg-amber-50 dark:bg-amber-900/10 p-1 rounded">
                                                                    Notatka: {v.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {(canManage || Number(currentUser.id) === Number(v.userId)) && (
                                                            <Button size="sm" variant="outline" className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-amber-200 dark:border-amber-900" onClick={() => handleCancel(v.mergedIds || v.id)} disabled={loading}>
                                                                {loading ? "..." : "Anuluj"}
                                                            </Button>
                                                        )}
                                                        {canManage && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-900" onClick={() => handleApprove(v.mergedIds || v.id)} disabled={loading}>
                                                                    <CheckCircle className="w-4 h-4 mr-1" /> {loading ? "..." : "Akceptuj"}
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900" onClick={() => handleReject(v.mergedIds || v.id)} disabled={loading}>
                                                                    <XCircle className="w-4 h-4 mr-1" /> {loading ? "..." : "Odrzuć"}
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="all" className="flex-1 mt-4 overflow-y-auto max-h-[45vh] custom-scrollbar pr-2">
                                <div className="space-y-3">
                                    {approvedVacations.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">Brak zatwierdzonych urlopów.</div>
                                    ) : approvedVacations.map(v => {
                                        let icon = '❓'
                                        let bgClass = 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400'
                                        if (v.type === 'VACATION') { icon = '🏖️'; bgClass = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' }
                                        if (v.type === 'SPECIAL_LEAVE') { icon = '🎉'; bgClass = 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' }
                                        if (v.type === 'CHILDCARE') { icon = '👶'; bgClass = 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' }
                                        if (v.type === 'ADDITIONAL') { icon = '🎁'; bgClass = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' }
                                        if (v.type === 'OVERTIME') { icon = '⏳'; bgClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' }
                                        if (v.type === 'SICK') { icon = '🤒'; bgClass = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' }

                                        return (
                                        <div key={v.id} className="group flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${bgClass}`}>
                                                    {icon}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        {v.user?.name || v.user?.username || "Nieznany"}
                                                        {v.status === "REJECTED" && (
                                                            <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                                                                Odrzucony
                                                            </span>
                                                        )}
                                                        {v.status === "CANCELLED" && (
                                                            <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">
                                                                Anulowany
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {format(new Date(v.startDate), "d MMM", { locale: pl })} → {format(new Date(v.endDate), "d MMM yyyy", { locale: pl })}
                                                    </div>
                                                    {v.note && (
                                                        <div className="text-[10px] italic text-muted-foreground mt-1">
                                                            {v.note}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {v.status === "APPROVED" && (
                                                    <Button size="sm" variant="outline" className="text-amber-600 hover:bg-amber-50 border-amber-200" onClick={() => handleCancel(v.mergedIds || v.id)} disabled={loading}>
                                                        {loading ? "..." : "Anuluj"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
