"use server"

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/actions/mailer"
import { hashPassword } from "@/lib/password"
import crypto from "crypto"

export async function generateMathCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const expected = a + b;
    const timestamp = Date.now();
    const secret = process.env.NEXTAUTH_SECRET || "fallback_secret_for_captcha";
    
    const token = crypto.createHmac('sha256', secret)
        .update(`${expected}:${timestamp}`)
        .digest('hex');
    
    return {
        question: `Udowodnij, że nie jesteś robotem: Ile to jest ${a} + ${b}?`,
        hash: `${timestamp}:${token}`
    };
}

export async function requestPasswordReset(email: string, captchaAnswer?: string, captchaHash?: string) {
    if (!email) return { error: "Wprowadź adres e-mail" }
    if (!captchaAnswer || !captchaHash) return { error: "Wprowadź odpowiedź zabezpieczającą (Captcha)." }
    
    const split = captchaHash.split(':');
    if (split.length !== 2) return { error: "Nieprawidłowy token zabezpieczający." }
    const [timestampStr, captchaToken] = split;
    
    if (Date.now() - Number(timestampStr) > 10 * 60 * 1000) {
        return { error: "Czas na rozwiązanie Captchy minął. Odśwież stronę." }
    }
    
    const secret = process.env.NEXTAUTH_SECRET || "fallback_secret_for_captcha";
    const expectedToken = crypto.createHmac('sha256', secret).update(`${captchaAnswer.trim()}:${timestampStr}`).digest('hex');
    
    if (expectedToken !== captchaToken) {
        return { error: "Nieprawidłowa odpowiedź zabezpieczająca (Captcha)." }
    }

    const recentTokens = await prisma.passwordResetToken.findMany({
        where: { 
            email: email.toLowerCase(),
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { createdAt: 'desc' }
    });

    const attempts = recentTokens.length;
    if (attempts > 0) {
        const lastAttempt = recentTokens[0].createdAt.getTime();
        let cooldownMinutes = 0;
        if (attempts === 1) cooldownMinutes = 1;
        else if (attempts === 2) cooldownMinutes = 10;
        else cooldownMinutes = 60;
        
        const nextAllowed = lastAttempt + cooldownMinutes * 60 * 1000;
        if (Date.now() < nextAllowed) {
            const remaining = Math.ceil((nextAllowed - Date.now()) / 60000);
            return { error: `Przekroczono limit prób. Odczekaj ${remaining} min. przed kolejną próbą.` }
        }
    }

    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() }
    })

    if (!user) {
        // We shouldn't reveal if user exists, but for internal HR system it might be tolerable.
        // Let's keep it safe.
        return { success: true, message: "Jeśli konto istnieje, wysłano link do zresetowania hasła." }
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour token valid

    await prisma.passwordResetToken.create({
        data: {
            email: user.email!,
            token,
            expiresAt
        }
    })

    // Create reset URL (needs to be absolute. Assuming NEXT_PUBLIC_APP_URL or request headers, but in SA we don't have request easily.
    // Let's use a hardcoded or relative path if possible, but email requires absolute. 
    // Usually we use NEXT_PUBLIC_APP_URL from .env
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    const htmlContent = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
            <h2>Resetowanie hasła w systemie HR4YOU</h2>
            <p>Witaj ${user.name || user.username},</p>
            <p>Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta. Aby ustawić nowe hasło, kliknij w poniższy przycisk:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ustaw nowe hasło</a>
            </div>
            <p>Jeśli zignorujesz tę wiadomość, Twoje obecne hasło pozostanie bez zmian. Link jest ważny przez 1 godzinę.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Ta wiadomość została wygenerowana automatycznie. Prosimy na nią nie odpowiadać.</p>
        </div>
    `

    try {
        await sendEmail(user.email!, "Resetowanie hasła w systemie HR4YOU", htmlContent)
        return { success: true, message: "Jeśli konto istnieje, wysłano link do zresetowania hasła." }
    } catch (e) {
        console.error("Failed to send reset email", e)
        return { error: "Wystąpił problem z wysłaniem e-maila. Skontaktuj się z administratorem, lub sprawdź konfigurację SMTP." }
    }
}

export async function resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) return { error: "Brakujące dane" }

    const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token }
    })

    if (!resetToken) {
        return { error: "Nieprawidłowy lub nieistniejący token." }
    }

    if (resetToken.expiresAt < new Date()) {
        return { error: "Token wygasł. Wygeneruj nowy korzystając z opcji przypomnienia hasła." }
    }

    const hashedPassword = await hashPassword(newPassword)

    // Update user password
    const user = await prisma.user.findFirst({
        where: { email: resetToken.email }
    })

    if (!user) {
        return { error: "Nie znaleziono konta powiązanego z tym adresem e-mail." }
    }

    try {
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        })

        // Delete used token (and optionally other expired ones)
        await prisma.passwordResetToken.deleteMany({
            where: {
                OR: [
                    { email: resetToken.email },
                    { expiresAt: { lt: new Date() } }
                ]
            }
        })

        return { success: true }
    } catch (e) {
        return { error: "Wystąpił nieoczekiwany błąd podczas zmiany hasła." }
    }
}
