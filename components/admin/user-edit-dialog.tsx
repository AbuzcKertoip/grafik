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
import { ROLES, INHERENT_PERMISSIONS } from "@/lib/auth/permissions"

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
    const [secondaryDepartmentId, setSecondaryDepartmentId] = useState<string>(user?.secondaryDepartmentId?.toString() || "null")
    const [skipDuties, setSkipDuties] = useState<boolean>(user?.skipDuties || false)
    const [fixedShift, setFixedShift] = useState<string>(user?.fixedShift || "NONE")
    const [contractType, setContractType] = useState<string>(user?.contractType || "UOP")
    const [has10YearsSeniority, setHas10YearsSeniority] = useState<boolean>(user?.has10YearsSeniority || false)
    const [hasChildren, setHasChildren] = useState<boolean>(user?.hasChildren || false)
    const [isLoading, setIsLoading] = useState(false)
    const [localPermissions, setLocalPermissions] = useState<Set<number>>(new Set())

    // Derived state for permissions would be complex if we want to manage them here fully reactive,
    // but for now, let's just handle role/dept save, and permissions as individual toggles or separate tab?
    // Let's keep it simple: Main tab Role/Dept, Second section Permissions.

    useEffect(() => {
        if (user) {
            setRole(user.role || ROLES.USER)
            setDepartmentId(user.departmentId?.toString() || "null")
            setSecondaryDepartmentId(user.secondaryDepartmentId?.toString() || "null")
            setSkipDuties(user.skipDuties || false)
            setFixedShift(user.fixedShift || "NONE")
            setContractType(user.contractType || "UOP")
            setHas10YearsSeniority(user.has10YearsSeniority || false)
            setHasChildren(user.hasChildren || false)
            setLocalPermissions(new Set(user.permissions?.map((p: any) => p.permissionId)))
        }
    }, [user])

    const handleSave = async () => {
        setIsLoading(true)
        const res = await updateUserRoleAndDepartment(user.id, {
            role,
            departmentId: departmentId === "null" ? null : parseInt(departmentId),
            secondaryDepartmentId: secondaryDepartmentId === "null" ? null : parseInt(secondaryDepartmentId),
            skipDuties,
            fixedShift: fixedShift === "NONE" ? null : fixedShift,
            contractType,
            has10YearsSeniority,
            hasChildren
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
        // Optimistic update 
        setLocalPermissions(prev => {
            const next = new Set(prev)
            if (checked) next.add(permissionId)
            else next.delete(permissionId)
            return next
        })

        const res = await toggleUserPermission(user.id, permissionId, checked)
        if (res.error) {
            toast.error(res.error)
            // Revert on error
            setLocalPermissions(prev => {
                const next = new Set(prev)
                if (checked) next.delete(permissionId)
                else next.add(permissionId)
                return next
            })
        } else {
            toast.success(checked ? "Nadano uprawnienie" : "Odebrano uprawnienie")
            onUpdate() // Refresh parent to get new permissions list
        }
    }

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
                        <div className="space-y-2">
                            <Label>Drugi dział (Zarządzanie)</Label>
                            <Select value={secondaryDepartmentId} onValueChange={setSecondaryDepartmentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz drugi dział" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="null">Brak</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Rodzaj umowy</Label>
                            <Select value={contractType} onValueChange={setContractType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UOP">Umowa o pracę (UOP)</SelectItem>
                                    <SelectItem value="UOP_PART_TIME">Niepełny etat (UOP)</SelectItem>
                                    <SelectItem value="B2B">Samozatrudnienie (B2B)</SelectItem>
                                    <SelectItem value="UMOWA_ZLECENIE">Umowa zlecenie</SelectItem>
                                    <SelectItem value="UMOWA_O_DZIELO">Umowa o dzieło</SelectItem>
                                    <SelectItem value="INNE">Inne</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {(contractType === 'UOP' || contractType === 'UOP_PART_TIME' || contractType === 'B2B') && (
                        <div className="space-y-4">
                            <Label>Staż pracy (Urlop)</Label>
                            <div className="flex items-center space-x-2 border rounded-md p-4 bg-muted/20">
                                <Checkbox
                                    id="has10YearsSeniority"
                                    checked={has10YearsSeniority}
                                    onCheckedChange={(val) => setHas10YearsSeniority(val as boolean)}
                                />
                                <Label htmlFor="has10YearsSeniority" className="font-normal cursor-pointer">
                                    Pracownik posiada staż pracy równy lub dłuższy niż 10 lat (przysługuje 26 dni urlopu)
                                </Label>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                         <Label>Opieka nad dzieckiem</Label>
                         <div className="flex items-center space-x-2 border rounded-md p-4 bg-muted/20">
                             <Checkbox
                                 id="editHasChildren"
                                 checked={hasChildren}
                                 onCheckedChange={(val) => setHasChildren(val as boolean)}
                             />
                             <Label htmlFor="editHasChildren" className="font-normal cursor-pointer">
                                 Pracownik posiada dzieci (przysługują 2 dni zwolnienia na opiekę)
                             </Label>
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
                                const inherentForRole = INHERENT_PERMISSIONS[role] || []
                                const isInherentlyGranted = role === ROLES.ADMIN || inherentForRole.includes(perm.slug)
                                const isChecked = isInherentlyGranted || localPermissions.has(perm.id)

                                return (
                                    <div key={perm.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`perm-${perm.id}`}
                                            checked={isChecked}
                                            disabled={isInherentlyGranted}
                                            onCheckedChange={isInherentlyGranted ? undefined : ((checked) => handlePermissionToggle(perm.id, checked as boolean))}
                                        />
                                        <div className="grid gap-1.5 leading-none">
                                            <label
                                                htmlFor={`perm-${perm.id}`}
                                                className={`text-sm font-medium leading-none ${isInherentlyGranted ? 'text-muted-foreground' : ''} peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2`}
                                            >
                                                {perm.name}
                                                {isInherentlyGranted && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted border text-muted-foreground whitespace-nowrap">
                                                        Wynika z roli
                                                    </span>
                                                )}
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
