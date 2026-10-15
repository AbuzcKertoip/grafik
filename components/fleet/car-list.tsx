"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    DialogDescription,
    DialogFooter,
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
import {
    Plus,
    Pencil,
    Trash2,
    UserPlus,
    AlertTriangle,
    CheckCircle,
    Car as CarIcon,
    Wrench,
    FileText,
    Archive,
    RotateCcw,
    Search,
    ShieldAlert,
    Clock,
    DollarSign,
    CarFront
} from "lucide-react"
import { createCar, updateCar, deleteCar, assignCaretaker, retireCar, reinstateCar } from "@/lib/actions/fleet"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { CarRepairsDialog } from "./car-repairs-dialog"
import { CarPolicyDialog } from "./car-policy-dialog"

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
    retiredDate?: Date | string | null
    retiredReason?: string | null
    retiredNotes?: string | null
    caretaker?: {
        id: number
        name: string | null
        username: string
    } | null
    repairs?: {
        id: number
        cost: number
    }[]
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
    const [search, setSearch] = useState("")
    const [activeTab, setActiveTab] = useState("active")

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [isRepairsDialogOpen, setIsRepairsDialogOpen] = useState(false)
    const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false)
    const [selectedCar, setSelectedCar] = useState<Car | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    // Retire / archive state
    const [carToRetire, setCarToRetire] = useState<Car | null>(null)
    const [retireStatus, setRetireStatus] = useState("SOLD")
    const [retireDate, setRetireDate] = useState(() => new Date().toISOString().split("T")[0])
    const [retireNotes, setRetireNotes] = useState("")
    const [isRetiring, setIsRetiring] = useState(false)

    // Reinstate state
    const [carToReinstate, setCarToReinstate] = useState<Car | null>(null)
    const [isReinstating, setIsReinstating] = useState(false)

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
        ownershipType: "",
        status: "ACTIVE"
    })

    const [selectedUserId, setSelectedUserId] = useState<string>("")

    useEffect(() => {
        setCars(initialCars)
    }, [initialCars])

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
                ownershipType: car.ownershipType || "",
                status: car.status || "ACTIVE"
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
                ownershipType: "",
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
        if (!confirm("UWAGA: Czy na pewno chcesz TRWALE USUNĄĆ ten pojazd z bazy danych wraz z całą jego historią napraw i polis? Jeśli pojazd został sprzedany lub zezłomowany, zaleca się skorzystanie z opcji 'Wycofaj pojazd' zamiast usuwania.")) return
        const result = await deleteCar(id)
        if (result.success) {
            toast.success("Usunięto pojazd")
            router.refresh()
        } else {
            toast.error("Błąd usuwania")
        }
    }

    const handleOpenRetireDialog = (car: Car) => {
        setCarToRetire(car)
        setRetireStatus("SOLD")
        setRetireDate(new Date().toISOString().split("T")[0])
        setRetireNotes("")
    }

    const handleConfirmRetire = async () => {
        if (!carToRetire) return
        if (!retireDate) {
            toast.error("Wybierz poprawną datę wycofania.")
            return
        }

        setIsRetiring(true)
        try {
            const result = await retireCar(carToRetire.id, {
                status: retireStatus,
                date: new Date(retireDate),
                notes: retireNotes
            })

            if (result.success) {
                const label = retireStatus === "SOLD" ? "sprzedany" : retireStatus === "SCRAPPED" ? "zezłomowany" : "wycofany"
                toast.success(`Pojazd ${carToRetire.make} ${carToRetire.model} został oznaczony jako ${label} i przeniesiony do archiwum.`)
                setCarToRetire(null)
                router.refresh()
            } else {
                toast.error(result.error || "Wystąpił błąd podczas wycofywania pojazdu")
            }
        } catch (error) {
            toast.error("Wystąpił nieoczekiwany błąd")
        } finally {
            setIsRetiring(false)
        }
    }

    const handleConfirmReinstate = async () => {
        if (!carToReinstate) return
        setIsReinstating(true)

        try {
            const result = await reinstateCar(carToReinstate.id)
            if (result.success) {
                toast.success(`Pojazd ${carToReinstate.make} ${carToReinstate.model} został przywrócony do aktywnej floty.`)
                setCarToReinstate(null)
                router.refresh()
            } else {
                toast.error(result.error || "Wystąpił błąd podczas przywracania pojazdu")
            }
        } catch (error) {
            toast.error("Wystąpił nieoczekiwany błąd")
        } finally {
            setIsReinstating(false)
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

    const activeCars = useMemo(() => {
        return cars.filter(c => c.status === "ACTIVE" || !c.status)
    }, [cars])

    const retiredCars = useMemo(() => {
        return cars.filter(c => c.status && c.status !== "ACTIVE")
    }, [cars])

    const filterCarsBySearch = (list: Car[]) => {
        const q = search.trim().toLowerCase()
        if (!q) return list
        return list.filter(c =>
            c.make.toLowerCase().includes(q) ||
            c.model.toLowerCase().includes(q) ||
            c.plate.toLowerCase().includes(q) ||
            c.vin.toLowerCase().includes(q) ||
            (c.caretaker?.name && c.caretaker.name.toLowerCase().includes(q)) ||
            (c.caretaker?.username && c.caretaker.username.toLowerCase().includes(q)) ||
            (c.retiredNotes && c.retiredNotes.toLowerCase().includes(q))
        )
    }

    const filteredActiveCars = useMemo(() => filterCarsBySearch(activeCars), [activeCars, search])
    const filteredRetiredCars = useMemo(() => filterCarsBySearch(retiredCars), [retiredCars, search])

    const expiringActiveCount = useMemo(() => {
        return activeCars.filter(c =>
            isExpired(c.inspectionValidUntil) ||
            isExpiringSoon(c.inspectionValidUntil) ||
            isExpired(c.insuranceValidUntil) ||
            isExpiringSoon(c.insuranceValidUntil) ||
            (c.acValidUntil && (isExpired(c.acValidUntil) || isExpiringSoon(c.acValidUntil)))
        ).length
    }, [activeCars])

    const renderRetireStatusBadge = (status: string) => {
        switch (status) {
            case "SOLD":
                return (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Sprzedany
                    </Badge>
                )
            case "SCRAPPED":
                return (
                    <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        Zezłomowany
                    </Badge>
                )
            case "RETURNED_LEASING":
                return (
                    <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                        Zwrot z leasingu
                    </Badge>
                )
            default:
                return (
                    <Badge variant="secondary">
                        Wycofany
                    </Badge>
                )
        }
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards / Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Aktywna Flota</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">{activeCars.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <CarFront className="h-5 w-5" />
                    </div>
                </div>

                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Wycofane / Sprzedane</p>
                        <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{retiredCars.length}</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Archive className="h-5 w-5" />
                    </div>
                </div>

                <div className={`p-4 rounded-xl border shadow-xs flex items-center justify-between ${expiringActiveCount > 0 ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20" : "bg-card text-card-foreground"}`}>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Wymaga uwagi (30 dni)</p>
                        <p className={`text-2xl font-bold mt-1 ${expiringActiveCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                            {expiringActiveCount}
                        </p>
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${expiringActiveCount > 0 ? "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <TabsList>
                        <TabsTrigger value="active" className="gap-2">
                            <CarIcon className="h-4 w-4" />
                            <span>Aktywna Flota</span>
                            <span className="rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 px-1.5 py-0.2 text-[10px] font-semibold">
                                {activeCars.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="archive" className="gap-2">
                            <Archive className="h-4 w-4" />
                            <span>Wycofane / Archiwum</span>
                            {retiredCars.length > 0 && (
                                <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-semibold">
                                    {retiredCars.length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative w-full sm:w-[260px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Szukaj pojazdu, VIN, rej..."
                                className="pl-9 h-9 w-full"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        {isAdmin && activeTab === "active" && (
                            <Button size="sm" onClick={() => handleOpenDialog()} className="shrink-0">
                                <Plus className="mr-1.5 h-4 w-4" /> Dodaj Pojazd
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tab: Aktywna Flota */}
                <TabsContent value="active" className="space-y-4 mt-0">
                    <div className="rounded-md border bg-card text-card-foreground dark:border-slate-800 overflow-x-auto">
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
                                {filteredActiveCars.map((car) => (
                                    <TableRow key={car.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <CarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="font-semibold">{car.make} {car.model}</span>
                                                <span className="text-xs text-muted-foreground">({car.productionYear})</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground font-mono ml-6">VIN: {car.vin}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded border bg-muted/30">
                                                {car.plate}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-secondary text-secondary-foreground">
                                                {car.ownershipType || "Brak danych"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`flex items-center gap-1 text-sm ${isExpired(car.inspectionValidUntil) ? "text-red-600 font-bold" :
                                                isExpiringSoon(car.inspectionValidUntil) ? "text-amber-600 font-semibold" : ""
                                                }`}>
                                                {format(new Date(car.inspectionValidUntil), "d MMM yyyy", { locale: pl })}
                                                {isExpired(car.inspectionValidUntil) && <AlertTriangle className="h-4 w-4 shrink-0" />}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`flex items-center gap-1 text-sm ${isExpired(car.insuranceValidUntil) ? "text-red-600 font-bold" :
                                                isExpiringSoon(car.insuranceValidUntil) ? "text-amber-600 font-semibold" : ""
                                                }`}>
                                                {format(new Date(car.insuranceValidUntil), "d MMM yyyy", { locale: pl })}
                                                {isExpired(car.insuranceValidUntil) && <AlertTriangle className="h-4 w-4 shrink-0" />}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Polisa: {car.policyNumber}</div>
                                        </TableCell>
                                        <TableCell>
                                            {car.acValidUntil ? (
                                                <div className={`flex items-center gap-1 text-sm ${isExpired(car.acValidUntil) ? "text-red-600 font-bold" :
                                                    isExpiringSoon(car.acValidUntil) ? "text-amber-600 font-semibold" : ""
                                                }`}>
                                                    {format(new Date(car.acValidUntil), "d MMM yyyy", { locale: pl })}
                                                    {isExpired(car.acValidUntil) && <AlertTriangle className="h-4 w-4 shrink-0" />}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Brak AC</span>
                                            )}
                                            {car.acPolicyNumber && <div className="text-xs text-muted-foreground">Polisa: {car.acPolicyNumber}</div>}
                                        </TableCell>
                                        <TableCell>
                                            {car.caretaker ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2.5 py-1 rounded-full text-xs font-medium">
                                                        {car.caretaker.name || car.caretaker.username}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Brak opiekuna</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <Button variant="outline" size="icon" onClick={() => handlePolicyOpen(car)} title="Skany polis" className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900/50 dark:hover:bg-blue-950/40">
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => handleRepairsOpen(car)} title="Naprawy i koszty" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-900/50 dark:hover:bg-indigo-950/40">
                                                    <Wrench className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => handleAssignOpen(car)} title="Przypisz opiekuna">
                                                    <UserPlus className="h-4 w-4" />
                                                </Button>
                                                {isAdmin && (
                                                    <>
                                                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(car)} title="Edytuj dane pojazdu">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleOpenRetireDialog(car)}
                                                            title="Wycofaj pojazd (Sprzedaż / Złomowanie)"
                                                            className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(car.id)}
                                                            title="Trwale usuń z bazy"
                                                            className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {filteredActiveCars.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground h-28">
                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                <CarIcon className="h-6 w-6 text-muted-foreground/40" />
                                                <p className="text-sm font-medium">
                                                    {search ? "Nie znaleziono aktywnych pojazdów spełniających kryteria." : "Brak aktywnych pojazdów we flocie."}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Tab: Wycofane / Archiwum */}
                <TabsContent value="archive" className="space-y-4 mt-0">
                    <div className="rounded-md border bg-card text-card-foreground dark:border-slate-800 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Pojazd</TableHead>
                                    <TableHead>Rejestracja</TableHead>
                                    <TableHead>Status wycofania</TableHead>
                                    <TableHead>Data wycofania</TableHead>
                                    <TableHead>Notatki / Powód</TableHead>
                                    <TableHead>Historia kosztów</TableHead>
                                    <TableHead className="text-right">Akcje</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRetiredCars.map((car) => {
                                    const totalRepairCost = car.repairs?.reduce((acc, r) => acc + (r.cost || 0), 0) || 0
                                    const repairsCount = car.repairs?.length || 0

                                    return (
                                        <TableRow key={car.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <CarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-semibold">{car.make} {car.model}</span>
                                                    <span className="text-xs text-muted-foreground">({car.productionYear})</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono ml-6">VIN: {car.vin}</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono font-semibold text-xs px-2 py-0.5 rounded border bg-muted/30">
                                                    {car.plate}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {renderRetireStatusBadge(car.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {car.retiredDate ? format(new Date(car.retiredDate), "d MMMM yyyy", { locale: pl }) : "-"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[280px]">
                                                {car.retiredNotes ? (
                                                    <span className="text-xs text-foreground block truncate" title={car.retiredNotes}>
                                                        {car.retiredNotes}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Brak uwag</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-foreground">
                                                        {totalRepairCost.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRepairsOpen(car)}
                                                        title={`Podgląd napraw (${repairsCount})`}
                                                        className="h-7 w-7 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                                    >
                                                        <Wrench className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => handlePolicyOpen(car)}
                                                        title="Archiwalne skany polis"
                                                        className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/50"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setCarToReinstate(car)}
                                                                title="Przywróć pojazd do aktywnej floty"
                                                                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 gap-1 text-xs"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                                                Przywróć
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(car.id)}
                                                                title="Trwale usuń z bazy"
                                                                className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}

                                {filteredRetiredCars.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Archive className="h-8 w-8 text-muted-foreground/30" />
                                                <p className="text-sm font-medium">
                                                    {search ? "Nie znaleziono wycofanych pojazdów spełniających kryteria." : "Brak wycofanych pojazdów w archiwum."}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Gdy sprzedasz lub zezłomujesz pojazd, skorzystaj z opcji „Wycofaj”, aby przenieść go tutaj bez utraty historii.
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Retire Vehicle Dialog */}
            <Dialog open={!!carToRetire} onOpenChange={(open) => { if (!open) setCarToRetire(null) }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-1">
                            <Archive className="h-5 w-5" />
                            <DialogTitle>Wycofaj pojazd z floty</DialogTitle>
                        </div>
                        <DialogDescription>
                            Wycofujesz pojazd <strong className="text-foreground">{carToRetire?.make} {carToRetire?.model} ({carToRetire?.plate})</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <p className="font-semibold">Co się stanie po wycofaniu:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-amber-400/80">
                                <li>Pojazd zostanie przeniesiony do zakładki <strong>Archiwum</strong>.</li>
                                <li>Jeśli miał przypisanego opiekuna, zostanie od niego odpięty.</li>
                                <li>Pojazd przestanie generować alerty o ubezpieczeniu OC/AC i badaniach technicznych.</li>
                                <li>Wszystkie faktury, naprawy i skany polis <strong>zostaną bezterminowo zachowane</strong>.</li>
                            </ul>
                        </div>

                        {carToRetire?.caretaker && (
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 p-2.5 text-xs text-blue-900 dark:text-blue-200">
                                ℹ️ Aktualny opiekun: <strong>{carToRetire.caretaker.name || carToRetire.caretaker.username}</strong> zostanie automatycznie odpięty.
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="retire-status" className="text-sm font-medium">
                                Powód wycofania
                            </Label>
                            <Select value={retireStatus} onValueChange={setRetireStatus}>
                                <SelectTrigger id="retire-status">
                                    <SelectValue placeholder="Wybierz powód" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SOLD">Sprzedaż pojazdu</SelectItem>
                                    <SelectItem value="SCRAPPED">Złomowanie / Kasacja</SelectItem>
                                    <SelectItem value="RETURNED_LEASING">Zwrot z leasingu / wynajmu długoterminowego</SelectItem>
                                    <SelectItem value="WITHDRAWN">Wycofanie z eksploatacji (inny powód)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="retire-date" className="text-sm font-medium">
                                Data wycofania / sprzedaży
                            </Label>
                            <Input
                                id="retire-date"
                                type="date"
                                value={retireDate}
                                onChange={(e) => setRetireDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="retire-notes" className="text-sm font-medium">
                                Notatki / Szczegóły (opcjonalnie)
                            </Label>
                            <Textarea
                                id="retire-notes"
                                placeholder="np. Sprzedano firmie XYZ za kwotę 35 000 zł, faktura FS/2026/04/12 lub nr zaświadczenia o demontażu..."
                                value={retireNotes}
                                onChange={(e) => setRetireNotes(e.target.value)}
                                className="min-h-[80px] text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setCarToRetire(null)}
                            disabled={isRetiring}
                        >
                            Anuluj
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmRetire}
                            disabled={isRetiring}
                        >
                            {isRetiring ? "Wycofywanie..." : "Potwierdź wycofanie"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reinstate Vehicle Dialog */}
            <Dialog open={!!carToReinstate} onOpenChange={(open) => { if (!open) setCarToReinstate(null) }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                            <RotateCcw className="h-5 w-5" />
                            <DialogTitle>Przywróć pojazd do floty</DialogTitle>
                        </div>
                        <DialogDescription>
                            Czy na pewno chcesz przywrócić pojazd <strong className="text-foreground">{carToReinstate?.make} {carToReinstate?.model} ({carToReinstate?.plate})</strong> do aktywnej floty?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                            <p className="font-semibold flex items-center gap-1.5">
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                Skutki przywrócenia:
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground dark:text-emerald-400/80">
                                <li>Pojazd powróci na listę <strong>Aktywnej Floty</strong>.</li>
                                <li>Będzie można ponownie przypisać do niego opiekuna.</li>
                                <li>System wznowi monitorowanie terminów badań technicznych i polis OC/AC.</li>
                            </ul>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setCarToReinstate(null)}
                            disabled={isReinstating}
                        >
                            Anuluj
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleConfirmReinstate}
                            disabled={isReinstating}
                        >
                            {isReinstating ? "Przywracanie..." : "Potwierdź przywrócenie"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            <Label htmlFor="ownership">Właściciel / Typ własności</Label>
                            <Input 
                                id="ownership" 
                                value={formData.ownershipType} 
                                onChange={(e) => setFormData({ ...formData, ownershipType: e.target.value })} 
                                placeholder="Wpisz ręcznie np. Leasing, Wynajem..."
                            />
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
                    key={selectedCar.id}
                    carId={selectedCar.id}
                    carName={`${selectedCar.make} ${selectedCar.model} (${selectedCar.plate})`}
                    policyUrl={selectedCar.policyUrl || null}
                    isOpen={isPolicyDialogOpen}
                    onOpenChange={setIsPolicyDialogOpen}
                />
            )}
        </div>
    )
}
