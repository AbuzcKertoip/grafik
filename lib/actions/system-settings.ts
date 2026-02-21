"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { sendEmail } from "@/lib/actions/mailer"

export async function getSystemSettings() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Brak uprawnień")
    }

    let settings = await prisma.systemSettings.findUnique({
        where: { id: 1 }
    })

    if (!settings) {
        settings = await prisma.systemSettings.create({
            data: { id: 1 }
        })
    }

    return settings
}

export async function updateSystemSettings(data: any) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Brak uprawnień")
    }

    try {
        const updated = await prisma.systemSettings.update({
            where: { id: 1 },
            data: {
                smtpHost: data.smtpHost,
                smtpPort: data.smtpPort ? parseInt(data.smtpPort) : null,
                smtpUser: data.smtpUser,
                smtpPassword: data.smtpPassword,
                smtpFromEmail: data.smtpFromEmail,
                smtpSecure: data.smtpSecure ?? true,
                alertEmails: data.alertEmails,
                alertDaysBefore: data.alertDaysBefore ? parseInt(data.alertDaysBefore) : 30
            }
        })
        return { success: true, settings: updated }
    } catch (error: any) {
        console.error("Update settings error:", error)
        return { success: false, error: "Błąd podczas zapisu konfiguracji w bazie danych." }
    }
}

export async function testSmtpConnection(testEmailAddress: string) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        throw new Error("Brak uprawnień")
    }

    if (!testEmailAddress) {
        throw new Error("Podaj adres e-mail do testu")
    }

    try {
        await sendEmail(
            testEmailAddress,
            "Test konfiguracji SMTP - HR4YOU",
            "<h3>Witaj,</h3><p>To jest automatyczna wiadomość testowa z systemu HR4YOU.</p><p>Jeśli to czytasz, oznacza to, że konfiguracja serwera pocztowego powiodła się!</p>"
        )
        return { success: true, message: "E-mail testowy został wysłany! Sprawdź skrzynkę odbiorczą." }
    } catch (error: any) {
        console.error("SMTP Test Error:", error)
        return { success: false, error: error.message || "Błąd podczas wysyłania testowej wiadomości." }
    }
}
