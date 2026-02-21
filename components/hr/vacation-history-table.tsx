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
import { CalendarDays } from "lucide-react";

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
            case "VACATION":
                return "Urlop wypoczynkowy";
            case "SICK":
                return "L4 / Chorobowe";
            case "OTHER":
                return "Inny / Okolicznościowy";
            default:
                return type;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "VACATION":
                return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
            case "SICK":
                return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
            default:
                return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
        }
    };

    const now = new Date();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Historia i Zaplanowane Urlopy
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Od</TableHead>
                            <TableHead>Do</TableHead>
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
                            const durationDays =
                                Math.ceil(
                                    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
                                ) + 1; // inclusive

                            return (
                                <TableRow key={vacation.id}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {format(start, "d MMMM yyyy", { locale: pl })}
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {format(end, "d MMMM yyyy", { locale: pl })}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getTypeColor(vacation.type)}>
                                            {getTypeLabel(vacation.type)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{durationDays} dni</TableCell>
                                    <TableCell>
                                        {isFuture && vacation.approved ? (
                                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">Zaplanowany</Badge>
                                        ) : isOngoing && vacation.approved ? (
                                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 animate-pulse">W trakcie</Badge>
                                        ) : vacation.approved ? (
                                            <Badge variant="outline" className="text-muted-foreground border-dashed">Zakończony</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-500">Oczekujący</Badge>
                                        )}
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
