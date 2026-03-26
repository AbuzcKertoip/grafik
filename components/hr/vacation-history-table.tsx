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
import { CalendarDays, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBusinessDaysCount } from "@/lib/holidays";

interface VacationHistoryTableProps {
    vacations: Vacation[];
}

export function VacationHistoryTable({ vacations }: VacationHistoryTableProps) {
    if (!vacations || vacations.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        Historia Urlopów
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-t">
                    <CalendarDays className="h-12 w-12 mb-4 opacity-20" />
                    <p>Brak zapisanej historii urlopów lub zaplanowanych wniosków.</p>
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    Historia i Zaplanowane Urlopy
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[150px]">Od</TableHead>
                            <TableHead className="w-[150px]">Do</TableHead>
                            <TableHead>Typ urlopu</TableHead>
                            <TableHead>Czas trwania</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vacations.map((vacation) => {
                            const start = new Date(vacation.startDate);
                            const end = new Date(vacation.endDate);
                            const isFuture = start > now;
                            const isOngoing = start <= now && end >= now;
                            const durationDays = getBusinessDaysCount(start, end);
 
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
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
