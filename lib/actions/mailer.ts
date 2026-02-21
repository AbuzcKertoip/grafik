import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

export async function getTransporter() {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } })

    if (!settings || !settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
        throw new Error("Konfiguracja poczty SMTP nie jest kompletna. Odszukaj zakładkę 'Ustawienia Systemu' w panelu Administratora.")
    }

    const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure, // true for 465, false for other ports
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword,
        },
    })

    return { transporter, settings }
}

export async function sendEmail(to: string, subject: string, htmlContent: string) {
    const { transporter, settings } = await getTransporter()

    const mailOptions = {
        from: `"${settings.smtpFromEmail?.split('@')[0] || 'System'}" <${settings.smtpFromEmail || settings.smtpUser}>`,
        to,
        subject,
        html: htmlContent,
    }

    try {
        const info = await transporter.sendMail(mailOptions)

        // Log success
        await prisma.emailLog.create({
            data: {
                toEmail: to,
                subject: subject,
                status: 'SUCCESS',
            }
        })

        return info
    } catch (error: any) {
        // Log failure
        await prisma.emailLog.create({
            data: {
                toEmail: to,
                subject: subject,
                status: 'FAILED',
                errorMsg: error.message || 'Unknown error'
            }
        })
        throw error
    }
}
