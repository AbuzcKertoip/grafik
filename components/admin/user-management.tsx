"use client"

import { useState } from "react"
import { Search, UserCog, Building2, ShieldAlert } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserEditDialog } from "./user-edit-dialog"
import { UserCreateDialog } from "./user-create-dialog"
import { useRouter } from "next/navigation"
import { UserPlus, UserX, AlertTriangle, Car } from "lucide-react"
import { terminateEmployee } from "@/lib/actions/admin"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface UserManagementProps {
    users: any[]
    departments: any[]
    permissions: any[]
    currentUser: any
}

export function UserManagement({ users: initialUsers, departments, permissions, currentUser }: UserManagementProps) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [userToTerminate, setUserToTerminate] = useState<any>(null)
    const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().split("T")[0])
    const [isTerminating, setIsTerminating] = useState(false)
    const isSzef = currentUser?.role === 'SZEF'
    const canManageUsers = !isSzef

    // Normally we should refetch users on update, but for now router.refresh() in parent or here
    const handleUpdate = () => {
        router.refresh()
    }

    const handleConfirmTerminate = async () => {
        if (!userToTerminate) return
        if (!terminationDate) {
            toast.error("Wybierz poprawną datę zakończenia pracy.")
            return
        }

        setIsTerminating(true)
        try {
            const result = await terminateEmployee(userToTerminate.id, new Date(terminationDate))
            if (result.success) {
                toast.success(`Pracownik ${userToTerminate.name || userToTerminate.username} został przeniesiony do archiwum.`)
                setUserToTerminate(null)
                handleUpdate()
            } else {
                toast.error(result.error || "Wystąpił problem ze zwolnieniem pracownika.")
            }
        } catch (error) {
            toast.error("Wystąpił nieoczekiwany błąd.")
        } finally {
            setIsTerminating(false)
        }
    }

    const filteredUsers = initialUsers.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Card>
            <CardHeader>
                <CardTitle>Użytkownicy</CardTitle>
                <CardDescription>Zarządzaj rolami i przypisaniem do działów.</CardDescription>
                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative w-full sm:w-[350px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Szukaj pracownika..."
                            className="pl-8 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {canManageUsers && (
                        <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <UserPlus className="w-4 h-4 mr-2" /> Dodaj pracownika
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="whitespace-nowrap">Pracownik</TableHead>
                                <TableHead className="whitespace-nowrap">Rola</TableHead>
                                <TableHead className="whitespace-nowrap">Dział</TableHead>
                                <TableHead className="whitespace-nowrap">Uprawnienia</TableHead>
                                {canManageUsers && <TableHead className="text-right whitespace-nowrap">Akcje</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.name}</span>
                                            <span className="text-xs text-muted-foreground">{user.username}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.department ? (
                                            <div className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                                <span>{user.department.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.permissions?.length > 0 ? (
                                            <Badge variant="outline" className="gap-1">
                                                <ShieldAlert className="h-3 w-3" />
                                                {user.permissions.length}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    {canManageUsers && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedUser(user)
                                                    setIsDialogOpen(true)
                                                }}
                                            >
                                                <UserCog className="h-4 w-4 mr-2" />
                                                Edytuj
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setUserToTerminate(user)
                                                    setTerminationDate(new Date().toISOString().split("T")[0])
                                                }}
                                                className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950/30"
                                                title="Zwolnij pracownika (przenieś do archiwum)"
                                            >
                                                <UserX className="h-4 w-4 mr-2" />
                                                Zwolnij
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                            {filteredUsers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                        Nie znaleziono użytkowników.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {selectedUser && (
                <UserEditDialog
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    user={selectedUser}
                    departments={departments}
                    allPermissions={permissions}
                    onUpdate={handleUpdate}
                />
            )}

            <UserCreateDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                departments={departments}
                onUpdate={handleUpdate}
            />

            <Dialog open={!!userToTerminate} onOpenChange={(open) => { if (!open) setUserToTerminate(null) }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-1">
                            <AlertTriangle className="h-5 w-5" />
                            <DialogTitle>Zwolnij pracownika</DialogTitle>
                        </div>
                        <DialogDescription>
                            Przenosisz pracownika <strong className="text-foreground">{userToTerminate?.name || userToTerminate?.username}</strong> do archiwum zwolnionych.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <p className="font-semibold">Co to oznacza:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-amber-400/80">
                                <li>Pracownik straci możliwość logowania do aplikacji.</li>
                                <li>Zostanie usunięty z aktywnych grafików, list HR i raportów bieżących.</li>
                                <li>Wszelkie przypisane pojazdy służbowe zostaną odpięte.</li>
                                <li>Wszystkie dotychczasowe dane (wnioski, historia, badania, sprzęt) <strong>zostaną zachowane</strong> w Archiwum.</li>
                            </ul>
                        </div>

                        {userToTerminate?.cars && userToTerminate.cars.length > 0 && (
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                                <p className="font-semibold flex items-center gap-1.5">
                                    <Car className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    Przypisane pojazdy służbowe ({userToTerminate.cars.length}):
                                </p>
                                <ul className="list-disc list-inside font-medium">
                                    {userToTerminate.cars.map((c: any) => (
                                        <li key={c.id}>
                                            {c.make} {c.model} (<span className="font-mono">{c.plate}</span>)
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-muted-foreground dark:text-blue-300/70 text-[11px] pt-0.5">
                                    Pojazdy zostaną automatycznie zwolnione i pozostaną we flocie bez opiekuna do ponownego przypisania.
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="termination-date" className="text-sm font-medium">
                                Data zakończenia pracy
                            </Label>
                            <Input
                                id="termination-date"
                                type="date"
                                value={terminationDate}
                                onChange={(e) => setTerminationDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setUserToTerminate(null)}
                            disabled={isTerminating}
                        >
                            Anuluj
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmTerminate}
                            disabled={isTerminating}
                        >
                            {isTerminating ? "Przetwarzanie..." : "Potwierdź zwolnienie"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
