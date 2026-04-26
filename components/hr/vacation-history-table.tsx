"use client";

import { Vacation } from "@prisma/client";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Info, Pencil, X } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBusinessDaysCount } from "@/lib/holidays";
import { groupVacations } from "@/lib/vacation-utils";
import { deleteVacation, cancelVacation, editVacation } from "@/lib/actions/vacations";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VacationHistoryTableProps {
    vacations: Vacation[];
    canManage?: boolean;
    contractType?: string;
}

export function VacationHistoryTable({ vacations, canManage = false, contractType = "UOP" }: VacationHistoryTableProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [isCancelling, setIsCancelling] = useState<number | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingVacation, setEditingVacation] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        startDate: "",
        endDate: "",
        type: "VACATION",
        note: ""
    });
    const [isEditing, setIsEditing] = useState(false);

    const isUOP = contractType === 'UOP' || contractType === 'UOP_PART_TIME';
    const sectionLabel = isUOP ? "Urlopów" : "Nieobecności";
    const sectionLabelFull = isUOP ? "Historia i Zaplanowane Urlopy" : "Historia i Zaplanowane Nieobecności";

    const handleDelete = async (id: number) => {
        if (!confirm("Czy na pewno chcesz usunąć ten wniosek z historii?")) return;
        setIsDeleting(id);
        try {
            const result = await deleteVacation(id);
            if (result.success) {
                toast.success("Usunięto wniosek z historii.");
                router.refresh();
            } else {
                toast.error(result.error || "Wystąpił błąd");
            }
        } catch (error) {
            toast.error("Wystąpił błąd");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleCancel = async (id: number) => {
        if (!confirm("Czy na pewno chcesz anulować ten urlop? Dni zostaną zwrócone do puli.")) return;
        setIsCancelling(id);
        try {
            const result = await cancelVacation(id);
            if (result.success) {
                toast.success("Urlop anulowany. Dni zostały zwrócone do puli.");
                router.refresh();
            } else {
                toast.error(result.error || "Wystąpił błąd");
            }
        } catch (error) {
            toast.error("Wystąpił błąd");
        } finally {
            setIsCancelling(null);
        }
    };

    const openEditDialog = (vacation: any) => {
        setEditingVacation(vacation);
        setEditForm({
            startDate: format(new Date(vacation.startDate), "yyyy-MM-dd"),
            endDate: format(new Date(vacation.endDate), "yyyy-MM-dd"),
            type: vacation.type,
            note: vacation.note || ""
        });
        setEditDialogOpen(true);
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVacation) return;

        const start = new Date(editForm.startDate);
        const end = new Date(editForm.endDate);

        if (start > end) {
            toast.error("Data początkowa nie może być późniejsza niż końcowa");
            return;
        }

        setIsEditing(true);
        try {
            const result = await editVacation(
                editingVacation.id,
                start,
                end,
                editForm.type,
                editForm.note
            );
            if (result?.success) {
                toast.success("Wniosek został zaktualizowany.");
                setEditDialogOpen(false);
                setEditingVacation(null);
                router.refresh();
            } else {
                toast.error(result?.error || "Wystąpił błąd");
            }
        } catch (error) {
            toast.error("Wystąpił błąd serwera");
        } finally {
            setIsEditing(false);
        }
    };

    if (!vacations || vacations.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        Historia {sectionLabel}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-t">
                    <CalendarDays className="h-12 w-12 mb-4 opacity-20" />
                    <p>Brak zapisanej historii {sectionLabel.toLowerCase()} lub zaplanowanych wniosków.</p>
                </CardContent>
            </Card>
        );
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "VACATION": return "Urlop wypoczynkowy";
            case "ON_DEMAND": return "Urlop na żądanie";
            case "SPECIAL_LEAVE": return "Urlop okolicznościowy";
            case "CHILDCARE": return "Opieka nad dzieckiem";
            case "ADDITIONAL": return "Dodatkowy urlop";
            case "OVERTIME": return "Odbiór nadgodzin";
            case "SICK": return "L4 / Chorobowe";
            case "OTHER": return "Inny";
            default: return type;
        }
    };
 
    const getTypeColor = (type: string) => {
        switch (type) {
            case "VACATION": return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
            case "ON_DEMAND": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400";
            case "SPECIAL_LEAVE": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
            case "CHILDCARE": return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400";
            case "ADDITIONAL": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
            case "OVERTIME": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400";
            case "SICK": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400";
            default: return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
        }
    };
 
    const now = new Date();
 
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        {sectionLabelFull}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 border-t overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-[150px] whitespace-nowrap">Od</TableHead>
                                <TableHead className="w-[150px] whitespace-nowrap">Do</TableHead>
                                <TableHead className="whitespace-nowrap">Typ</TableHead>
                                <TableHead className="whitespace-nowrap">Czas trwania</TableHead>
                                <TableHead className="whitespace-nowrap">Status</TableHead>
                                <TableHead className="whitespace-nowrap text-right">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupVacations(vacations).map((vacation) => {
                                const start = new Date(vacation.startDate);
                                const end = new Date(vacation.endDate);
                                const isFuture = start > now;
                                const isOngoing = start <= now && end >= now;
                                const durationDays = getBusinessDaysCount(start, end);
                                const isActive = vacation.status === 'APPROVED' || vacation.status === 'PENDING';
                                const isCancelledOrRejected = vacation.status === 'CANCELLED' || vacation.status === 'REJECTED';
 
                                return (
                                    <TableRow key={vacation.id} className={vacation.status === 'CANCELLED' ? 'opacity-60 bg-muted/10' : ''}>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {format(start, "d MMMM yyyy", { locale: pl })}
                                        </TableCell>
                                        <TableCell className="font-medium whitespace-nowrap">
                                            {format(end, "d MMMM yyyy", { locale: pl })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${getTypeColor(vacation.type)} border shadow-sm`}>
                                                {getTypeLabel(vacation.type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{durationDays} dni</TableCell>
                                        <TableCell>
                                            <TooltipProvider>
                                                {vacation.status === "REJECTED" ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-500 cursor-help flex items-center gap-1 w-max">
                                                                Odrzucony <Info className="h-3 w-3" />
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-xs">
                                                            <p className="font-semibold mb-1">Powód odmowy:</p>
                                                            <p className="text-sm">{vacation.rejectReason || "Brak uzasadnienia"}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : vacation.status === "CANCELLED" ? (
                                                    <Badge variant="outline" className="text-muted-foreground bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800">
                                                        Anulowany
                                                    </Badge>
                                                ) : vacation.status === "PENDING" ? (
                                                    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/10">
                                                        Oczekujący
                                                    </Badge>
                                                ) : isFuture && vacation.status === "APPROVED" ? (
                                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Zaplanowany</Badge>
                                                ) : isOngoing && vacation.status === "APPROVED" ? (
                                                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 animate-pulse">W trakcie</Badge>
                                                ) : vacation.status === "APPROVED" ? (
                                                    <Badge variant="outline" className="text-muted-foreground border-dashed">Zakończony</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-500">Oczekujący</Badge>
                                                )}
                                            </TooltipProvider>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Edit button - visible for managers/admins on active vacations */}
                                                {canManage && isActive && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                                    onClick={() => openEditDialog(vacation)}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Edytuj wniosek</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                {/* Cancel button - visible for managers/admins on approved vacations */}
                                                {canManage && vacation.status === 'APPROVED' && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                                    onClick={() => handleCancel(vacation.id)}
                                                                    disabled={isCancelling === vacation.id}
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Anuluj urlop (dni wrócą do puli)</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                {/* Delete button - for cancelled/rejected vacations */}
                                                {isCancelledOrRejected && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                    onClick={() => handleDelete(vacation.id)}
                                                                    disabled={isDeleting === vacation.id}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Usuń z historii</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Vacation Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edytuj wniosek urlopowy</DialogTitle>
                        <DialogDescription>
                            Zmień daty, typ lub notatkę wniosku. Jeśli urlop był zatwierdzony, grafik zostanie automatycznie zaktualizowany.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSave} className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="editStartDate">Od</Label>
                                <Input
                                    id="editStartDate"
                                    type="date"
                                    required
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="editEndDate">Do</Label>
                                <Input
                                    id="editEndDate"
                                    type="date"
                                    required
                                    value={editForm.endDate}
                                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="editType">Typ</Label>
                            <Select
                                value={editForm.type}
                                onValueChange={(val) => setEditForm({ ...editForm, type: val })}
                            >
                                <SelectTrigger id="editType">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VACATION">Urlop wypoczynkowy</SelectItem>
                                    <SelectItem value="ON_DEMAND">Urlop na żądanie</SelectItem>
                                    <SelectItem value="SPECIAL_LEAVE">Urlop okolicznościowy</SelectItem>
                                    <SelectItem value="CHILDCARE">Opieka nad dzieckiem</SelectItem>
                                    <SelectItem value="ADDITIONAL">Dodatkowy urlop</SelectItem>
                                    <SelectItem value="OVERTIME">Odbiór nadgodzin</SelectItem>
                                    <SelectItem value="SICK">L4 / Chorobowe</SelectItem>
                                    <SelectItem value="OTHER">Inny</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="editNote">Notatka (opcjonalnie)</Label>
                            <Input
                                id="editNote"
                                value={editForm.note}
                                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                                placeholder="Np. korekta dat..."
                            />
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Anuluj</Button>
                            <Button type="submit" disabled={isEditing}>
                                {isEditing ? "Zapisywanie..." : "Zapisz zmiany"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
