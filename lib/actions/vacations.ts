"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/actions/mailer"
import { createLog } from "@/lib/actions/log-actions"
import { hasPermission } from "@/lib/auth/permissions"

function formatDatePL(date: Date | string) {
    return new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(date));
}

function normalizeDate(d: Date | string) {
    const date = new Date(d);
    const warsawDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
    const [y, m, day] = warsawDate.split('-').map(Number);
    return new Date(y, m - 1, day, 0, 0, 0, 0);
}

export async function getVacations(year: number) {
    const session = await getServerSession(authOptions)
    if (!session) return []

    const user = session.user as any
    const role = user.role
    const deptId = user.departmentId ? parseInt(user.departmentId.toString()) : null
    const secDeptId = user.secondaryDepartmentId ? parseInt(user.secondaryDepartmentId.toString()) : null

    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    const where: any = {
        startDate: { gte: startDate },
        endDate: { lte: endDate }
    }

    const isGlobalViewer = role === 'ADMIN' || role === 'HR' || role === 'SZEF' || hasPermission(session.user as any, "view_all_schedules");

    if (isGlobalViewer) {
        // Global viewers see all
    } else if (role === 'MANAGER') {
        const allowedDepts = []
        if (deptId) allowedDepts.push(deptId)
        if (secDeptId) allowedDepts.push(secDeptId)
        
        where.OR = [
            { userId: parseInt(user.id) },
            { user: { departmentId: { in: allowedDepts } } },
            { user: { secondaryDepartmentId: { in: allowedDepts } } }
        ]
    } else {
        // Standard user sees only self
        where.userId = parseInt(user.id)
    }

    return await prisma.vacation.findMany({
        where,
        include: { user: true },
        orderBy: { startDate: "asc" }
    })
}

import { getVacationStats } from "./hr"
import { getBusinessDaysCount } from "../holidays"

async function validateVacationLimit(userId: number, startDate: Date, endDate: Date, type: string, excludeVacationId?: number) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const year = start.getFullYear()

    if (start.getFullYear() !== end.getFullYear()) {
        return { valid: false, error: "Wniosek nie może przekraczać roku kalendarzowego. Złóż dwa osobne wnioski." }
    }

    // "Okolicznościowy" - bez limitu
    if (type === 'SPECIAL_LEAVE') {
        return { valid: true }
    }

    const daysRequested = getBusinessDaysCount(start, end)
    const stats = await getVacationStats(userId, year)

    const getPendingDays = async (types: string[]) => {
        const pended = await prisma.vacation.findMany({
            where: {
                userId: userId,
                type: { in: types },
                status: "PENDING",
                startDate: { gte: new Date(year, 0, 1) },
                endDate: { lte: new Date(year, 11, 31) },
                ...(excludeVacationId ? { id: { not: excludeVacationId } } : {})
            }
        })
        return pended.reduce((acc, vac) => acc + getBusinessDaysCount(new Date(vac.startDate), new Date(vac.endDate)), 0)
    }

    const pendingSameType = await getPendingDays([type])
    const pendingPoolType = await getPendingDays(['VACATION', 'ON_DEMAND'])

    if (type === 'CHILDCARE') {
        if (stats.childcareLimit === 0) {
            return { valid: false, error: "Nie przysługuje Ci prawo do zwolnienia z tytułu opieki nad dzieckiem." }
        }
        const totalNeeded = stats.childcareUsed + pendingSameType + daysRequested
        if (totalNeeded > stats.childcareLimit) {
            return { valid: false, error: `Przekroczono limit opieki nad dzieckiem. Dostępne dni: ${Math.max(0, stats.childcareLimit - stats.childcareUsed - pendingSameType)}, Wnioskowane: ${daysRequested}.` }
        }
    } else if (type === 'ON_DEMAND') {
        const onDemandUsed = stats.details.onDemandUsed || 0
        const totalOnDemand = onDemandUsed + pendingSameType + daysRequested
        if (totalOnDemand > 4) {
            return { valid: false, error: `Możesz wziąć maksymalnie 4 dni urlopu na żądanie w roku. Dotychczas wykorzystano: ${onDemandUsed}, Wnioskowane: ${daysRequested}.` }
        }
        // Still needs to check if they have enough regular vacation days left
        const totalVacationNeeded = stats.used + pendingPoolType + daysRequested
        if (totalVacationNeeded > stats.limit) {
            return {
                valid: false,
                error: `Wykorzystano limit urlopowy. Przewidywane użycie (w tym na żądanie): ${totalVacationNeeded} dni, Limit: ${stats.limit} dni.`
            }
        }
    } else if (type === 'ADDITIONAL') {
        const additionalUsed = stats.details.additionalUsed || 0
        const totalNeeded = additionalUsed + pendingSameType + daysRequested
        if (totalNeeded > stats.details.additional) {
            return { valid: false, error: `Przekroczono limit dodatkowego urlopu. Dostępne dni: ${Math.max(0, stats.details.additional - additionalUsed - pendingSameType)}, Wnioskowane: ${daysRequested}.` }
        }
    } else if (type === 'OVERTIME') {
        const requestedHours = daysRequested * 8
        const pendingHours = pendingSameType * 8
        const totalNeededHours = requestedHours + pendingHours

        if (totalNeededHours > stats.overtimeHours) {
            return { valid: false, error: `Niewystarczająca liczba nadgodzin do odbioru. Dostępne godziny: ${Math.max(0, stats.overtimeHours - pendingHours)}, Wnioskowane dni wymagają: ${requestedHours}h.` }
        }
    } else if (type === 'VACATION') {
        const totalNeeded = stats.used + pendingPoolType + daysRequested
        if (totalNeeded > stats.limit) {
            return {
                valid: false,
                error: `Wykorzystano limit urlopowy. Przewidywane użycie: ${totalNeeded} dni, Limit: ${stats.limit} dni.`
            }
        }
    }

    return { valid: true }
}

export async function createVacation(data: any) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    const { userId, startDate, endDate, type, note, applicationDate } = data
    const isAdmin = session.user.role === 'ADMIN' || hasPermission(session.user as any, "manage_vacations")
    const isSelf = parseInt(session.user.id) === parseInt(userId)
    const isManagerSelf = isSelf && session.user.role === 'MANAGER'

    const canAutoApprove = isSelf && hasPermission(session.user as any, "auto_approve_own_vacations")

    if (!isAdmin && !isSelf) return { error: "Możesz składać wnioski tylko za siebie." }

    if (type === 'SICK' && !isAdmin && session.user.role !== 'MANAGER') {
        return { error: "Zwolnienie lekarskie może zostać wprowadzone tylko przez dział HR lub kierownika." }
    }

    // Jeśli type="SICK" lub isManagerSelf lub canAutoApprove to z automatu od razu wbijamy jako "APPROVED"
    const approved = isAdmin || type === 'SICK' || isManagerSelf || canAutoApprove
    const status = approved ? "APPROVED" : "PENDING"

    const validation = await validateVacationLimit(parseInt(userId), new Date(startDate), new Date(endDate), type || "VACATION")
    if (!validation.valid) {
        return { error: validation.error }
    }

    try {
        let finalVacation: any = null;

        await prisma.$transaction(async (tx) => {
            // 1. Create Vacation Record
            const vacation = await tx.vacation.create({
                data: {
                    userId: parseInt(userId),
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    type: type || "VACATION",
                    status: status,
                    note: note || null,
                    createdAt: applicationDate ? new Date(applicationDate) : undefined
                },
            })
            finalVacation = vacation;

            // 2. Sync with ScheduleDay ONLY IF APPROVED
            if (approved) {
                const start = normalizeDate(startDate)
                const end = normalizeDate(endDate)
                const vacationType = type || "VACATION"

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    // Pomiń weekendy - nie liczymy ich jako dni urlopowe
                    if (d.getDay() === 0 || d.getDay() === 6) continue

                    const year = d.getFullYear()
                    const month = d.getMonth()
                    const day = d.getDate()
                    const startOfDay = new Date(year, month, day, 0, 0, 0)
                    const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

                    await tx.scheduleDay.deleteMany({
                         where: {
                              userId: parseInt(userId),
                              date: { gte: startOfDay, lte: endOfDay }
                         }
                    })

                    await tx.scheduleDay.create({
                         data: {
                              userId: parseInt(userId),
                              date: new Date(year, month, day),
                              type: vacationType,
                              vacationId: vacation.id
                         }
                    })
                }
            }
        })

        // Wysyłka emaila akceptacyjnego
        if ((isManagerSelf || canAutoApprove) && approved) {
            const user = await prisma.user.findUnique({
                where: { id: parseInt(userId) },
                include: { department: true }
            })
            if (user && user.email) {
                const start = normalizeDate(startDate)
                const end = normalizeDate(endDate)
                const businessDaysCount = getBusinessDaysCount(start, end)
                const docBuffer = await import("@/lib/docs/vacation-document").then(m => m.generateVacationDoc(finalVacation, user, businessDaysCount)).catch(e => { console.error("Doc gen failed", e); return null; })
                const attachments = docBuffer ? [{ filename: 'wniosek-o-urlop.docx', content: docBuffer }] : []

                const mailHtml = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2 style="color: #10b981;">Twój automatyczny wniosek urlopowy został zatwierdzony!</h2>
                    <p>${isManagerSelf ? 'Z racji funkcji Menedżera, wniosek systemowo przybrał status Zatwierdzony.' : 'Z racji przyznanego uprawnienia systemowo zatwierdzono wniosek i zapisano w grafiku.'}</p>
                    <p>Termin: od ${formatDatePL(startDate)} do ${formatDatePL(endDate)}</p>
                    <p>W załączniku znajduje się wygenerowany docx ze złożonym wnioskiem (właśnie trafił do archiwum miesiąca).</p>
                    <p>Dni urlopowe zostały automatycznie wprowadzone w siatkę grafiku.</p>
                </div>
                `
                await sendEmail(user.email, "Zatwierdzony wniosek urlopowy", mailHtml, attachments).catch(console.error)
            }
        } else if (!isAdmin) {
            const user = await prisma.user.findUnique({
                where: { id: parseInt(userId) },
                include: { department: true }
            })

            if (user) {
                const isStandardLeave = type === "VACATION" || type === "ON_DEMAND"
                let targetRecipient: any = null

                let targetRecipients: any[] = []
                if (isStandardLeave && (user.departmentId || user.secondaryDepartmentId)) {
                    // Route to Dept Manager
                    const conditions = []
                    if (user.departmentId) {
                        conditions.push({ departmentId: user.departmentId })
                        conditions.push({ secondaryDepartmentId: user.departmentId })
                    }
                    if (user.secondaryDepartmentId) {
                        conditions.push({ departmentId: user.secondaryDepartmentId })
                        conditions.push({ secondaryDepartmentId: user.secondaryDepartmentId })
                    }
                    if (conditions.length > 0) {
                        targetRecipients = await prisma.user.findMany({
                            where: { role: "MANAGER", OR: conditions }
                        })
                    }
                } else if (!isStandardLeave) {
                    // Route to HR Manager
                    const hrManager = await prisma.user.findFirst({
                        where: {
                            permissions: {
                                some: { permission: { slug: "manage_hr_data" } }
                            }
                        }
                    })
                    if (hrManager) targetRecipients = [hrManager]
                }


                const mailHtml = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Nowy wniosek urlopowy oczekuje!</h2>
                    <p>Pracownik <b>${user.name || user.username}</b> złożył nowy wniosek (typ: ${type || 'VACATION'}).</p>
                    <p>Termin: od ${formatDatePL(startDate)} do ${formatDatePL(endDate)}</p>
                    <p>Zaloguj się do systemu HR4YOU, by zatwierdzić lub odrzucić.</p>
                </div>
                `
                for (const recipient of targetRecipients) {
                    if (recipient.email) {
                        await sendEmail(recipient.email, "Nowy wniosek urlopowy do akceptacji", mailHtml).catch(e => console.error("Email failed", e))
                    }
                }
            }
        }
        await createLog({
            action: "VACATION_REQUESTED",
            description: `Wniosek urlopowy (${type || 'VACATION'}) złożony: od ${startDate} do ${endDate}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_REQUESTED",
            details: { targetUserId: userId, startDate, endDate, status: approved ? "APPROVED" : "PENDING" }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true, approved }
    } catch (error) {
        console.error("Error creating vacation:", error)
        return { error: "Błąd podczas dodawania urlopu." }
    }
}

export async function approveVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER' && !hasPermission(session.user as any, "manage_vacations"))) {
        return { error: "Brak uprawnień" }
    }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { 
                user: {
                    include: { department: true }
                } 
            }
        })
        if (!vacation) return { error: "Wniosek nie istnieje" }

        const isGlobalAdmin = session.user.role === 'ADMIN' || session.user.role === 'HR'

        if (session.user.role === 'MANAGER' && !isGlobalAdmin) {
            // managers can approve standard leaves for their dept 
            // backend isolating this to prevent them approving HR stuff
            if (vacation.type !== 'VACATION' && vacation.type !== 'ON_DEMAND') {
                return { error: 'Tylko dział HR może akceptować tego typu wnioski.' }
            }

            const sessionDeptId = session.user.departmentId;
            const sessionSecDeptId = (session.user as any).secondaryDepartmentId;
            const vacDeptId = vacation.user.departmentId;
            const vacSecDeptId = vacation.user.secondaryDepartmentId;

            if (
                vacDeptId !== sessionDeptId &&
                vacDeptId !== sessionSecDeptId &&
                vacSecDeptId !== sessionDeptId &&
                vacSecDeptId !== sessionSecDeptId
            ) {
                return { error: "Możesz akceptować urlopy tylko we własnym dziale." }
            }
        }

        const validation = await validateVacationLimit(vacation.userId, new Date(vacation.startDate), new Date(vacation.endDate), vacation.type, vacation.id)
        if (!validation.valid) {
            return { error: "Zatwierdzenie zablokowane: " + validation.error }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Approve
            await tx.vacation.update({
                where: { id },
                data: { status: "APPROVED" }
            })

            // 2. Sync
            const start = normalizeDate(vacation.startDate)
            const end = normalizeDate(vacation.endDate)
            const vacationType = vacation.type

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                // Pomiń weekendy - nie liczymy ich jako dni urlopowe
                if (d.getDay() === 0 || d.getDay() === 6) continue

                const year = d.getFullYear()
                const month = d.getMonth()
                const day = d.getDate()
                const startOfDay = new Date(year, month, day, 0, 0, 0)
                const endOfDay = new Date(year, month, day, 23, 59, 59, 999)

                await tx.scheduleDay.deleteMany({
                     where: {
                          userId: vacation.userId,
                          date: { gte: startOfDay, lte: endOfDay }
                     }
                })

                await tx.scheduleDay.create({
                     data: {
                          userId: vacation.userId,
                          date: new Date(year, month, day),
                          type: vacationType,
                          vacationId: vacation.id
                     }
                })
            }
        })

        if (vacation.user.email) {
            const businessDaysCount = getBusinessDaysCount(new Date(vacation.startDate), new Date(vacation.endDate))
            const docBuffer = await import("@/lib/docs/vacation-document").then(m => m.generateVacationDoc(vacation, vacation.user, businessDaysCount)).catch(e => { console.error("Doc generation failed", e); return null; })
            const attachments = docBuffer ? [{ filename: 'wniosek-o-urlop.docx', content: docBuffer }] : []
            
            const mailHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #10b981;">Twój wniosek urlopowy został zatwierdzony!</h2>
                <p>Termin: od ${formatDatePL(vacation.startDate)} do ${formatDatePL(vacation.endDate)}</p>
                <p>W załączniku znajduje się wygenerowany wniosek urlopowy gotowy do ewentualnego wydruku.</p>
                <p>Możesz już zobaczyć zmiany w grafiku systemu.</p>
            </div>
            `
            await sendEmail(vacation.user.email, "Wniosek urlopowy zaakceptowany", mailHtml, attachments).catch(e => console.error(e))
        }

        // Jeśli to nietypowy urlop akceptowany przez HR, zawiadom managera dzialu
        if (vacation.type !== 'VACATION' && vacation.type !== 'ON_DEMAND' && (vacation.user.departmentId || vacation.user.secondaryDepartmentId)) {
            const conditions = []
            if (vacation.user.departmentId) {
                conditions.push({ departmentId: vacation.user.departmentId })
                conditions.push({ secondaryDepartmentId: vacation.user.departmentId })
            }
            if (vacation.user.secondaryDepartmentId) {
                conditions.push({ departmentId: vacation.user.secondaryDepartmentId })
                conditions.push({ secondaryDepartmentId: vacation.user.secondaryDepartmentId })
            }
            if (conditions.length > 0) {
                const managers = await prisma.user.findMany({
                    where: { role: "MANAGER", OR: conditions }
                })
                
                const managerHtml = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Informacja z Działu HR</h2>
                    <p>Zatwierdzono systemowo wniosek urlopowy dla pracownika <b>${vacation.user.name || vacation.user.username}</b>.</p>
                    <p>Typ: <b>${vacation.type}</b></p>
                    <p>Termin: od ${formatDatePL(vacation.startDate)} do ${formatDatePL(vacation.endDate)}</p>
                    <p>Dni zostały już oznaczone w grafiku.</p>
                </div>
                `
                for (const manager of managers) {
                    if (manager.email) {
                        await sendEmail(manager.email, "Zatwierdzono urlop pozastandardowy pracownika", managerHtml).catch(e => console.error(e))
                    }
                }
            }
        }

        await createLog({
            action: "VACATION_APPROVED",
            description: `Zatwierdzono urlop (ID: ${vacation.id}) dla pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_APPROVED",
            details: { vacationId: id, targetUserId: vacation.userId }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (error) {
        return { error: "Błąd zatwierdzania wniosku" }
    }
}

import { format } from "date-fns" // Dodałem dla approve emaila

export async function cancelVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!vacation) return { error: "Wniosek nie istnieje" }

        const isAdmin = session.user.role === 'ADMIN' || hasPermission(session.user as any, "manage_vacations")
        const isSelf = parseInt(session.user.id) === vacation.userId
        
        // Users can cancel their own PENDING or APPROVED vacations.
        // Managers/Admins can cancel any vacation from their department.
        if (!isAdmin && !isSelf) {
            // Check if it's manager's employee
            const isManager = session.user.role === 'MANAGER'
            const sessionDeptId = session.user.departmentId;
            const sessionSecDeptId = (session.user as any).secondaryDepartmentId;
            const vacDeptId = vacation.user.departmentId;
            const vacSecDeptId = vacation.user.secondaryDepartmentId;
            
            const isManagersEmployee = isManager && (
                vacDeptId === sessionDeptId ||
                vacDeptId === sessionSecDeptId ||
                (vacSecDeptId != null && (vacSecDeptId === sessionDeptId || vacSecDeptId === sessionSecDeptId))
            )
            
            const isGlobalAdmin = session.user.role === 'ADMIN' || session.user.role === 'HR'

            if (!isManagersEmployee && !isGlobalAdmin) return { error: "Brak uprawnień" }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Update Status
            await tx.vacation.update({
                where: { id },
                data: { status: "CANCELLED" }
            })

            // 2. Remove from Schedule
            await tx.scheduleDay.updateMany({
                where: { vacationId: id },
                data: { type: "OFF", vacationId: null }
            })
        })

        // 3. Notify Manager
        try {
            const user = await prisma.user.findUnique({
                where: { id: vacation.userId },
                include: { department: true }
            })
            
            if (user) {
                // Find managers to notify
                const conditions = []
                if (user.departmentId) {
                    conditions.push({ departmentId: user.departmentId })
                    conditions.push({ secondaryDepartmentId: user.departmentId })
                }
                if (user.secondaryDepartmentId) {
                    conditions.push({ departmentId: user.secondaryDepartmentId })
                    conditions.push({ secondaryDepartmentId: user.secondaryDepartmentId })
                }
                
                const managers = await prisma.user.findMany({
                    where: { role: "MANAGER", OR: conditions }
                })

                const adminEmail = process.env.ADMIN_EMAIL
                const managerEmails = managers.map(m => m.email).filter(Boolean) as string[]
                
                const mailHtml = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2 style="color: #f59e0b;">Zrezygnowano z urlopu / Anulowano wniosek</h2>
                    <p>Pracownik: <b>${user.name || user.username}</b></p>
                    <p>Termin: od ${formatDatePL(vacation.startDate)} do ${formatDatePL(vacation.endDate)}</p>
                    <p>Typ: ${vacation.type}</p>
                    <p>Status został zmieniony na <b>ANULOWANY</b>. Dni (jeśli były zatwierdzone) zostały zwrócone do puli i usunięte z grafiku.</p>
                </div>
                `
                
                for (const email of managerEmails) {
                    await sendEmail(email, `Anulowano urlop: ${user.name || user.username}`, mailHtml)
                }
                
                // If cancelled by someone ELSE (Manager/Admin), notify the user too
                if (parseInt(session.user.id) !== vacation.userId && user.email) {
                    const userMailHtml = `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2 style="color: #f59e0b;">Twój wniosek urlopowy został anulowany przez przełożonego</h2>
                        <p>Termin: od ${formatDatePL(vacation.startDate)} do ${formatDatePL(vacation.endDate)}</p>
                        <p>Jeśli masz pytania, skontaktuj się ze swoim kierownikiem.</p>
                    </div>
                    `
                    await sendEmail(user.email, "Twój urlop został anulowany", userMailHtml)
                }
            }
        } catch (mailErr) {
            console.error("Migration/Notification error in cancelVacation:", mailErr)
        }

        await createLog({
            action: "VACATION_CANCELLED",
            description: `Anulowano urlop (ID: ${vacation.id}) dla pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_CANCELLED",
            details: { vacationId: id, targetUserId: vacation.userId }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        return { error: "Błąd podczas anulowania wniosku." }
    }
}

export async function rejectVacation(id: number, reason: string) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER' && !hasPermission(session.user as any, "manage_vacations"))) {
        return { error: "Brak uprawnień" }
    }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!vacation) return { error: "Wniosek nie istnieje" }

        const sessionDeptId = session.user.departmentId;
        const sessionSecDeptId = (session.user as any).secondaryDepartmentId;
        const vacDeptId = vacation.user.departmentId;
        const vacSecDeptId = vacation.user.secondaryDepartmentId;

        const isGlobalAdmin = session.user.role === 'ADMIN' || session.user.role === 'HR'
        
        if (session.user.role === 'MANAGER' && !isGlobalAdmin) {
            if (
                vacDeptId !== sessionDeptId &&
                vacDeptId !== sessionSecDeptId &&
                vacSecDeptId !== sessionDeptId &&
                vacSecDeptId !== sessionSecDeptId
            ) {
                return { error: "Brak dostępu do pracownika z innego działu" }
            }
        }

        await prisma.vacation.update({
            where: { id },
            data: {
                status: "REJECTED",
                rejectReason: reason
            }
        })

        if (vacation.user.email) {
            const mailHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #ef4444;">Twój wniosek urlopowy został odrzucony</h2>
                <p>Termin: od ${formatDatePL(vacation.startDate)} do ${formatDatePL(vacation.endDate)}</p>
                <p><b>Powód odrzucenia:</b></p>
                <blockquote style="border-left: 4px solid #ef4444; padding-left: 10px; font-style: italic;">
                    ${reason}
                </blockquote>
                <p>Jeśli masz pytania, skontaktuj się ze swoim kierownikiem.</p>
            </div>
            `
            await sendEmail(vacation.user.email, "Odrzucenie wniosku urlopowego", mailHtml).catch(e => console.error(e))
        }
        await createLog({
            action: "VACATION_REJECTED",
            description: `Odrzucono urlop (ID: ${vacation.id}) dla pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_REJECTED",
            details: { vacationId: id, targetUserId: vacation.userId, reason }
        });

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        return { error: "Błąd z zapisem odrzucenia wniosku." }
    }
}

export async function deleteVacation(id: number) {
    const session = await getServerSession(authOptions)
    if (!session) return { error: "Brak dostępu" }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!vacation) return { error: "Wniosek nie istnieje" }

        const isAdmin = session.user.role === 'ADMIN' || hasPermission(session.user as any, "manage_vacations")
        const isSelf = parseInt(session.user.id) === vacation.userId

        // Normal user can only delete CANCELLED or REJECTED requests of their own.
        // HR / Admin can delete any request.
        if (!isAdmin) {
            if (!isSelf) return { error: "Możesz usuwać tylko własne wnioski." }
            if (vacation.status !== 'CANCELLED' && vacation.status !== 'REJECTED') {
                return { error: "Zwykły użytkownik może usunąć tylko anulowany lub odrzucony wniosek." }
            }
        }

        await prisma.$transaction(async (tx) => {
            // First remove schedule days associated with it
            await tx.scheduleDay.deleteMany({
                where: { vacationId: id }
            })

            // Then delete the vacation
            await tx.vacation.delete({
                where: { id }
            })
        })

        await createLog({
            action: "VACATION_DELETED",
            description: `Usunięto urlop (ID: ${vacation.id}) pracownika ${vacation.user.username}`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_DELETED",
            details: { vacationId: id, targetUserId: vacation.userId }
        });

        revalidatePath("/dashboard/schedule")
        revalidatePath("/dashboard/leave")
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd podczas usuwania wniosku." }
    }
}

export async function editVacation(id: number, startDate: Date, endDate: Date, type?: string, note?: string) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER' && !hasPermission(session.user as any, "manage_vacations"))) {
        return { error: "Brak uprawnień do edycji" }
    }

    try {
        const vacation = await prisma.vacation.findUnique({
            where: { id }
        })

        if (!vacation) return { error: "Wniosek nie istnieje" }

        if (startDate > endDate) {
            return { error: "Data początkowa nie może być późniejsza niż końcowa" }
        }

        const newType = type || vacation.type

        await prisma.$transaction(async (tx) => {
            // Update the vacation dates, type, and note
            const updatedVacation = await tx.vacation.update({
                where: { id },
                data: {
                    startDate,
                    endDate,
                    type: newType,
                    ...(note !== undefined ? { note } : {})
                }
            })

            // Update schedule days if the vacation was approved or if we want to sync it.
            // If the status is APPROVED, we must rebuild the schedule days.
            if (updatedVacation.status === 'APPROVED') {
                await tx.scheduleDay.deleteMany({
                    where: { vacationId: id }
                })

                const start = normalizeDate(startDate)
                const end = normalizeDate(endDate)

                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    if (d.getDay() === 0 || d.getDay() === 6) continue;

                    const year = d.getFullYear();
                    const month = d.getMonth();
                    const day = d.getDate();
                    
                    await tx.scheduleDay.deleteMany({
                        where: {
                            userId: vacation.userId,
                            date: { gte: new Date(year, month, day, 0, 0, 0), lte: new Date(year, month, day, 23, 59, 59, 999) }
                        }
                    })

                    await tx.scheduleDay.create({
                        data: {
                            userId: vacation.userId,
                            date: new Date(year, month, day),
                            type: newType,
                            vacationId: vacation.id
                        }
                    })
                }
            }
        })

        await createLog({
            action: "VACATION_EDITED",
            description: `Edytowano urlop (ID: ${id})`,
            userId: parseInt(session.user.id),
            errorCodeKey: "VACATION_EDITED",
            details: { vacationId: id, startDate, endDate, type: newType }
        });

        revalidatePath("/dashboard/schedule")
        revalidatePath("/dashboard/leave")
        revalidatePath("/dashboard/profile")
        return { success: true }
    } catch (e) {
        return { error: "Błąd podczas edycji wniosku." }
    }
}
