import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, Shield, AlertTriangle } from "lucide-react";

import { HRUserDirectory } from "@/components/hr/hr-user-directory";
import { MonthlyVacationReport } from "@/components/hr/monthly-vacation-report";
import { BossMonthlyReport } from "@/components/hr/boss-monthly-report";

export default async function HRPage() {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'HR', 'MANAGER', 'SZEF'].includes(session.user.role as string)) {
        redirect("/dashboard");
    }

    const { role, departmentId } = session.user;
    const isSzefOrAdmin = role === 'SZEF' || role === 'ADMIN';

    const whereClause: any = { role: { not: 'ADMIN' } };

    // Krok 1: Sprawdź czy Manager należy do działu "HR"
    let isManagerInHR = false;
    if (role === 'MANAGER' && departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            isManagerInHR = true;
        }
    }

    // Managers can only see their own department's members in the HR panel
    // WYJĄTEK: Jeśli Manager należy do działu HR, widzi wszystko (tak jak admin/hr rola)
    if (role === 'MANAGER' && !isManagerInHR) {
        const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;
        const deptIds = [];
        
        if (departmentId) deptIds.push(parseInt(departmentId.toString()));
        if (secondaryDepartmentId) deptIds.push(parseInt(secondaryDepartmentId.toString()));
        
        if (deptIds.length > 0) {
            whereClause.OR = [
                { departmentId: { in: deptIds } },
                { secondaryDepartmentId: { in: deptIds } }
            ];
        } else {
            whereClause.id = parseInt(session.user.id);
        }
    }

    const users = await prisma.user.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        include: {
            medicalExams: true,
            department: true
        }
    });

    const departments = await prisma.department.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-foreground">Panel HR</h1>
            <p className="text-muted-foreground">Zarządzaj profilami pracowników, badaniami i urlopami.</p>

            {isSzefOrAdmin && (
                <BossMonthlyReport />
            )}

            <MonthlyVacationReport />

            <HRUserDirectory
                initialUsers={users}
                departments={departments}
                currentUserRole={role}
                currentUserDeptId={departmentId ? parseInt(departmentId.toString()) : null}
                isManagerInHR={isManagerInHR}
            />
        </div>
    );
}

