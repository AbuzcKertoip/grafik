// ... imports will need to be updated to include approve/reject
// I will rewrite the whole component to be safe as logic changes significantly.

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { createVacation, deleteVacation, approveVacation, rejectVacation } from "@/lib/actions/vacations"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Trash2, CheckCircle, XCircle, Clock } from "lucide-react"
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
    const isAdmin = currentUser?.role === 'ADMIN'

    const handleAdd = async () => {
        if (!dateRange?.from || !dateRange?.to || !selectedUser) return

        const result = await createVacation({
            userId: selectedUser,
            startDate: dateRange.from,
            endDate: dateRange.to,
            type
        })

        if (result?.success) {
            setDateRange(undefined)
            if (isAdmin) setSelectedUser("")
            router.refresh()
            alert(isAdmin ? "Urlop dodany." : "Wniosek został wysłany do akceptacji.")
        } else {
            alert(result?.error || "Błąd dodawania wniosku")
        }
    }

    const handleDelete = async (id: number) => {
        if (confirm("Usunąć wniosek/urlop?")) {
            const result = await deleteVacation(id)
            if (result?.success) router.refresh()
            else alert("Błąd usuwania")
        }
    }

    const handleApprove = async (id: number) => {
        const result = await approveVacation(id)
        if (result?.success) router.refresh()
        else alert("Błąd zatwierdzania")
    }

    const handleReject = async (id: number) => {
        if (confirm("Odrzucić wniosek?")) {
            const result = await rejectVacation(id)
            if ((result as any)?.success) router.refresh()
            else alert("Błąd odrzucania")
        }
    }

    // Filter vacations based on role
    // Admin sees all? Or maybe we toggle between "All" and "Pending"?
    // User sees only their own.
    const visibleVacations = isAdmin
        ? vacations
        : vacations.filter(v => v.userId === currentUser?.id)

    const pendingVacations = visibleVacations.filter(v => !v.approved)
    const approvedVacations = visibleVacations.filter(v => v.approved)

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm relative">
                    {isAdmin ? "Centrum Urlopowe" : "Złóż Wniosek"}
                    {isAdmin && pendingVacations.length > 0 && (
                        <span className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-white">
                            {pendingVacations.length}
                        </span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <DialogTitle className="text-2xl font-bold text-gray-800">
                        {isAdmin ? "Centrum Zarządzania Urlopami" : "Twoje Wnioski Urlopowe"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left Sidebar: Form */}
                    <div className="md:col-span-4 space-y-6">
                        <div className="space-y-1">
                            <h3 className="font-semibold text-lg text-gray-800">Nowy wniosek</h3>
                            <p className="text-sm text-gray-500">
                                {isAdmin ? "Dodaj urlop lub zwolnienie." : "Wybierz termin urlopu."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {isAdmin && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Pracownik</label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger className="bg-gray-50 border-gray-200">
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
                                <label className="text-sm font-medium text-gray-700">Rodzaj</label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger className="bg-gray-50 border-gray-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="VACATION">🏖️ Urlop wypoczynkowy</SelectItem>
                                        <SelectItem value="SICK">🤒 L4 / Chorobowe</SelectItem>
                                        <SelectItem value="OTHER">❓ Inne</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Termin</label>
                                <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm flex justify-center">
                                    <Calendar
                                        mode="range"
                                        selected={dateRange}
                                        onSelect={(range: any) => setDateRange(range)}
                                        className="w-full border-0 shadow-none"
                                    />
                                </div>
                            </div>

                            <Button
                                className="w-full bg-gray-900 hover:bg-black text-white"
                                onClick={handleAdd}
                                disabled={!dateRange?.from || !dateRange?.to || !selectedUser}
                            >
                                {isAdmin ? "Zatwierdź Urlop" : "Wyślij Wniosek"}
                            </Button>
                        </div>
                    </div>

                    {/* Right Content: Lists */}
                    <div className="md:col-span-8 bg-gray-50/50 rounded-lg p-6 space-y-6 border h-full flex flex-col">
                        <Tabs defaultValue={isAdmin && pendingVacations.length > 0 ? "pending" : "all"} className="w-full flex-1 flex flex-col">
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
                                    <div className="text-center py-8 text-gray-500 text-sm">Brak oczekujących wniosków.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingVacations.map(v => (
                                            <div key={v.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                            {v.user.name || v.user.username}
                                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                <Clock className="w-3 h-3" /> Oczekuje
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            {format(new Date(v.startDate), "d MMM", { locale: pl })} - {format(new Date(v.endDate), "d MMM yyyy", { locale: pl })}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Typ: {v.type === 'VACATION' ? 'Urlop' : v.type}
                                                        </div>
                                                    </div>
                                                    {isAdmin ? (
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50 border-green-200" onClick={() => handleApprove(v.id)}>
                                                                <CheckCircle className="w-4 h-4 mr-1" /> Akceptuj
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleReject(v.id)}>
                                                                <XCircle className="w-4 h-4 mr-1" /> Odrzuć
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)} className="text-gray-400 hover:text-red-600">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="all" className="flex-1 mt-4 overflow-y-auto max-h-[45vh] custom-scrollbar pr-2">
                                <div className="space-y-3">
                                    {approvedVacations.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500 text-sm">Brak zatwierdzonych urlopów.</div>
                                    ) : approvedVacations.map(v => (
                                        <div key={v.id} className="group flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${v.type === 'VACATION' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {v.type === 'VACATION' ? '🏖️' : '🤒'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{v.user.name || v.user.username}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {format(new Date(v.startDate), "d MMM", { locale: pl })} → {format(new Date(v.endDate), "d MMM yyyy", { locale: pl })}
                                                    </div>
                                                </div>
                                            </div>
                                            {(isAdmin || !v.approved) && (
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
