import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Users, Briefcase, FileText, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const userId = parseInt(session.user.id);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Fetch Today's Team Schedule
    const todaySchedule = await prisma.scheduleDay.findMany({
        where: {
            date: {
                gte: startOfToday,
                lte: endOfToday,
            },
            type: { in: ['SHIFT_1', 'SHIFT_2', 'DUTY'] }
        },
        include: {
            user: true,
        },
        orderBy: {
            type: 'asc', // SHIFT_1, SHIFT_2...
        }
    });

    // 2. Fetch My Next Shift
    const nextShift = await prisma.scheduleDay.findFirst({
        where: {
            userId: userId,
            date: {
                gt: endOfToday,
            },
            type: { not: 'OFF' }
        },
        orderBy: {
            date: 'asc',
        },
    });

    // 3. Status Today
    const myStatusToday = todaySchedule.find(s => s.userId === userId);

    // 4. Work Stats (Current Month)
    const workStats = await prisma.workLogEntry.aggregate({
        _sum: {
            duration: true,
            overtime: true,
        },
        where: {
            userId: userId,
            date: {
                gte: startOfMonth,
                lte: endOfMonth,
            }
        }
    });

    // 5. Admin: Pending Vacations (skipped as per previous notes)

    // 6. Medical Exams Alerts
    let examsToCheck: any[] = [];

    if (session.user.role === 'ADMIN') {
        // Admin sees all expiring exams
        examsToCheck = await (prisma as any).medicalExam.findMany({
            include: { user: true }
        });
    } else {
        // User sees only their own
        examsToCheck = await (prisma as any).medicalExam.findMany({
            where: { userId: userId },
            include: { user: true }
        });
    }

    const expiringExams = examsToCheck.filter((exam: any) => {
        const daysLeft = Math.ceil((new Date(exam.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 30; // Alert if less than 30 days
    });

    const typeLabels: Record<string, string> = {
        'SHIFT_1': 'Zmiana 1 (8:00 - 16:00)',
        'SHIFT_2': 'Zmiana 2 (11:00 - 19:00)',
        'DUTY': 'Dyżur',
    };

    const typeColors: Record<string, string> = {
        'SHIFT_1': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        'SHIFT_2': 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
        'DUTY': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        {now.getHours() < 18 ? "Dzień dobry" : "Dobry wieczór"}, {session.user.name || session.user.username}!
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Dziś jest {format(now, "EEEE, d MMMM yyyy", { locale: pl })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/work-logs">
                        <Button className="gap-2">
                            <Clock className="h-4 w-4" /> Ewidencja
                        </Button>
                    </Link>
                    <Link href="/dashboard/schedule">
                        <Button variant="outline" className="gap-2">
                            <CalendarDays className="h-4 w-4" /> Grafik
                        </Button>
                    </Link>
                </div>
            </div>

            {expiringExams.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-amber-800 dark:text-amber-400">Wymagane działanie: Badania kończą ważność</h3>
                        <ul className="list-disc list-inside mt-1 text-sm text-amber-700 dark:text-amber-300">
                            {expiringExams.map((exam: any) => {
                                const examLabels: Record<string, string> = {
                                    'MEDICINE_WORK': 'Medycyna Pracy',
                                    'SANITARY': 'Badania Sanitarno-Epidemiologiczne',
                                    'SAFETY_TRAINING': 'Szkolenie BHP',
                                };
                                return (
                                    <li key={exam.id}>
                                        {session.user.role === 'ADMIN' && <span className="font-semibold">{exam.user.name || exam.user.username}: </span>}
                                        {examLabels[exam.type] || exam.type} (do {format(new Date(exam.validUntil), "d MMMM yyyy", { locale: pl })})
                                    </li>
                                );
                            })}
                        </ul>
                        <Link href={session.user.role === 'ADMIN' ? "/dashboard/hr" : "/dashboard/profile"} className="text-amber-900 dark:text-amber-200 text-sm font-medium underline mt-2 inline-block">
                            {session.user.role === 'ADMIN' ? "Przejdź do panelu HR" : "Przejdź do profilu"}
                        </Link>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Card 1: My Status */}
                <Card className="border-l-4 border-l-indigo-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Briefcase className="h-5 w-5" /> Twój Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {myStatusToday ? (
                            <div className={`p-4 rounded-lg border ${typeColors[myStatusToday.type] || 'bg-muted border-border'}`}>
                                <p className="font-semibold text-lg">{typeLabels[myStatusToday.type] || myStatusToday.type}</p>
                                <p className="text-sm opacity-80">Dziś pracujesz</p>
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400">
                                <p className="font-semibold text-lg">Wolne 🎉</p>
                                <p className="text-sm opacity-80">Dziś odpoczywasz</p>
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground mb-1">Następna aktywność:</p>
                            {nextShift ? (
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">
                                        {format(nextShift.date, "d MMMM (EEEE)", { locale: pl })}
                                    </span>
                                    <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground font-medium">
                                        {typeLabels[nextShift.type]?.split('(')[0] || nextShift.type}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic">Brak zaplanowanych zmian</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Card 2: Team Today */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <Users className="h-5 w-5" /> Kto dziś pracuje?
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {todaySchedule.length > 0 ? (
                            <div className="space-y-3">
                                {todaySchedule.map(shift => (
                                    <div key={shift.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                                                {(shift.user.name || shift.user.username).substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {shift.user.name || shift.user.username}
                                                </span>
                                                <span className="text-xs text-muted-foreground md:hidden lg:inline-block">
                                                    {typeLabels[shift.type]?.split('(')[0]}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded border ${typeColors[shift.type]}`}>
                                            {shift.type === 'DUTY' ? 'Dyżur' : shift.type.replace('SHIFT_', 'Zm ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground italic text-center py-4">Nikt dzisiaj nie pracuje?</p>
                        )}
                    </CardContent>
                </Card>

                {/* Card 3: Stats */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center gap-2">
                            <FileText className="h-5 w-5" /> Twoje Podsumowanie
                        </CardTitle>
                        <CardDescription>{format(now, "LLLL yyyy", { locale: pl })}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted p-3 rounded-lg border text-center">
                                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {workStats._sum.duration || 0}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                                    Godziny
                                </p>
                            </div>
                            <div className="bg-muted p-3 rounded-lg border text-center">
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {workStats._sum.overtime || 0}
                                </p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mt-1">
                                    Nadgodziny
                                </p>
                            </div>
                        </div>

                        {session.user.role === 'ADMIN' && (
                            <div className="mt-6 pt-4 border-t dark:border-slate-800">
                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-100 dark:border-amber-800">
                                    <AlertCircle className="h-5 w-5" />
                                    <div className="text-sm">
                                        <p className="font-semibold">Panel Administratora</p>
                                        <p className="opacity-90">Zarządzaj grafikiem i urlopami</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
