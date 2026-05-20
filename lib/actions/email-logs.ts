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

    // Ograniczenie spamu: automatyczna wysyłka tylko raz na 7 dni
    if (!isManual && settings.lastAlertSent) {
        const daysSinceLastAlert = (new Date().getTime() - new Date(settings.lastAlertSent).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastAlert < 7) {
            return { success: true, message: "Pominięto, e-mail przesyłany jest automatycznie tylko raz na 7 dni." }
        }
    }

    // Find expiring medical exams (all, not just unnotified)
    const medicalExams = await prisma.medicalExam.findMany({
        where: {
            validUntil: { lte: targetDate }
        },
        include: { user: { select: { id: true, name: true, username: true, email: true } } }
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
        },
        include: {
            caretaker: {
                select: { id: true, name: true, username: true, email: true }
            }
        }
    })

    const hasAlerts = medicalExams.length > 0 || cars.length > 0

    // Build HTML Report
    let htmlContent = `
        <h2>${isManual ? "Ręczny Raport Alertów" : "Cotygodniowy Raport Alertów"} - HR4YOU</h2>
        <p>${isManual ? "Raport został wygenerowany na żądanie administratora." : "Raport wygenerowany automatycznie."}</p>
        <p>Data wygenerowania: <b>${format(new Date(), 'dd.MM.yyyy HH:mm')}</b></p>
        <p>Horyzont czasowy sprawdzenia: <b>${alertDays} dni</b> (do ${format(targetDate, 'dd.MM.yyyy')})</p>
        <hr/>
    `

    const examTypesPl: Record<string, string> = {
        SANITARY: "Badanie Sanepidowskie",
        MEDICINE_WORK: "Badanie Medycyny Pracy",
        SAFETY_TRAINING: "Szkolenie BHP",
        FIRST_AID: "Szkolenie z Pierwszej Pomocy"
    }

    if (medicalExams.length > 0) {
        htmlContent += `<h3>⚠️ Badania Lekarskie / Szkolenia (${medicalExams.length})</h3><ul>`
        medicalExams.forEach(exam => {
            const typePl = examTypesPl[exam.type] || exam.type
            const isExpired = new Date(exam.validUntil) < new Date()
            const marker = isExpired ? '🔴 PRZETERMINOWANE' : '🟡 Wygasa wkrótce'
            htmlContent += `<li><strong>${exam.user.name || exam.user.username}</strong> - ${typePl} — ważne do: ${format(exam.validUntil, 'dd.MM.yyyy')} <em>(${marker})</em></li>`
        })
        htmlContent += `</ul>`
    } else {
        htmlContent += `<h3>✅ Badania Lekarskie / Szkolenia</h3><p style="color: #16a34a;">Brak zbliżających się terminów badań lekarskich ani szkoleń w ciągu najbliższych ${alertDays} dni. Wszystko aktualne.</p>`
    }

    if (cars.length > 0) {
        htmlContent += `<h3>⚠️ Flota Pojazdów (${cars.length})</h3><ul>`
        cars.forEach(car => {
            htmlContent += `<li><strong>${car.make} ${car.model} (${car.plate})</strong>`

            if (car.inspectionValidUntil <= targetDate) {
                const isExpired = new Date(car.inspectionValidUntil) < new Date()
                htmlContent += ` - Przegląd do: ${format(car.inspectionValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴' : '🟡'}`
            }
            if (car.insuranceValidUntil <= targetDate) {
                const isExpired = new Date(car.insuranceValidUntil) < new Date()
                htmlContent += ` - OC do: ${format(car.insuranceValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴' : '🟡'}`
            }
            if (car.acValidUntil && car.acValidUntil <= targetDate) {
                const isExpired = new Date(car.acValidUntil) < new Date()
                htmlContent += ` - AC do: ${format(car.acValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴' : '🟡'}`
            }
            htmlContent += `</li>`
        })
        htmlContent += `</ul>`
    } else {
        htmlContent += `<h3>✅ Flota Pojazdów</h3><p style="color: #16a34a;">Brak zbliżających się terminów ubezpieczeń ani przeglądów w ciągu najbliższych ${alertDays} dni. Wszystko aktualne.</p>`
    }

    htmlContent += `<br/><p><small>Wiadomość wygenerowana z systemu powiadomień HR4YOU. ${hasAlerts ? '' : 'Brak zdarzeń wymagających uwagi — wszystko w porządku!'}</small></p>`

    // Send Email
    const emails = settings.alertEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
    for (const email of emails) {
        await sendEmail(email, `HR4YOU - ${hasAlerts ? 'Raport Alertów' : 'Raport tygodniowy — brak uwag'} ${isManual ? "(na żądanie)" : ""}`, htmlContent)
    }

    // ── Individual notifications: car caretakers ──
    if (cars.length > 0) {
        // Group cars by caretaker
        const carsByCaretaker = new Map<string, typeof cars>()
        for (const car of cars) {
            if (car.caretaker?.email) {
                const key = car.caretaker.email
                if (!carsByCaretaker.has(key)) {
                    carsByCaretaker.set(key, [])
                }
                carsByCaretaker.get(key)!.push(car)
            }
        }

        for (const [caretakerEmail, caretakerCars] of carsByCaretaker) {
            const caretakerName = caretakerCars[0].caretaker?.name || caretakerCars[0].caretaker?.username || ''
            let individualHtml = `
                <h2>Powiadomienie o pojeździe - HR4YOU</h2>
                <p>Witaj <strong>${caretakerName}</strong>,</p>
                <p>Pojazd(y) przypisane do Ciebie wymagają uwagi w ciągu najbliższych <strong>${alertDays} dni</strong>:</p>
                <ul>
            `
            for (const car of caretakerCars) {
                individualHtml += `<li><strong>${car.make} ${car.model} (${car.plate})</strong>`
                if (car.inspectionValidUntil <= targetDate) {
                    const isExpired = new Date(car.inspectionValidUntil) < new Date()
                    individualHtml += ` — Przegląd do: ${format(car.inspectionValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴 PRZETERMINOWANY' : '🟡 Wygasa wkrótce'}`
                }
                if (car.insuranceValidUntil <= targetDate) {
                    const isExpired = new Date(car.insuranceValidUntil) < new Date()
                    individualHtml += ` — OC do: ${format(car.insuranceValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴 PRZETERMINOWANE' : '🟡 Wygasa wkrótce'}`
                }
                if (car.acValidUntil && car.acValidUntil <= targetDate) {
                    const isExpired = new Date(car.acValidUntil) < new Date()
                    individualHtml += ` — AC do: ${format(car.acValidUntil, 'dd.MM.yyyy')} ${isExpired ? '🔴 PRZETERMINOWANE' : '🟡 Wygasa wkrótce'}`
                }
                individualHtml += `</li>`
            }
            individualHtml += `</ul>
                <p>Proszę o podjęcie odpowiednich kroków.</p>
                <p><small>Wiadomość wygenerowana automatycznie z systemu HR4YOU.</small></p>
            `
            try {
                await sendEmail(caretakerEmail, `HR4YOU - Twój pojazd wymaga uwagi`, individualHtml)
            } catch (e) {
                console.error(`Failed to send car alert to caretaker ${caretakerEmail}:`, e)
            }
        }
    }

    // ── Individual notifications: employees with expiring exams/trainings ──
    if (medicalExams.length > 0) {
        // Group exams by employee
        const examsByUser = new Map<string, typeof medicalExams>()
        for (const exam of medicalExams) {
            if (exam.user.email) {
                const key = exam.user.email
                if (!examsByUser.has(key)) {
                    examsByUser.set(key, [])
                }
                examsByUser.get(key)!.push(exam)
            }
        }

        for (const [userEmail, userExams] of examsByUser) {
            const userName = userExams[0].user.name || userExams[0].user.username
            let individualHtml = `
                <h2>Powiadomienie o badaniach/szkoleniach - HR4YOU</h2>
                <p>Witaj <strong>${userName}</strong>,</p>
                <p>Następujące badania lub szkolenia wymagają Twojej uwagi:</p>
                <ul>
            `
            for (const exam of userExams) {
                const typePl = examTypesPl[exam.type] || exam.type
                const isExpired = new Date(exam.validUntil) < new Date()
                const marker = isExpired ? '🔴 PRZETERMINOWANE' : '🟡 Wygasa wkrótce'
                individualHtml += `<li><strong>${typePl}</strong> — ważne do: ${format(exam.validUntil, 'dd.MM.yyyy')} <em>(${marker})</em></li>`
            }
            individualHtml += `</ul>
                <p>Proszę o kontakt z działem HR w celu umówienia terminu.</p>
                <p><small>Wiadomość wygenerowana automatycznie z systemu HR4YOU.</small></p>
            `
            try {
                await sendEmail(userEmail, `HR4YOU - Zbliżający się termin badań/szkoleń`, individualHtml)
            } catch (e) {
                console.error(`Failed to send exam alert to employee ${userEmail}:`, e)
            }
        }
    }

    // Update last sent (non-blocking — don't crash if DB write fails)
    try {
        await prisma.systemSettings.update({
            where: { id: 1 },
            data: { lastAlertSent: new Date() }
        })
    } catch (updateError) {
        console.error('Failed to update lastAlertSent:', updateError)
    }

    return { 
        success: true, 
        message: hasAlerts 
            ? "Raport został wygenerowany i wysłany pomyślnie na zdefiniowane skrzynki odbiorcze."
            : "Raport wysłany pomyślnie. Brak zdarzeń wymagających uwagi.",
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
