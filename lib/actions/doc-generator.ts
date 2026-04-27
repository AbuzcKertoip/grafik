"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
import { Document, Packer } from "docx"
import { getVacationDocumentChildren } from "@/lib/docs/vacation-document"
import { getBusinessDaysCount } from "@/lib/holidays"
import { sendEmail } from "@/lib/actions/mailer"
import { createLog } from "@/lib/actions/log-actions"

export async function generateMonthlyVacationReportDoc(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR', 'MANAGER', 'SZEF'].includes(session.user.role as string)) {
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

export async function approveMonthlyVacationReport(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'SZEF'].includes(session.user.role as string)) {
        return { error: "Tylko SZEF lub ADMIN może zatwierdzać zestawienia miesięczne." }
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const vacations = await prisma.vacation.findMany({
        where: {
            status: "APPROVED",
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        },
        include: { user: { include: { department: true } } },
        orderBy: { startDate: 'asc' }
    });

    if (vacations.length === 0) {
        return { error: "Brak zatwierdzonych wniosków w wybranym miesiącu." }
    }

    // Generate document WITH boss approval stamp
    const sections = vacations.map(vacation => {
        const totalDays = getBusinessDaysCount(new Date(vacation.startDate), new Date(vacation.endDate));
        return {
            properties: {},
            children: getVacationDocumentChildren(vacation, vacation.user, totalDays, true) // approvedByBoss = true
        };
    });

    const doc = new Document({
        creator: "System HR4YOU",
        title: `Zatwierdzone Wnioski Urlopowe - ${month}/${year}`,
        description: `Zatwierdzone wnioski urlopowe na miesiąc ${month}/${year}`,
        sections: sections
    });

    const buffer = await Packer.toBuffer(doc);
    const fileBase64 = buffer.toString('base64');

    // Save or update in database
    await (prisma as any).monthlyVacationReport.upsert({
        where: { year_month: { year, month } },
        create: {
            year,
            month,
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: parseInt(session.user.id),
            fileBase64,
            count: vacations.length
        },
        update: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: parseInt(session.user.id),
            fileBase64,
            count: vacations.length
        }
    });

    // Send email with attachment to HR users and Manager HR
    try {
        // Find HR role users and managers in HR department
        const hrDept = await prisma.department.findFirst({ where: { name: 'HR' } });
        const hrUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'HR' },
                    { permissions: { some: { permission: { slug: 'manage_hr_data' } } } },
                    ...(hrDept ? [{ role: 'MANAGER', departmentId: hrDept.id }] : [])
                ]
            }
        });

        const months = [
            "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
            "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
        ];

        const mailHtml = `
        <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #10b981;">Zestawienie urlopowe zatwierdzone przez zarząd</h2>
            <p>Zestawienie za <b>${months[month - 1]} ${year}</b> zostało zatwierdzone.</p>
            <p>Liczba wniosków: <b>${vacations.length}</b></p>
            <p>W załączniku znajduje się plik DOCX z zatwierdzonymi wnioskami, gotowy do druku.</p>
            <p>Dokument jest również dostępny do pobrania w Panelu HR systemu HR4YOU.</p>
        </div>
        `;

        const attachments = [{
            filename: `wnioski-urlopowe-zatwierdzone-${String(month).padStart(2, '0')}-${year}.docx`,
            content: buffer
        }];

        for (const hrUser of hrUsers) {
            if (hrUser.email) {
                await sendEmail(hrUser.email, `Zatwierdzone zestawienie urlopowe – ${months[month - 1]} ${year}`, mailHtml, attachments).catch(console.error);
            }
        }
    } catch (err) {
        console.error("Email notification failed:", err);
    }

    await createLog({
        action: "MONTHLY_REPORT_APPROVED",
        description: `Zatwierdzono zestawienie urlopowe za ${month}/${year} (${vacations.length} wniosków)`,
        userId: parseInt(session.user.id),
        errorCodeKey: "MONTHLY_REPORT_APPROVED",
        details: { year, month, count: vacations.length }
    });

    return { success: true, count: vacations.length };
}

export async function getMonthlyVacationReport(year: number, month: number) {
    const session = await getServerSession(authOptions)
    if (!session || !['ADMIN', 'HR', 'MANAGER', 'SZEF'].includes(session.user.role as string)) {
        return { error: "Brak uprawnień" }
    }

    const report = await (prisma as any).monthlyVacationReport.findUnique({
        where: { year_month: { year, month } },
        include: {
            approver: {
                select: { name: true, username: true }
            }
        }
    });

    if (!report) {
        return { status: null }
    }

    return {
        status: report.status,
        approvedAt: report.approvedAt,
        approverName: report.approver?.name || report.approver?.username || "Nieznany",
        count: report.count,
        fileBase64: report.fileBase64
    };
}
