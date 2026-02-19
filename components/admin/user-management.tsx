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
import { useRouter } from "next/navigation"

interface UserManagementProps {
    users: any[]
    departments: any[]
    permissions: any[]
}

export function UserManagement({ users: initialUsers, departments, permissions }: UserManagementProps) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Normally we should refetch users on update, but for now router.refresh() in parent or here
    const handleUpdate = () => {
        router.refresh()
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
                <div className="pt-4">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Szukaj pracownika..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
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
                                <TableHead className="text-right">Akcje</TableHead>
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
                                    </TableCell>
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
        </Card>
    )
}
