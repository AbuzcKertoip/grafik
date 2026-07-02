"use server"

import { prisma } from "@/lib/prisma"

/**
 * Discord webhook notifications for schedule changes.
 * Webhook URL is configured in Admin Panel -> System Settings.
 * Users are pinged via their Discord User ID (User.discordId).
 */

const DISCORD_MSG_LIMIT = 1900 // real limit is 2000, keep margin

async function getWebhookUrl(): Promise<string | null> {
    const settings = await prisma.systemSettings.findUnique({
        where: { id: 1 },
        select: { discordWebhookUrl: true }
    })
    const url = settings?.discordWebhookUrl?.trim()
    if (!url || !url.startsWith("https://discord.com/api/webhooks/")) return null
    return url
}

async function postToWebhook(url: string, content: string) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content,
            allowed_mentions: { parse: ["users"] }
        })
    })
    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Discord webhook error ${res.status}: ${body}`)
    }
}

/** Splits long content on newlines and sends in chunks (Discord 2000 char limit). */
async function sendDiscordMessage(content: string): Promise<{ success?: boolean; skipped?: boolean; error?: string }> {
    try {
        const url = await getWebhookUrl()
        if (!url) return { skipped: true }

        const lines = content.split("\n")
        let chunk = ""
        for (const line of lines) {
            if ((chunk + "\n" + line).length > DISCORD_MSG_LIMIT && chunk) {
                await postToWebhook(url, chunk)
                chunk = line
            } else {
                chunk = chunk ? chunk + "\n" + line : line
            }
        }
        if (chunk) await postToWebhook(url, chunk)
        return { success: true }
    } catch (e: any) {
        console.error("Discord notification failed:", e)
        return { error: e.message || "Discord webhook failed" }
    }
}

function mentionOrName(user: { discordId?: string | null; name?: string | null; username: string }): string {
    return user.discordId ? `<@${user.discordId}>` : `**${user.name || user.username}**`
}

export interface ShiftChange {
    dateStr: string // e.g. "05.07.2026"
    typeStr: string // e.g. "Zmiana 1"
}

/**
 * Notifies about schedule changes for one or more users in a single message.
 * Each affected user is pinged (if discordId is set) with a list of their changed days.
 */
export async function notifyDiscordScheduleChanges(
    changes: { userId: number; shifts: ShiftChange[] }[],
    editorName?: string | null
) {
    try {
        if (changes.length === 0) return { skipped: true }

        const userIds = changes.map(c => c.userId)
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, discordId: true, name: true, username: true }
        })
        const userMap = new Map(users.map(u => [u.id, u]))

        const header = `📅 **Zmiany w grafiku**${editorName ? ` (przez: ${editorName})` : ""}`
        const sections: string[] = []

        for (const change of changes) {
            const user = userMap.get(change.userId)
            if (!user || change.shifts.length === 0) continue

            const who = mentionOrName(user)
            if (change.shifts.length === 1) {
                const s = change.shifts[0]
                sections.push(`${who} — **${s.dateStr}**: ${s.typeStr}`)
            } else {
                const list = change.shifts.map(s => `> • **${s.dateStr}**: ${s.typeStr}`).join("\n")
                sections.push(`${who} — ${change.shifts.length} zmian:\n${list}`)
            }
        }

        if (sections.length === 0) return { skipped: true }

        return await sendDiscordMessage(`${header}\n${sections.join("\n")}`)
    } catch (e: any) {
        console.error("Discord schedule notification failed:", e)
        return { error: e.message }
    }
}

/** Sends a test message to verify the configured webhook (Admin only, used from settings panel). */
export async function testDiscordWebhook() {
    const url = await getWebhookUrl()
    if (!url) {
        return { success: false, error: "Brak poprawnego adresu webhooka. Zapisz ustawienia i spróbuj ponownie (URL musi zaczynać się od https://discord.com/api/webhooks/)." }
    }
    try {
        await postToWebhook(url, "✅ **HR4YOU** — test powiadomień Discord zakończony sukcesem! Powiadomienia o zmianach w grafiku będą trafiać na ten kanał.")
        return { success: true, message: "Wiadomość testowa wysłana na Discorda!" }
    } catch (e: any) {
        console.error("Discord test failed:", e)
        return { success: false, error: e.message || "Błąd wysyłki na Discorda." }
    }
}
