"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { updateUserRoleAndDepartment, toggleUserPermission } from "@/lib/actions/admin"
import { ROLES } from "@/lib/auth/permissions"

interface UserEditDialogProps {
    user: any
    open: boolean
    onOpenChange: (open: boolean) => void
    departments: any[]
    allPermissions: any[]
    onUpdate: () => void
}

export function UserEditDialog({ user, open, onOpenChange, departments, allPermissions, onUpdate }: UserEditDialogProps) {
    const [role, setRole] = useState(user?.role || ROLES.USER)
    const [departmentId, setDepartmentId] = useState<string>(user?.departmentId?.toString() || "null")
    const [skipDuties, setSkipDuties] = useState<boolean>(user?.skipDuties || false)
    const [fixedShift, setFixedShift] = useState<string>(user?.fixedShift || "NONE")
    const [isLoading, setIsLoading] = useState(false)

    // Derived state for permissions would be complex if we want to manage them here fully reactive,
    // but for now, let's just handle role/dept save, and permissions as individual toggles or separate tab?
    // Let's keep it simple: Main tab Role/Dept, Second section Permissions.

    useEffect(() => {
        if (user) {
            setRole(user.role || ROLES.USER)
            setDepartmentId(user.departmentId?.toString() || "null")
            setSkipDuties(user.skipDuties || false)
            setFixedShift(user.fixedShift || "NONE")
        }
    }, [user])

    const handleSave = async () => {
        setIsLoading(true)
        const res = await updateUserRoleAndDepartment(user.id, {
            role,
            departmentId: departmentId === "null" ? null : parseInt(departmentId),
            skipDuties,
            fixedShift: fixedShift === "NONE" ? null : fixedShift
        })
        setIsLoading(false)

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Zaktualizowano użytkownika")
            onUpdate()
            onOpenChange(false)
        }
    }

    const handlePermissionToggle = async (permissionId: number, checked: boolean) => {
        // Optimistic update or just wait?
        // Let's wait to be safe
        const res = await toggleUserPermission(user.id, permissionId, checked)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(checked ? "Nadano uprawnienie" : "Odebrano uprawnienie")
            onUpdate() // Refresh parent to get new permissions list
        }
    }

    const userPermissions = new Set(user?.permissions?.map((p: any) => p.permissionId))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edytuj użytkownika</DialogTitle>
                    <DialogDescription>
                        Zmień rolę, dział oraz szczegółowe uprawnienia dla {user?.name || user?.username}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Rola</Label>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.values(ROLES).map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Dział</Label>
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz dział" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">Brak</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Opcje Grafiku</Label>
                        <div className="grid grid-cols-1 gap-4 border rounded-md p-4 bg-muted/20">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="skipDuties"
                                    checked={skipDuties}
                                    onCheckedChange={(val) => setSkipDuties(val as boolean)}
                                />
                                <Label htmlFor="skipDuties" className="font-normal cursor-pointer">
                                    Zwolniony z obowiązków dyżurowych (weekendy, święta)
                                </Label>
                            </div>

                            <div className="grid gap-2">
                                <Label className="font-normal">Przypisz stałą zmianę (opcjonalnie)</Label>
                                <Select value={fixedShift} onValueChange={setFixedShift}>
                                    <SelectTrigger className="w-full sm:w-[250px] bg-background">
                                        <SelectValue placeholder="Brak" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">Brak przypisania</SelectItem>
                                        <SelectItem value="SHIFT_1">Zmiana 1</SelectItem>
                                        <SelectItem value="SHIFT_2">Zmiana 2</SelectItem>
                                        <SelectItem value="SHIFT_3">Zmiana 3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Dodatkowe Uprawnienia</Label>
                        <div className="grid grid-cols-1 gap-2 border rounded-md p-4">
                            {allPermissions.map((perm) => {
                                const isChecked = userPermissions.has(perm.id)
                                return (
                                    <div key={perm.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`perm-${perm.id}`}
                                            checked={isChecked}
                                            onCheckedChange={(checked) => handlePermissionToggle(perm.id, checked as boolean)}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <label
                                                htmlFor={`perm-${perm.id}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {perm.name}
                                            </label>
                                            <p className="text-sm text-muted-foreground">
                                                {perm.description || perm.slug}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                            {allPermissions.length === 0 && (
                                <p className="text-sm text-muted-foreground">Brak zdefiniowanych uprawnień specjalnych.</p>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
                    <Button onClick={handleSave} disabled={isLoading}>Zapisz zmiany</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
