import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMedicalExams, getVacationStats, getUserVacations } from "@/lib/actions/hr";
import { MedicalExamList } from "@/components/hr/medical-exam-list";
import { VacationStats } from "@/components/hr/vacation-stats";
import { VacationHistoryTable } from "@/components/hr/vacation-history-table";
import { EquipmentList } from "@/components/hr/equipment-list";
import { ToolList } from "@/components/hr/tool-list";
import { BenefitsCard } from "@/components/hr/benefits-card";
import { ClothingSizes } from "@/components/hr/clothing-sizes";
import { ContactInfo } from "@/components/user-profile/contact-info";
import { AvatarUpload } from "@/components/user-profile/avatar-upload";
import { DirectLeaveEntry } from "@/components/hr/direct-leave-entry";
import { BossMonthlyReport } from "@/components/hr/boss-monthly-report";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User as UserIcon, Shield } from "lucide-react";

function getContractTypeLabel(contractType: string): string {
    switch (contractType) {
        case 'UOP': return 'Umowa o pracę';
        case 'UOP_PART_TIME': return 'Niepełny etat (UOP)';
        case 'B2B': return 'B2B';
        case 'UMOWA_ZLECENIE': return 'Umowa zlecenie';
        case 'UMOWA_O_DZIELO': return 'Umowa o dzieło';
        case 'INNE': return 'Inne';
        default: return contractType;
    }
}

export default async function ProfilePage({
    searchParams,
}: {
    searchParams: { userId?: string };
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    let targetUserId = parseInt(session.user.id);
    const isAdmin = session.user.role === 'ADMIN';
    const isHR = session.user.role === 'HR';
    const isManager = session.user.role === 'MANAGER';
    const isSzef = session.user.role === 'SZEF';
    let isManagerInHR = false;
    if (isManager && session.user.departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(session.user.departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            isManagerInHR = true;
        }
    }

    const canManageHR = isAdmin || isHR || isManagerInHR;

    const params = await searchParams;

    // Both HR/Admin and Managers can request a different user profile
    if ((canManageHR || isManager) && params?.userId) {
        targetUserId = parseInt(params.userId);
    }

    const user = await (prisma as any).user.findUnique({
        where: { id: targetUserId },
        include: {
            medicalExams: true,
            equipment: true,
            tools: true
        }
    });

    if (!user) {
        return <div>Nie znaleziono użytkownika</div>;
    }

    // Security check: If Manager (not in HR), ensure the targeted user is in their department
    if (isManager && !isManagerInHR && targetUserId !== parseInt(session.user.id) && user.departmentId !== session.user.departmentId) {
        redirect("/dashboard/hr"); // or show access denied
    }

    const vacationStats = await getVacationStats(targetUserId, new Date().getFullYear());
    const vacations = await getUserVacations(targetUserId);

    // Prepare sizes object
    const sizes = {
        shirt: user.shirtSize,
        pants: user.pantsSize,
        shoe: user.shoeSize,
        jacket: user.jacketSize
    };

    const isOwner = parseInt(session.user.id) === targetUserId;
    const canEditAvatar = isOwner || isAdmin;
    const canManageVacations = canManageHR || isManager;

    // Determine if this user has UOP contract
    const contractType = user.contractType || 'UOP';
    const isUOP = contractType === 'UOP' || contractType === 'UOP_PART_TIME';
    const vacationTabLabel = isUOP ? "Urlopy" : "Nieobecności";

    const canManageEquipment = canManageHR || (isManager && targetUserId !== parseInt(session.user.id) && user.departmentId === session.user.departmentId)

    return (
        <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-center text-center gap-4">
                <AvatarUpload
                    userId={targetUserId}
                    currentImage={user.image}
                    username={user.name || user.username}
                    editable={canEditAvatar}
                />

                <div className="flex flex-col items-center">
                    <h1 className="text-3xl font-bold text-foreground">{user.name || user.username}</h1>
                    <p className="text-muted-foreground flex items-center justify-center gap-2 mt-1">
                        {user.role === 'ADMIN' ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500" /> : <UserIcon className="h-4 w-4" />}
                        {user.role}
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{getContractTypeLabel(contractType)}</span>
                    </p>
                </div>
            </div>

            <Tabs defaultValue="contact" className="w-full">
                <TabsList className="flex flex-wrap h-auto w-full gap-2 mb-8 justify-center">
                    <TabsTrigger value="contact">Kontakt</TabsTrigger>
                    <TabsTrigger value="vacations">{vacationTabLabel}</TabsTrigger>
                    <TabsTrigger value="medical">Badania</TabsTrigger>
                    <TabsTrigger value="equipment">Mienie</TabsTrigger>
                    <TabsTrigger value="benefits">Benefity</TabsTrigger>
                    <TabsTrigger value="clothing">Rozmiary</TabsTrigger>
                    {(isSzef || isAdmin) && isOwner && (
                        <TabsTrigger value="reports">Zestawienia</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="contact" className="space-y-6">
                    <div className="max-w-3xl mx-auto w-full">
                        <ContactInfo
                            user={user}
                            isAdminOrOwner={isOwner || canManageHR}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="vacations" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Podsumowanie {isUOP ? "Urlopowe" : "Nieobecności"}</CardTitle>
                            {(canManageHR || isManager) && !isOwner && (
                                <DirectLeaveEntry userId={targetUserId} />
                            )}
                        </CardHeader>
                        <CardContent>
                            <VacationStats
                                userId={targetUserId}
                                isAdmin={canManageHR}
                                limit={vacationStats.limit}
                                used={vacationStats.used}
                                baseLimit={vacationStats.details.base}
                                carriedOver={vacationStats.details.carriedOver}
                                additional={vacationStats.details.additional || 0}
                                baseAdditional={vacationStats.details.baseAdditional || 0}
                                additionalUsed={vacationStats.details.additionalUsed || 0}
                                childcareUsed={vacationStats.childcareUsed ?? 0}
                                onDemandUsed={vacationStats.details.onDemandUsed ?? 0}
                                specialLeaveUsed={vacationStats.details.specialLeaveUsed ?? 0}
                                childcareLimit={vacationStats.childcareLimit ?? 0}
                                overtimeHours={vacationStats.overtimeHours || 0}
                                contractType={vacationStats.contractType}
                                has10YearsSeniority={vacationStats.has10YearsSeniority}
                                hasChildren={vacationStats.hasChildren}
                                saturdayHolidays={vacationStats.saturdayHolidays}
                            />
                        </CardContent>
                    </Card>

                    <VacationHistoryTable
                        vacations={vacations}
                        canManage={canManageVacations}
                        contractType={contractType}
                    />
                </TabsContent>

                <TabsContent value="medical" className="space-y-6">
                    <div className="max-w-3xl mx-auto w-full">
                        <MedicalExamList
                            exams={user.medicalExams}
                            userId={targetUserId}
                            isAdmin={canManageHR}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="equipment" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <EquipmentList
                            equipment={user.equipment}
                            userId={targetUserId}
                            isAdmin={canManageEquipment}
                        />
                        <ToolList
                            tools={user.tools}
                            userId={targetUserId}
                            isAdmin={canManageEquipment}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="benefits" className="space-y-6">
                    <div className="max-w-3xl mx-auto w-full">
                        <BenefitsCard
                            userId={targetUserId}
                            initialInternet={user.hasInternetPackage}
                            initialMultisport={user.hasMultisportCard}
                            initialInternetDescription={user.internetDescription}
                            initialMultisportDescription={user.multisportDescription}
                            isAdmin={canManageHR}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="clothing" className="space-y-6">
                    <div className="max-w-3xl mx-auto w-full">
                        <ClothingSizes
                            sizes={sizes}
                            userId={targetUserId}
                            isAdmin={canManageEquipment}
                        />
                    </div>
                </TabsContent>

                {(isSzef || isAdmin) && isOwner && (
                    <TabsContent value="reports" className="space-y-6">
                        <BossMonthlyReport />
                    </TabsContent>
                )}
            </Tabs>


        </div>

    );
}
