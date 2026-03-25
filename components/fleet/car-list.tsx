"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Plus, Pencil, Trash2, UserPlus, AlertTriangle, CheckCircle, Car as CarIcon } from "lucide-react"
import { createCar, updateCar, deleteCar, assignCaretaker } from "@/lib/actions/fleet"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CarRepairsDialog } from "./car-repairs-dialog"
import { CarPolicyDialog } from "./car-policy-dialog"
import { Wrench, FileText } from "lucide-react"

interface Car {
    id: number
    make: string
    model: string
    plate: string
    vin: string
    productionYear: number
    inspectionValidUntil: Date
    insuranceValidUntil: Date
    policyNumber: string
    policyUrl?: string | null
    acValidUntil?: Date | null
    acPolicyNumber?: string | null
    acPolicyUrl?: string | null
    ownershipType: string
    status: string
    caretaker?: {
        id: number
        name: string | null
        username: string
    } | null
}

interface User {
    id: number
    name: string | null
    username: string
}

interface CarListProps {
    initialCars: Car[]
    users: User[]
    isAdmin: boolean
}

export function CarList({ initialCars, users, isAdmin }: CarListProps) {
    const [cars, setCars] = useState<Car[]>(initialCars)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [isRepairsDialogOpen, setIsRepairsDialogOpen] = useState(false)
    const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false)
    const [selectedCar, setSelectedCar] = useState<Car | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Form state
    const [formData, setFormData] = useState({
        make: "",
        model: "",
        plate: "",
        vin: "",
        productionYear: new Date().getFullYear(),
        inspectionValidUntil: "",
        insuranceValidUntil: "",
        policyNumber: "",
        acValidUntil: "",
        acPolicyNumber: "",
        ownershipType: "COMPANY",
        status: "ACTIVE"
    })

    const [selectedUserId, setSelectedUserId] = useState<string>("")

    const handleOpenDialog = (car?: Car) => {
        if (car) {
            setSelectedCar(car)
            setFormData({
                make: car.make,
                model: car.model,
                plate: car.plate,
                vin: car.vin,
                productionYear: car.productionYear,
                inspectionValidUntil: new Date(car.inspectionValidUntil).toISOString().split('T')[0],
                insuranceValidUntil: new Date(car.insuranceValidUntil).toISOString().split('T')[0],
                policyNumber: car.policyNumber,
                acValidUntil: car.acValidUntil ? new Date(car.acValidUntil).toISOString().split('T')[0] : "",
                acPolicyNumber: car.acPolicyNumber || "",
                ownershipType: car.ownershipType || "COMPANY",
                status: car.status
            })
        } else {
            setSelectedCar(null)
            setFormData({
                make: "",
                model: "",
                plate: "",
                vin: "",
                productionYear: new Date().getFullYear(),
                inspectionValidUntil: "",
                insuranceValidUntil: "",
                policyNumber: "",
                acValidUntil: "",
                acPolicyNumber: "",
                ownershipType: "COMPANY",
                status: "ACTIVE"
            })
        }
        setIsDialogOpen(true)
    }

    const handleSubmit = async () => {
        setIsLoading(true)
        try {
            const data = {
                ...formData,
                productionYear: Number(formData.productionYear),
                inspectionValidUntil: new Date(formData.inspectionValidUntil),
                insuranceValidUntil: new Date(formData.insuranceValidUntil),
                acValidUntil: formData.acValidUntil ? new Date(formData.acValidUntil) : null,
                acPolicyNumber: formData.acPolicyNumber || "",
                ownershipType: formData.ownershipType
            }

            if (selectedCar) {
                const result = await updateCar(selectedCar.id, data)
                if (result.success) {
                    toast.success("Zaktualizowano pojazd")
                    setIsDialogOpen(false)
                    router.refresh()
                } else {
                    toast.error("Błąd aktualizacji")
                }
            } else {
                const result = await createCar(data)
                if (result.success) {
                    toast.success("Dodano pojazd")
                    setIsDialogOpen(false)
                    router.refresh()
                } else {
                    toast.error("Błąd dodawania")
                }
            }
        } catch (e) {
            toast.error("Wystąpił błąd")
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć ten pojazd?")) return
        const result = await deleteCar(id)
        if (result.success) {
            toast.success("Usunięto pojazd")
            router.refresh()
        } else {
            toast.error("Błąd usuwania")
        }
    }

    const handleAssignOpen = (car: Car) => {
        setSelectedCar(car)
        setSelectedUserId(car.caretaker?.id.toString() || "")
        setIsAssignDialogOpen(true)
    }

    const handleAssignSubmit = async () => {
        if (!selectedCar) return
        setIsLoading(true)
        try {
            const userId = selectedUserId === "none" ? null : Number(selectedUserId)
            const result = await assignCaretaker(selectedCar.id, userId)
            if (result.success) {
                toast.success("Zaktualizowano przypisanie")
                setIsAssignDialogOpen(false)
                router.refresh()
            } else {
                toast.error("Błąd przypisywania")
            }
        } catch (e) {
            toast.error("Wystąpił błąd")
        } finally {
            setIsLoading(false)
        }
    }

    const handleRepairsOpen = (car: Car) => {
        setSelectedCar(car)
        setIsRepairsDialogOpen(true)
    }

    const handlePolicyOpen = (car: Car) => {
        setSelectedCar(car)
        setIsPolicyDialogOpen(true)
    }

    const isExpired = (date: Date) => {
        const now = new Date()
        return new Date(date) < now
    }

    const isExpiringSoon = (date: Date) => {
        const now = new Date()
        const target = new Date(date)
        const diffTime = target.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays > 0 && diffDays <= 30
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Lista Pojazdów</h2>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" /> Dodaj Pojazd
                </Button>
            </div>

            <div className="rounded-md border bg-card text-card-foreground dark:border-slate-800">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pojazd</TableHead>
                            <TableHead>Rejestracja</TableHead>
                            <TableHead>Własność</TableHead>
                            <TableHead>Przegląd</TableHead>
                            <TableHead>OC</TableHead>
                            <TableHead>AC</TableHead>
                            <TableHead>Opiekun</TableHead>
                            <TableHead className="text-right">Akcje</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialCars.map((car) => (
                            <TableRow key={car.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <CarIcon className="h-4 w-4 text-muted-foreground" />
                                        {car.make} {car.model} ({car.productionYear})
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-6">VIN: {car.vin}</div>
                                </TableCell>
                                <TableCell>{car.plate}</TableCell>
                                <TableCell>
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                        car.ownershipType === 'LEASING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                        car.ownershipType === 'BORROWED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    }`}>
                                        {car.ownershipType === 'LEASING' ? 'Leasing' : car.ownershipType === 'BORROWED' ? 'Wypożyczony' : 'Własność firmy'}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className={`flex items-center gap-1 ${isExpired(car.inspectionValidUntil) ? "text-red-600 font-bold" :
                                        isExpiringSoon(car.inspectionValidUntil) ? "text-amber-600 font-semibold" : ""
                                        }`}>
                                        {format(new Date(car.inspectionValidUntil), "d MMM yyyy", { locale: pl })}
                                        {isExpired(car.inspectionValidUntil) && <AlertTriangle className="h-4 w-4" />}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className={`flex items-center gap-1 ${isExpired(car.insuranceValidUntil) ? "text-red-600 font-bold" :
                                        isExpiringSoon(car.insuranceValidUntil) ? "text-amber-600 font-semibold" : ""
                                        }`}>
                                        {format(new Date(car.insuranceValidUntil), "d MMM yyyy", { locale: pl })}
                                        {isExpired(car.insuranceValidUntil) && <AlertTriangle className="h-4 w-4" />}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Polisa: {car.policyNumber}</div>
                                </TableCell>
                                <TableCell>
                                    {car.acValidUntil ? (
                                        <div className={`flex items-center gap-1 ${isExpired(car.acValidUntil) ? "text-red-600 font-bold" :
                                            isExpiringSoon(car.acValidUntil) ? "text-amber-600 font-semibold" : ""
                                        }`}>
                                            {format(new Date(car.acValidUntil), "d MMM yyyy", { locale: pl })}
                                            {isExpired(car.acValidUntil) && <AlertTriangle className="h-4 w-4" />}
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">Brak AC</span>
                                    )}
                                    {car.acPolicyNumber && <div className="text-xs text-muted-foreground">Polisa: {car.acPolicyNumber}</div>}
                                </TableCell>
                                <TableCell>
                                    {car.caretaker ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium">
                                                {car.caretaker.name || car.caretaker.username}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">Brak opiekuna</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="icon" onClick={() => handlePolicyOpen(car)} title="Skany polis" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => handleRepairsOpen(car)} title="Naprawy" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                                            <Wrench className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => handleAssignOpen(car)} title="Przypisz opiekuna">
                                            <UserPlus className="h-4 w-4" />
                                        </Button>
                                        {isAdmin && (
                                            <>
                                                <Button variant="outline" size="icon" onClick={() => handleOpenDialog(car)} title="Edytuj">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="destructive" size="icon" onClick={() => handleDelete(car.id)} title="Usuń">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Edit/Add Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{selectedCar ? "Edytuj Pojazd" : "Dodaj Nowy Pojazd"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="make">Marka</Label>
                                <Input id="make" value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="model">Model</Label>
                                <Input id="model" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plate">Rejestracja</Label>
                                <Input id="plate" value={formData.plate} onChange={(e) => setFormData({ ...formData, plate: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Rocznik</Label>
                                <Input id="year" type="number" value={formData.productionYear} onChange={(e) => setFormData({ ...formData, productionYear: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vin">VIN</Label>
                            <Input id="vin" value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="inspection">Data Przeglądu</Label>
                                <Input id="inspection" type="date" value={formData.inspectionValidUntil} onChange={(e) => setFormData({ ...formData, inspectionValidUntil: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insurance">Data Ubezpieczenia</Label>
                                <Input id="insurance" type="date" value={formData.insuranceValidUntil} onChange={(e) => setFormData({ ...formData, insuranceValidUntil: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="policy">Numer Polisy OC</Label>
                            <Input id="policy" value={formData.policyNumber} onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="acDate">Data ważności AC</Label>
                                <Input id="acDate" type="date" value={formData.acValidUntil} onChange={(e) => setFormData({ ...formData, acValidUntil: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="acPolicy">Numer Polisy AC</Label>
                                <Input id="acPolicy" value={formData.acPolicyNumber} onChange={(e) => setFormData({ ...formData, acPolicyNumber: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ownership">Typ własności</Label>
                            <Select value={formData.ownershipType} onValueChange={(v) => setFormData({ ...formData, ownershipType: v })}>
                                <SelectTrigger id="ownership">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="COMPANY">Własność firmy</SelectItem>
                                    <SelectItem value="LEASING">Leasing</SelectItem>
                                    <SelectItem value="BORROWED">Wypożyczony</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Anuluj</Button>
                        <Button onClick={handleSubmit} disabled={isLoading}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Dialog */}
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Przypisz Opiekuna</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="caretaker">Wybierz pracownika</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz opiekuna" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">-- Brak opiekuna --</SelectItem>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                        {user.name || user.username}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Anuluj</Button>
                        <Button onClick={handleAssignSubmit} disabled={isLoading}>Zapisz</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Repairs Dialog */}
            {selectedCar && (
                <CarRepairsDialog
                    carId={selectedCar.id}
                    carName={`${selectedCar.make} ${selectedCar.model} (${selectedCar.plate})`}
                    isOpen={isRepairsDialogOpen}
                    onOpenChange={setIsRepairsDialogOpen}
                    isAdmin={isAdmin}
                />
            )}

            {/* Policy Dialog */}
            {selectedCar && (
                <CarPolicyDialog
                    carId={selectedCar.id}
                    carName={`${selectedCar.make} ${selectedCar.model} (${selectedCar.plate})`}
                    policyUrl={selectedCar.policyUrl || null}
                    acPolicyUrl={selectedCar.acPolicyUrl || null}
                    isOpen={isPolicyDialogOpen}
                    onOpenChange={setIsPolicyDialogOpen}
                />
            )}
        </div>
    )
}
