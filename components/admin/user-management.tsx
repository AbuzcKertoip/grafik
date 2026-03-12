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
import { UserPlus, UserX } from "lucide-react"
import { deleteEmployee } from "@/lib/actions/admin"
import { toast } from "sonner"

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
    const isSzef = currentUser?.role === 'SZEF'
    const canManageUsers = !isSzef

    // Normally we should refetch users on update, but for now router.refresh() in parent or here
    const handleUpdate = () => {
        router.refresh()
    }

    const handleDeleteEmployee = async (id: number) => {
        if (!window.confirm("UWAGA: Czy na pewno chcesz PEREKMANENTNIE USUNĄĆ tego pracownika? Operacja ta skasuje bezpowrotnie jego użer, nadane urlopy, karty czasu i dostępy!")) return

        const result = await deleteEmployee(id)
        if (result.success) {
            toast.success("Pracownik został w pełni poddany usunięciu.")
            handleUpdate() // Odświeża zawartość po skasowaniu
        } else {
            toast.error(result.error || "Wystąpił problem z wymazywaniem rekordu.")
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
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pracownik</TableHead>
                                <TableHead>Rola</TableHead>
                                <TableHead>Dział</TableHead>
                                <TableHead>Uprawnienia</TableHead>
                                {canManageUsers && <TableHead className="text-right">Akcje</TableHead>}
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
                                                onClick={() => handleDeleteEmployee(user.id)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <UserX className="h-4 w-4 mr-2" />
                                                Usuń
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
        </Card>
    )
}
