import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, Shield, AlertTriangle } from "lucide-react";

export default async function HRPage() {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
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
            <h1 className="text-3xl font-bold text-gray-900">Panel HR</h1>
            <p className="text-gray-500">Zarządzaj profilami pracowników, badaniami i urlopami.</p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map(user => {
                    const expiringCount = user.medicalExams.filter((exam: any) => {
                        const daysLeft = Math.ceil((new Date(exam.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        return daysLeft <= 30;
                    }).length;

                    return (
                        <Card key={user.id} className={`hover:shadow-md transition-shadow ${expiringCount > 0 ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {user.name || user.username}
                                </CardTitle>
                                {expiringCount > 0 && (
                                    <div className="flex items-center gap-1 text-amber-600 animate-pulse">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                )}
                                {user.role === 'ADMIN' && expiringCount === 0 && <Shield className="h-4 w-4 text-amber-600" />}
                                {user.role !== 'ADMIN' && expiringCount === 0 && <User className="h-4 w-4 text-gray-500" />}
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-2xl font-bold">
                                            {(user.name || user.username).substring(0, 2).toUpperCase()}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {user.role}
                                        </p>
                                    </div>
                                    {expiringCount > 0 && (
                                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
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
