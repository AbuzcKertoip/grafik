"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { Document, Packer } from "docx"
import { getVacationDocumentChildren } from "@/lib/docs/vacation-document"
import { getBusinessDaysCount } from "@/lib/holidays"

export async function generateMonthlyVacationReportDoc(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR', 'MANAGER'].includes(session.user.role as string)) {
        return { error: "Brak uprawnień" }
    }

    const { role, departmentId } = session.user;

    // Permissions check logic (similar to HR Page)
    let isManagerInHR = false;
    if (role === 'MANAGER' && departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            isManagerInHR = true;
        }
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const whereClause: any = {
        status: "APPROVED",
        // Chcemy wychwycić wszystkie urlopy, które zaczynają się lub trwają w danym miesiącu
        startDate: { lte: endDate },
        endDate: { gte: startDate }
    };

    if (role === 'MANAGER' && !isManagerInHR) {
        const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;
        const deptIds = [];
        
        if (departmentId) deptIds.push(parseInt(departmentId.toString()));
        if (secondaryDepartmentId) deptIds.push(parseInt(secondaryDepartmentId.toString()));
        
        if (deptIds.length > 0) {
            whereClause.user = {
                OR: [
                    { departmentId: { in: deptIds } },
                    { secondaryDepartmentId: { in: deptIds } }
                ]
            };
        } else {
            whereClause.userId = parseInt(session.user.id);
        }
    }

    const vacations = await prisma.vacation.findMany({
        where: whereClause,
        include: { user: { include: { department: true } } },
        orderBy: { startDate: 'asc' }
    });

    if (vacations.length === 0) {
        return { error: "Brak zatwierdzonych wniosków w wybranym miesiącu." }
    }

    // Build massive unified document
    const sections = vacations.map(vacation => {
        const totalDays = getBusinessDaysCount(new Date(vacation.startDate), new Date(vacation.endDate));
        return {
            properties: {}, // Each section becomes a new page by default in docx if it's the root of sections array
            children: getVacationDocumentChildren(vacation, vacation.user, totalDays)
        };
    });

    const doc = new Document({
        creator: "System HR4YOU",
        title: `Zbiorcze Wnioski Urlopowe - ${month}/${year}`,
        description: `Wnioski urlopowe na miesiąc ${month}/${year}`,
        sections: sections
    });

    const buffer = await Packer.toBuffer(doc);
    return { success: true, fileBase64: buffer.toString('base64'), count: vacations.length };
}
