"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// We can reuse the cron logic by extracting it or just fetching the endpoint locally.
// But calling the API endpoint from server action is tricky based on domain.
// It's cleaner to abstract the logic. Let's create a shared function. 
// For now, since to keep it simple, we'll re-implement the core check, 
// or better yet, we can fetch the absolute URL if we know it, but we don't.
// So we will abstract the core logic into this file and use it in both places later if needed,
// or just implement the manual trigger here.

import { sendEmail } from "@/lib/actions/mailer"
import { addDays, format } from "date-fns"
import { createLog } from "@/lib/actions/log-actions"

export async function getEmailLogs() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Brak uprawnień")
    }

    const logs = await prisma.emailLog.findMany({
        orderBy: {
            sentAt: 'desc'
        },
        take: 50 // Limit to recent 50 logs for performance
    })

    return logs
}

export async function processAndSendExpirationAlerts(isManual: boolean = false) {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } })

    if (!settings || !settings.alertEmails || !settings.smtpHost) {
        return { success: false, message: "System poczty lub odbiorcy nie są skonfigurowani." }
    }

    const alertDays = settings.alertDaysBefore
    const targetDate = addDays(new Date(), alertDays)

    // Find expiring medical exams
    const medicalExams = await prisma.medicalExam.findMany({
        where: {
            validUntil: { lte: targetDate },
            notifiedExpiry: false
        },
        include: { user: true }
    })

    // Find expiring cars (Inspection, OC, AC)
    const cars = await prisma.car.findMany({
        where: {
            status: "ACTIVE",
            OR: [
                { inspectionValidUntil: { lte: targetDate } },
                { insuranceValidUntil: { lte: targetDate } },
                { acValidUntil: { lte: targetDate } }
            ]
        }
    })

    if (medicalExams.length === 0 && cars.length === 0) {
        return { success: true, message: isManual ? "System sprawdzony. Brak zdarzeń wymagających uwag." : "Brak alertów na dziś." }
    }

    // Build HTML Report
    let htmlContent = `
        <h2>${isManual ? "Ręczny Raport Alertów" : "Dzienny Raport Alertów"} - HR4YOU</h2>
        <p>${isManual ? "Raport został wygenerowany na żądanie administratora." : "Raport wygenerowany automatycznie."} Poniżej znajduje się lista zdarzeń wymagających uwagi w ciągu najbliższych ${alertDays} dni.</p>
    `

    const examTypesPl: Record<string, string> = {
        SANITARY: "Badanie Sanepidowskie",
        MEDICINE_WORK: "Badanie Medycyny Pracy",
        SAFETY_TRAINING: "Szkolenie BHP"
    }

    if (medicalExams.length > 0) {
        htmlContent += `<h3>Badania Lekarskie (${medicalExams.length})</h3><ul>`
        medicalExams.forEach(exam => {
            const typePl = examTypesPl[exam.type] || exam.type
            htmlContent += `<li><strong>${exam.user.name || exam.user.username}</strong> - ${typePl} wygasa: ${format(exam.validUntil, 'dd.MM.yyyy')}</li>`
        })
        htmlContent += `</ul>`
    }

    if (cars.length > 0) {
        htmlContent += `<h3>Flota Pojazdów (${cars.length})</h3><ul>`
        cars.forEach(car => {
            htmlContent += `<li><strong>${car.make} ${car.model} (${car.plate})</strong>`

            if (car.inspectionValidUntil <= targetDate) {
                htmlContent += ` - Przegląd do: ${format(car.inspectionValidUntil, 'dd.MM.yyyy')}`
            }
            if (car.insuranceValidUntil <= targetDate) {
                htmlContent += ` - OC do: ${format(car.insuranceValidUntil, 'dd.MM.yyyy')}`
            }
            if (car.acValidUntil && car.acValidUntil <= targetDate) {
                htmlContent += ` - AC do: ${format(car.acValidUntil, 'dd.MM.yyyy')}`
            }
            htmlContent += `</li>`
        })
        htmlContent += `</ul>`
    }

    htmlContent += `<br/><p><small>Wiadomość wygenerowana z systemu powiadomień HR4YOU.</small></p>`

    // Send Email
    const emails = settings.alertEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
    for (const email of emails) {
        await sendEmail(email, `HR4YOU - Raport Alertów ${isManual ? "na żądanie" : "systemowych"}`, htmlContent)
    }

    // Update last sent
    await prisma.systemSettings.update({
        where: { id: 1 },
        data: { lastAlertSent: new Date() }
    })

    return { 
        success: true, 
        message: "Raport został wygenerowany i wysłany pomyślnie na zdefiniowane skrzynki odbiorecze.",
        stats: { exams: medicalExams.length, cars: cars.length }
    }
}

export async function triggerManualAlerts() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Brak uprawnień")
    }

    try {
        const result = await processAndSendExpirationAlerts(true)
        
        if (result.success && result.stats) {
            await createLog({
                action: "MANUAL_ALERT_TRIGGERED",
                description: `Wygenerowano i wysłano ręczny raport alertów. Znaleziono: ${result.stats.exams} badań, ${result.stats.cars} pojazdów.`,
                userId: parseInt(session.user.id),
                errorCodeKey: "MANUAL_ALERT_TRIGGERED",
            });
        }
        
        return { success: result.success, message: result.message }
    } catch (error: any) {
        console.error("Manual Trigger Error:", error)
        return { success: false, error: error.message || "Błąd podczas ręcznego wyzwalania alertów." }
    }
}
