import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMedicalExams, getVacationStats } from "@/lib/actions/hr";
import { MedicalExamList } from "@/components/hr/medical-exam-list";
import { VacationStats } from "@/components/hr/vacation-stats";
import { EquipmentList } from "@/components/hr/equipment-list";
import { ClothingSizes } from "@/components/hr/clothing-sizes";
import { AvatarUpload } from "@/components/user-profile/avatar-upload";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User as UserIcon, Shield } from "lucide-react";

export default async function ProfilePage({
    searchParams,
}: {
    searchParams: { userId?: string };
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    let targetUserId = parseInt(session.user.id);
    const isAdmin = session.user.role === 'ADMIN';

    // Allow Admin to view other profiles
    // Awaiting searchParams as per Next.js 15 requirements (though this project seems to use 14 logic, 
    // but in previous steps we saw async searchParams usage issues, so let's treat it carefully.
    // Actually, in standard Next.js 14/15 server components, props are objects.
    // However, recent Next.js versions require awaiting searchParams if it's dynamic. 
    // Let's assume standard access for now, but handle potential promise if needed? 
    // No, standard is `searchParams: { [key: string]: string | string[] | undefined }`.
    // Wait, recent Next.js 15 changed this to a Promise. 
    // The previous error logs mentioned: "Route ... has an invalid "searchParams" prop... It must be a Promise".
    // So I MUST await it.

    // BUT, the function signature `({ searchParams }: ...)` implies it's passed as prop. 
    // In Next 15, `params` and `searchParams` are promises.
    // So I should do: `const resolvedParams = await searchParams;` if it's a promise?
    // Let's check `app/dashboard/schedule/page.tsx` from previous logs if possible, 
    // or just safeguard. The error log "Type '...' is not assignable to type 'Promise<...>'" suggests the Page props 
    // define it as Promise.
    // Let's try to await it if it's a promise, or just use it if it's not. 
    // Actually, simply typing it as `Promise<{...}>` in props and awaiting it is the way for Next 15.

    // Let's assume Next 14/15 compat:
    const params = await searchParams;

    if (isAdmin && params?.userId) {
        targetUserId = parseInt(params.userId);
    }

    const user = await (prisma as any).user.findUnique({
        where: { id: targetUserId },
        include: {
            medicalExams: true,
            equipment: true // Fetch equipment
        }
    });

    if (!user) {
        return <div>Nie znaleziono użytkownika</div>;
    }

    const vacationStats = await getVacationStats(targetUserId, new Date().getFullYear());

    // Prepare sizes object
    const sizes = {
        shirt: user.shirtSize,
        pants: user.pantsSize,
        shoe: user.shoeSize,
        jacket: user.jacketSize
    };

    const isOwner = parseInt(session.user.id) === targetUserId;
    const canEditAvatar = isOwner || isAdmin;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-6">
                <AvatarUpload
                    userId={targetUserId}
                    currentImage={user.image}
                    username={user.name || user.username}
                    editable={canEditAvatar}
                />

                <div>
                    <h1 className="text-3xl font-bold text-foreground">{user.name || user.username}</h1>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        {user.role === 'ADMIN' ? <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500" /> : <UserIcon className="h-4 w-4" />}
                        {user.role}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Urlopy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <VacationStats limit={vacationStats.limit} used={vacationStats.used} />
                        </CardContent>
                    </Card>

                    <MedicalExamList
                        exams={user.medicalExams}
                        userId={targetUserId}
                        isAdmin={isAdmin}
                    />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <EquipmentList
                        equipment={user.equipment}
                        userId={targetUserId}
                        isAdmin={isAdmin}
                    />
                    <ClothingSizes
                        sizes={sizes}
                        userId={targetUserId}
                        isAdmin={isAdmin}
                    />
                </div>
            </div>


        </div>

    );
}
