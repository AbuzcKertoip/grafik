"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createPermission } from "@/lib/actions/admin"

export function PermissionsManager({ permissions }: { permissions: any[] }) {
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        slug: "",
        name: "",
        description: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        const res = await createPermission(formData)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Uprawnienie dodane.")
            setIsCreateOpen(false)
            setFormData({ slug: "", name: "", description: "" })
        }
        setIsLoading(false)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Baza zdefiniowanych uprawnień</h3>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Dodaj uprawnienie
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>Nowe uprawnienie (slug)</DialogTitle>
                                <DialogDescription>
                                    Dodaj całkowicie nowe modularne uprawnienie do bazy. Wpisz unikalny identyfikator techniczny (slug).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="slug">Slug (np. export_raports_excel)</Label>
                                    <Input
                                        id="slug"
                                        value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                        required
                                        pattern="[a-z0-9_]+"
                                        title="Tylko małe litery, cyfry i podkreślenia"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nazwa wyświetlana</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Opis (opcjonalnie)</Label>
                                    <Input
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isLoading}>
                                    Zapisz bazowe uprawnienie
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-muted/50">
                            <TableHead>Slug</TableHead>
                            <TableHead>Nazwa</TableHead>
                            <TableHead>Opis</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {permissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                    Brak zdefiniowanych dodatkowych uprawnień w bazie.
                                </TableCell>
                            </TableRow>
                        ) : (
                            permissions.map((p) => (
                                <TableRow key={p.id} className="hover:bg-muted/50">
                                    <TableCell className="font-mono text-sm">{p.slug}</TableCell>
                                    <TableCell>{p.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{p.description || "-"}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
