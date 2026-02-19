import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, Shield, AlertTriangle } from "lucide-react";

export default async function HRPage() {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'HR'].includes(session.user.role)) {
        redirect("/dashboard");
    }

    const users = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        include: {
            medicalExams: true
        }
    });

    const now = new Date();

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-foreground">Panel HR</h1>
            <p className="text-muted-foreground">Zarządzaj profilami pracowników, badaniami i urlopami.</p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map(user => {
                    const expiringCount = user.medicalExams.filter((exam: any) => {
                        const daysLeft = Math.ceil((new Date(exam.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        return daysLeft <= 30;
                    }).length;

                    return (
                        <Card key={user.id} className={`hover:shadow-md transition-shadow ${expiringCount > 0 ? 'border-red-300 bg-red-50/30' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {user.name || user.username}
                                </CardTitle>
                                {expiringCount > 0 && (
                                    <div className="flex items-center gap-1 text-red-600 animate-pulse">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                )}
                                {user.role === 'ADMIN' && expiringCount === 0 && <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500" />}
                                {user.role !== 'ADMIN' && expiringCount === 0 && <User className="h-4 w-4 text-muted-foreground" />}
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-end">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 border shadow-sm shrink-0" style={{ width: '48px', height: '48px' }}>
                                            <AvatarImage src={user.image || ""} className="object-cover h-full w-full" />
                                            <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center h-full w-full">
                                                {(user.name || user.username).substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {user.role}
                                            </p>
                                        </div>
                                    </div>
                                    {expiringCount > 0 && (
                                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                                            {expiringCount} do odnowienia
                                        </span>
                                    )}
                                </div>

                                <Button
                                    asChild
                                    className={`w-full mt-4 ${expiringCount > 0 ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                                    variant={expiringCount > 0 ? 'default' : 'outline'}
                                    size="sm"
                                >
                                    <Link href={`/dashboard/profile?userId=${user.id}`}>
                                        {expiringCount > 0 ? 'Sprawdź Badania' : 'Zobacz Profil'}
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    );
}
