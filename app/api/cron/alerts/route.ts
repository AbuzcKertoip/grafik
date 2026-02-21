import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/actions/mailer"
import { addDays, format } from "date-fns"

export async function GET(request: Request) {
    // Optionally secure this endpoint with a secret key in the header
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    try {
        const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } })

        if (!settings || !settings.alertEmails || !settings.smtpHost) {
            return NextResponse.json({ success: false, message: "System poczty lub odbiorcy nie są skonfigurowani." })
        }

        const alertDays = settings.alertDaysBefore
        const targetDate = addDays(new Date(), alertDays)

        // Find expiring medical exams
        const medicalExams = await prisma.medicalExam.findMany({
            where: {
                validUntil: { lte: targetDate },
                notifiedExpiry: false // We can use this to not spam, or just send it anyway if it's a daily summary
            },
            include: { user: true }
        })

        // Find expiring cars
        const cars = await prisma.car.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    { inspectionValidUntil: { lte: targetDate } },
                    { insuranceValidUntil: { lte: targetDate } }
                ]
            }
        })

        if (medicalExams.length === 0 && cars.length === 0) {
            return NextResponse.json({ success: true, message: "Brak alertów na dziś." })
        }

        // Build HTML Report
        let htmlContent = `
            <h2>Dzienny Raport Alertów - HR4YOU</h2>
            <p>Poniżej znajduje się lista zdarzeń wymagających uwagi w ciągu najbliższych ${alertDays} dni.</p>
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
                    htmlContent += ` - Ubezpieczenie do: ${format(car.insuranceValidUntil, 'dd.MM.yyyy')}`
                }
                htmlContent += `</li>`
            })
            htmlContent += `</ul>`
        }

        htmlContent += `<br/><p><small>Wiadomość wygenerowana automatycznie przez system HR4YOU.</small></p>`

        // Send Email
        const emails = settings.alertEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
        for (const email of emails) {
            await sendEmail(email, "HR4YOU - Raport Alertów", htmlContent)
        }

        // Update last sent
        await prisma.systemSettings.update({
            where: { id: 1 },
            data: { lastAlertSent: new Date() }
        })

        return NextResponse.json({ success: true, message: "Raport wysłany pomyślnie." })

    } catch (error: any) {
        console.error("Cron Alert Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
