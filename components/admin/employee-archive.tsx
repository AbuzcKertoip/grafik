"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
    Search,
    Archive,
    RotateCcw,
    ExternalLink,
    Building2,
    Calendar,
    Stethoscope,
    Wrench,
    FileText,
    Shield,
    UserX,
    CheckCircle2,
    AlertCircle
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { reinstateEmployee } from "@/lib/actions/admin"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"

interface ArchivedEmployee {
    id: number
    name: string | null
    username: string
    email: string | null
    role: string
    image: string | null
    createdAt: Date | string
    employmentEndDate: Date | string | null
    department: {
        id: number
        name: string
    } | null
    vacations?: any[]
    equipment?: any[]
    tools?: any[]
    medicalExams?: any[]
}

interface EmployeeArchiveProps {
    users: ArchivedEmployee[]
}

export function EmployeeArchive({ users: initialUsers }: EmployeeArchiveProps) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [userToReinstate, setUserToReinstate] = useState<ArchivedEmployee | null>(null)
    const [isReinstating, setIsReinstating] = useState(false)

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return initialUsers

        return initialUsers.filter((u) => {
            const nameMatch = u.name?.toLowerCase().includes(query) ?? false
            const usernameMatch = u.username.toLowerCase().includes(query)
            const emailMatch = u.email?.toLowerCase().includes(query) ?? false
            const deptMatch = u.department?.name.toLowerCase().includes(query) ?? false
            return nameMatch || usernameMatch || emailMatch || deptMatch
        })
    }, [initialUsers, search])

    const handleReinstate = async () => {
        if (!userToReinstate) return
        setIsReinstating(true)

        try {
            const res = await reinstateEmployee(userToReinstate.id)
            if (res.success) {
                toast.success(`Pracownik ${userToReinstate.name || userToReinstate.username} został przywrócony do aktywnej kadry.`)
                setUserToReinstate(null)
                router.refresh()
            } else {
                toast.error(res.error || "Wystąpił błąd podczas przywracania pracownika.")
            }
        } catch (error) {
            toast.error("Wystąpił nieoczekiwany błąd.")
        } finally {
            setIsReinstating(false)
        }
    }

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return "-"
        try {
            return format(new Date(date), "dd MMMM yyyy", { locale: pl })
        } catch {
            return "-"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50/40 via-background to-background dark:border-amber-900/30 dark:from-amber-950/10">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    <Archive className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-xl font-bold">Archiwum Zwolnionych Pracowników</CardTitle>
                            </div>
                            <CardDescription>
                                Ewidencja byłych pracowników. Ich historia zatrudnienia, badania, wnioski oraz sprzęt pozostają zarchiwizowane w bazie danych.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="px-3 py-1.5 text-sm gap-1.5 font-medium border-amber-300 dark:border-amber-800">
                                <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                <span>W archiwum: <strong>{initialUsers.length}</strong></span>
                            </Badge>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-between">
                        <div className="relative w-full sm:w-[350px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Szukaj po nazwisku, loginie, dziale..."
                                className="pl-9 w-full bg-background"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="rounded-md border overflow-x-auto bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Pracownik</TableHead>
                                    <TableHead className="whitespace-nowrap">Dział</TableHead>
                                    <TableHead className="whitespace-nowrap">Rola</TableHead>
                                    <TableHead className="whitespace-nowrap">Zakończenie pracy</TableHead>
                                    <TableHead className="whitespace-nowrap">Zarchiwizowane dane</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Akcje</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => {
                                    const medicalCount = user.medicalExams?.length || 0
                                    const vacationCount = user.vacations?.length || 0
                                    const equipmentCount = (user.equipment?.length || 0) + (user.tools?.length || 0)

                                    return (
                                        <TableRow key={user.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border">
                                                        <AvatarImage src={user.image || ""} />
                                                        <AvatarFallback className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold text-xs">
                                                            {formatName(user.name || user.username).substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">{user.name || user.username}</span>
                                                        <span className="text-xs text-muted-foreground">{user.username} {user.email ? `• ${user.email}` : ""}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.department ? (
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span>{user.department.name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-normal text-xs">
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{formatDate(user.employmentEndDate)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    {medicalCount > 0 && (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50" title={`${medicalCount} badań medycznych`}>
                                                            <Stethoscope className="h-3 w-3" />
                                                            {medicalCount} {medicalCount === 1 ? 'badanie' : 'badań'}
                                                        </span>
                                                    )}
                                                    {vacationCount > 0 && (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50" title={`${vacationCount} wniosków urlopowych`}>
                                                            <FileText className="h-3 w-3" />
                                                            {vacationCount} {vacationCount === 1 ? 'urlop' : 'urlopów'}
                                                        </span>
                                                    )}
                                                    {equipmentCount > 0 && (
                                                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-900/50" title={`${equipmentCount} pozycji mienia/narzędzi`}>
                                                            <Wrench className="h-3 w-3" />
                                                            {equipmentCount} sprzętu
                                                        </span>
                                                    )}
                                                    {medicalCount === 0 && vacationCount === 0 && equipmentCount === 0 && (
                                                        <span className="text-muted-foreground text-xs italic">Podstawowe konto</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        title="Zobacz profil pracownika"
                                                    >
                                                        <Link href={`/dashboard/profile?userId=${user.id}`}>
                                                            <ExternalLink className="h-4 w-4 mr-1.5" />
                                                            Profil
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setUserToReinstate(user)}
                                                        className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                                        title="Przywróć pracownika do aktywnej kadry"
                                                    >
                                                        <RotateCcw className="h-4 w-4 mr-1.5" />
                                                        Przywróć
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}

                                {filteredUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Archive className="h-8 w-8 text-muted-foreground/40" />
                                                <p className="font-medium text-sm">
                                                    {search ? "Nie znaleziono pracowników w archiwum spełniających kryteria." : "Brak zwolnionych pracowników w archiwum."}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Reinstate Confirmation Dialog */}
            <Dialog open={!!userToReinstate} onOpenChange={(open) => { if (!open) setUserToReinstate(null) }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                            <RotateCcw className="h-5 w-5" />
                            <DialogTitle>Przywróć pracownika do kadry</DialogTitle>
                        </div>
                        <DialogDescription>
                            Czy na pewno chcesz przywrócić pracownika <strong className="text-foreground">{userToReinstate?.name || userToReinstate?.username}</strong>?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                            <p className="font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Skutki przywrócenia:
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-emerald-400/80">
                                <li>Pracownik ponownie zyska możliwość logowania do systemu.</li>
                                <li>Pojawi się na listach aktywnych pracowników, w grafikach oraz panelu HR.</li>
                                <li>Data zwolnienia ({formatDate(userToReinstate?.employmentEndDate)}) zostanie wyzerowana.</li>
                            </ul>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setUserToReinstate(null)}
                            disabled={isReinstating}
                        >
                            Anuluj
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleReinstate}
                            disabled={isReinstating}
                        >
                            {isReinstating ? "Przywracanie..." : "Potwierdź przywrócenie"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
