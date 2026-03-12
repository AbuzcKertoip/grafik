"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, Plus } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserFormDialog } from "./user-form-dialog"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { useState } from "react"
import { deleteUser } from "@/lib/actions/users"
import { useRouter } from "next/navigation"

export function UsersTable({ users, currentUser }: { users: any[], currentUser?: any }) {
    const router = useRouter()
    const [editingUser, setEditingUser] = useState<any>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isAddUserOpen, setIsAddUserOpen] = useState(false)
    const isSzef = currentUser?.role === 'SZEF'
    const canManageUsers = !isSzef // Admin or whoever else has access to this page

    const handleEdit = (user: any) => {
        setEditingUser(user)
        setIsEditDialogOpen(true)
    }

    const handleDelete = async (id: number) => {
        if (confirm("Czy na pewno chcesz usunąć tego pracownika?")) {
            await deleteUser(id)
            router.refresh()
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Pracownicy</h2>
                {canManageUsers && (
                    <Button onClick={() => setIsAddUserOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Dodaj pracownika
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-card text-card-foreground shadow-sm dark:border-slate-800">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Imię i Nazwisko</TableHead>
                            <TableHead>Login</TableHead>
                            <TableHead>Rola</TableHead>
                            <TableHead>Stawka (PLN)</TableHead>
                            {canManageUsers && <TableHead className="text-right">Akcje</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Brak pracowników. Dodaj pierwszego.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </TableCell>
                                    <TableCell>{user.hourlyRate.toFixed(2)}</TableCell>
                                    {canManageUsers && (
                                        <TableCell className="text-right flex justify-end gap-2">
                                            <ResetPasswordDialog userId={user.id} username={user.name || user.username} />
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Otwórz menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Edytuj
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-red-900 focus:text-red-900 focus:bg-red-50 dark:text-red-400 dark:focus:text-red-400 dark:focus:bg-red-900/20">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Usuń
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <UserFormDialog
                open={isAddUserOpen}
                onOpenChange={setIsAddUserOpen}
            />

            {editingUser && (
                <UserFormDialog
                    user={editingUser}
                    open={isEditDialogOpen}
                    onOpenChange={(open) => {
                        setIsEditDialogOpen(open)
                        if (!open) setEditingUser(null)
                    }}
                />
            )}
        </div>
    )
}
