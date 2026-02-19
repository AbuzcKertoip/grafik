"use client"

import { useState } from "react"
import { Plus, Trash2, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { createDepartment, deleteDepartment, updateDepartment } from "@/lib/actions/admin"

interface Department {
    id: number
    name: string
    description: string | null
    createdAt: Date
    updatedAt: Date
    _count?: {
        users: number
    }
}

export function DepartmentList({ departments }: { departments: Department[] }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newDeptName, setNewDeptName] = useState("")
    const [newDeptDesc, setNewDeptDesc] = useState("")

    const handleCreate = async () => {
        if (!newDeptName) return
        const res = await createDepartment({ name: newDeptName, description: newDeptDesc })
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Dział utworzony")
            setIsDialogOpen(false)
            setNewDeptName("")
            setNewDeptDesc("")
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć ten dział?")) return
        const res = await deleteDepartment(id)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Dział usunięty")
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1.5">
                    <CardTitle>Działy</CardTitle>
                    <CardDescription>Zarządzaj strukturą organizacyjną firmy.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Dodaj dział
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Dodaj nowy dział</DialogTitle>
                            <DialogDescription>
                                Wprowadź nazwę i opis nowego działu.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="name">Nazwa</label>
                                <Input
                                    id="name"
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                    placeholder="np. IT, Sprzedaż"
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="desc">Opis</label>
                                <Input
                                    id="desc"
                                    value={newDeptDesc}
                                    onChange={(e) => setNewDeptDesc(e.target.value)}
                                    placeholder="Opcjonalny opis"
                                />
                            </div>
                            <Button onClick={handleCreate}>Utwórz</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nazwa</TableHead>
                            <TableHead>Opis</TableHead>
                            <TableHead>Liczba pracowników</TableHead>
                            <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {departments.map((dept) => (
                            <TableRow key={dept.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                    <Building className="h-4 w-4 text-muted-foreground" />
                                    {dept.name}
                                </TableCell>
                                <TableCell>{dept.description || "-"}</TableCell>
                                <TableCell>{dept._count?.users || 0}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(dept.id)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {departments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    Brak działów.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
