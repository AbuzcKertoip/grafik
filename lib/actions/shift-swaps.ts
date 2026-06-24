"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/actions/mailer"
import { createLog } from "@/lib/actions/log-actions"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

// Zwraca liste wnisokow uzytkownika (jako zglaszajacy i jako docelowy)
export async function getUserSwapRequests(userId: number) {
    const requests = await prisma.shiftSwapRequest.findMany({
        where: {
            OR: [
                { requesterId: userId },
                { targetUserId: userId }
            ]
        },
        include: {
            requester: { select: { name: true, username: true } },
            targetUser: { select: { name: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
    })
    return requests
}

// Zwraca liste wnioskow do akceptacji dla kierownika
export async function getManagerSwapRequests() {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return []

    const { role, departmentId } = session.user
    const secondaryDepartmentId = (session.user as any).secondaryDepartmentId;
    
    // Tylko kierownicy, szef i admin widza wnioski do akceptacji
    if (role === 'USER') return []

    const finalDeptId = departmentId ? parseInt(departmentId.toString()) : null
    const finalSecDeptId = secondaryDepartmentId ? parseInt(secondaryDepartmentId.toString()) : null

    // Pobierz uzytkownikow z departamentow managera
    const whereUser: any = {}
    if (role === 'MANAGER' && (finalDeptId || finalSecDeptId)) {
        const depts = []
        if (finalDeptId) depts.push(finalDeptId)
        if (finalSecDeptId) depts.push(finalSecDeptId)
        whereUser.departmentId = { in: depts }
    }

    const requests = await prisma.shiftSwapRequest.findMany({
        where: {
            status: 'PENDING_MANAGER',
            requester: whereUser // Filtruj wnioski tylko pracownikow dzialu
        },
        include: {
            requester: { select: { name: true, username: true, departmentId: true } },
            targetUser: { select: { name: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
    })

    return requests
}

export async function createSwapRequest(
    targetUserId: number,
    requesterDate: Date,
    targetUserDate: Date,
    isWeekend: boolean,
    note?: string
) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return { error: "Brak autoryzacji" }

    const requesterId = parseInt(session.user.id)
    if (requesterId === targetUserId) {
        return { error: "Nie możesz zamienić się z samym sobą." }
    }

    try {
        const request = await prisma.shiftSwapRequest.create({
            data: {
                requesterId,
                targetUserId,
                requesterDate,
                targetUserDate,
                isWeekend,
                note
            },
            include: {
                requester: { select: { name: true, username: true, email: true } },
                targetUser: { select: { name: true, username: true, email: true } }
            }
        })

        // Powiadomienie e-mail do kolegi (targetUser)
        if (request.targetUser.email) {
            const reqDateStr = format(requesterDate, 'dd.MM.yyyy')
            const tarDateStr = format(targetUserDate, 'dd.MM.yyyy')
            const title = isWeekend ? 'Wniosek o zamianę dyżuru weekendowego' : 'Wniosek o zamianę zmiany'
            
            const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                    <h2 style="color: #4f46e5;">${title}</h2>
                    <p>Cześć ${request.targetUser.name || request.targetUser.username},</p>
                    <p>Twój współpracownik <strong>${request.requester.name || request.requester.username}</strong> prosi o zamianę w grafiku.</p>
                    <ul>
                        <li>Oddaje: <strong>${reqDateStr}</strong></li>
                        <li>Proponuje zabrać: <strong>${tarDateStr}</strong></li>
                    </ul>
                    <p>Zaloguj się do systemu HR4YOU, aby zaakceptować lub odrzucić wniosek.</p>
                </div>
            `
            await sendEmail(request.targetUser.email, "HR4YOU - " + title, html).catch(console.error)
        }

        await createLog({
            action: "CREATE_SWAP_REQUEST",
            description: `Utworzono wniosek o zamianę (Z: ${requesterId} Na: ${targetUserId})`,
            userId: requesterId,
            errorCodeKey: "SWAP_REQUESTED",
        })

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Błąd podczas tworzenia wniosku" }
    }
}

export async function acceptColleagueSwap(requestId: number) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return { error: "Brak autoryzacji" }
    const userId = parseInt(session.user.id)

    try {
        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id: requestId },
            include: {
                requester: { select: { name: true, username: true, email: true, departmentId: true } },
                targetUser: { select: { name: true, username: true, email: true } }
            }
        })

        if (!request) return { error: "Wniosek nie istnieje" }
        if (request.targetUserId !== userId) return { error: "Brak uprawnień" }
        if (request.status !== 'PENDING_COLLEAGUE') return { error: "Wniosek ma nieprawidłowy status" }

        await prisma.shiftSwapRequest.update({
            where: { id: requestId },
            data: { status: 'PENDING_MANAGER' }
        })

        // Wysylanie emaila do managera
        if (request.requester.departmentId) {
            const manager = await prisma.user.findFirst({
                where: { 
                    role: 'MANAGER', 
                    OR: [
                        { departmentId: request.requester.departmentId },
                        { secondaryDepartmentId: request.requester.departmentId }
                    ]
                }
            })
            
            if (manager?.email) {
                const reqName = request.requester.name || request.requester.username
                const targetName = request.targetUser.name || request.targetUser.username
                const html = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                        <h2 style="color: #4f46e5;">Nowy wniosek o zamianę do akceptacji</h2>
                        <p>Pracownicy <strong>${reqName}</strong> oraz <strong>${targetName}</strong> zgodzili się na zamianę w grafiku.</p>
                        <p>Zaloguj się do systemu HR4YOU, aby sfinalizować (zaakceptować) lub odrzucić wniosek.</p>
                    </div>
                `
                await sendEmail(manager.email, "HR4YOU - Akceptacja zamiany w grafiku", html).catch(console.error)
            }
        }

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Błąd podczas akceptacji" }
    }
}

export async function approveManagerSwap(requestId: number) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return { error: "Brak autoryzacji" }
    const { role } = session.user
    
    if (role === 'USER') return { error: "Brak uprawnień" }

    try {
        const request = await prisma.shiftSwapRequest.findUnique({
            where: { id: requestId },
            include: {
                requester: true,
                targetUser: true
            }
        })

        if (!request) return { error: "Wniosek nie istnieje" }
        if (request.status !== 'PENDING_MANAGER') return { error: "Wniosek ma nieprawidłowy status" }

        // Finalizacja: fizyczna podmiana w grafiku (ScheduleDay)
        const daysToSwap = request.isWeekend ? 2 : 1 // Jesli weekend, to 2 dni (zakladamy ze wybrano sobote)

        await prisma.$transaction(async (tx) => {
            // Dla kazdego dnia w zamianie
            for (let i = 0; i < daysToSwap; i++) {
                const rDate = new Date(request.requesterDate)
                rDate.setDate(rDate.getDate() + i)
                
                const tDate = new Date(request.targetUserDate)
                tDate.setDate(tDate.getDate() + i)

                // Pobierz aktualne zmiany
                const reqShift = await tx.scheduleDay.findFirst({
                    where: { userId: request.requesterId, date: { gte: new Date(rDate.setHours(0,0,0,0)), lte: new Date(rDate.setHours(23,59,59,999)) } }
                })
                const targetShift = await tx.scheduleDay.findFirst({
                    where: { userId: request.targetUserId, date: { gte: new Date(tDate.setHours(0,0,0,0)), lte: new Date(tDate.setHours(23,59,59,999)) } }
                })

                const reqType = reqShift?.type || 'OFF'
                const targetType = targetShift?.type || 'OFF'

                // Usun stare
                await tx.scheduleDay.deleteMany({
                    where: {
                        OR: [
                            { userId: request.requesterId, date: { gte: new Date(rDate.setHours(0,0,0,0)), lte: new Date(rDate.setHours(23,59,59,999)) } },
                            { userId: request.targetUserId, date: { gte: new Date(tDate.setHours(0,0,0,0)), lte: new Date(tDate.setHours(23,59,59,999)) } }
                        ]
                    }
                })

                // Utworz nowe (zamienione)
                if (targetType !== 'OFF' && targetType !== '') {
                    await tx.scheduleDay.create({
                        data: { userId: request.requesterId, date: new Date(rDate.setHours(12,0,0,0)), type: targetType }
                    })
                }
                
                if (reqType !== 'OFF' && reqType !== '') {
                    await tx.scheduleDay.create({
                        data: { userId: request.targetUserId, date: new Date(tDate.setHours(12,0,0,0)), type: reqType }
                    })
                }
            }

            // Aktualizacja statusu
            await tx.shiftSwapRequest.update({
                where: { id: requestId },
                data: { status: 'APPROVED' }
            })
        })

        // Powiadomienia e-mail do obu pracownikow
        const reqName = request.requester.name || request.requester.username
        const targetName = request.targetUser.name || request.targetUser.username
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #10b981;">Zamiana zaakceptowana!</h2>
                <p>Twój wniosek o zamianę z <strong>${reqName} / ${targetName}</strong> został zatwierdzony przez przełożonego.</p>
                <p>Zmiany zostały naniesione na Wasz grafik.</p>
            </div>
        `
        if (request.requester.email) await sendEmail(request.requester.email, "HR4YOU - Zamiana zaakceptowana", html).catch(console.error)
        if (request.targetUser.email) await sendEmail(request.targetUser.email, "HR4YOU - Zamiana zaakceptowana", html).catch(console.error)

        await createLog({
            action: "APPROVE_SWAP_REQUEST",
            description: `Zatwierdzono zamianę (Wniosek ID: ${requestId})`,
            userId: parseInt(session.user.id),
            errorCodeKey: "SWAP_APPROVED",
        })

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Błąd podczas akceptacji" }
    }
}

export async function rejectSwap(requestId: number, reason?: string) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) return { error: "Brak autoryzacji" }
    
    try {
        const request = await prisma.shiftSwapRequest.update({
            where: { id: requestId },
            data: { 
                status: 'REJECTED',
                note: reason ? reason : undefined
            },
            include: {
                requester: { select: { email: true } },
                targetUser: { select: { email: true } }
            }
        })

        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #ef4444;">Zamiana odrzucona</h2>
                <p>Wniosek o zamianę w grafiku został odrzucony.</p>
                ${reason ? `<p><strong>Powód:</strong> ${reason}</p>` : ''}
            </div>
        `
        if (request.requester.email) await sendEmail(request.requester.email, "HR4YOU - Zamiana odrzucona", html).catch(console.error)
        if (request.targetUser.email) await sendEmail(request.targetUser.email, "HR4YOU - Zamiana odrzucona", html).catch(console.error)

        revalidatePath("/dashboard/schedule")
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: "Błąd podczas odrzucania" }
    }
}
