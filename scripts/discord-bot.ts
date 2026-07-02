/**
 * Bot Discord HR4YOU — komenda !dyżur / !dyzur
 * Odpowiada informacją o najbliższym dyżurze (trwającym lub nadchodzącym).
 * Kolejne dni dyżuru tej samej osoby są łączone w jeden zakres, np. 05–07.07.2026.
 *
 * Konfiguracja (.env):
 *   DISCORD_BOT_TOKEN=...   (token z Discord Developer Portal)
 *
 * Uruchomienie przez pm2:
 *   pm2 start npm --name grafik-bot -- run bot
 */
import "dotenv/config"
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const TOKEN = process.env.DISCORD_BOT_TOKEN
if (!TOKEN) {
    console.error("Brak DISCORD_BOT_TOKEN w .env — bot nie może wystartować.")
    process.exit(1)
}

const LOOKBACK_DAYS = 14  // ile dni wstecz szukać początku trwającego dyżuru
const LOOKAHEAD_DAYS = 60 // ile dni w przód szukać najbliższego dyżuru

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // wymaga włączenia "Message Content Intent" w Developer Portal
    ],
})

interface DutyUser {
    name: string | null
    username: string
    phone: string | null
    department: { name: string } | null
}

interface DutyRun {
    user: DutyUser
    start: Date
    end: Date
}

function dayValue(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const ONE_DAY = 24 * 60 * 60 * 1000

/** Łączy dni dyżuru danego użytkownika w ciągłe zakresy. */
function buildRuns(days: { date: Date; user: DutyUser; userId: number }[]): DutyRun[] {
    const byUser = new Map<number, { date: Date; user: DutyUser }[]>()
    for (const d of days) {
        if (!byUser.has(d.userId)) byUser.set(d.userId, [])
        byUser.get(d.userId)!.push(d)
    }

    const runs: DutyRun[] = []
    for (const entries of byUser.values()) {
        entries.sort((a, b) => dayValue(a.date) - dayValue(b.date))
        let run: DutyRun | null = null
        for (const e of entries) {
            if (run && dayValue(e.date) - dayValue(run.end) === ONE_DAY) {
                run.end = e.date
            } else {
                if (run) runs.push(run)
                run = { user: e.user, start: e.date, end: e.date }
            }
        }
        if (run) runs.push(run)
    }
    return runs
}

function fmtDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`
}

/** Formatuje zakres: pojedynczy dzień "05.07.2026", zakres "05–07.07.2026" lub "30.06–02.07.2026". */
function fmtRange(start: Date, end: Date): string {
    if (dayValue(start) === dayValue(end)) return fmtDate(start)
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate().toString().padStart(2, "0")}–${fmtDate(end)}`
    }
    return `${fmtDate(start)}–${fmtDate(end)}`
}

function dutyLine(run: DutyRun): string {
    const name = run.user.name || run.user.username
    const phone = run.user.phone ? `📞 ${run.user.phone}` : "📞 brak numeru w systemie"
    const dept = run.user.department?.name ? ` _(${run.user.department.name})_` : ""
    return `**${fmtRange(run.start, run.end)}** — **${name}**${dept} — ${phone}`
}

async function getNearestDutyRuns(): Promise<DutyRun[]> {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const from = new Date(today.getTime() - LOOKBACK_DAYS * ONE_DAY)
    const to = new Date(today.getTime() + LOOKAHEAD_DAYS * ONE_DAY)

    const days = await prisma.scheduleDay.findMany({
        where: { type: "DUTY", date: { gte: from, lte: to } },
        include: { user: { select: { name: true, username: true, phone: true, department: { select: { name: true } } } } },
        orderBy: { date: "asc" },
    })

    const runs = buildRuns(days)
        .filter(r => dayValue(r.end) >= today.getTime()) // trwające lub przyszłe
        .sort((a, b) => dayValue(a.start) - dayValue(b.start))

    if (runs.length === 0) return []

    // Najbliższy okres dyżurowy: pierwszy blok + wszystkie bloki nakładające się
    // lub bezpośrednio z nim sąsiadujące (np. sobota jedna osoba, niedziela-wtorek druga)
    const period: DutyRun[] = []
    let coverageEnd = dayValue(runs[0].end)
    for (const r of runs) {
        if (dayValue(r.start) <= coverageEnd + ONE_DAY) {
            period.push(r)
            coverageEnd = Math.max(coverageEnd, dayValue(r.end))
        }
    }
    return period
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) return
    const cmd = message.content.trim().toLowerCase()
    if (cmd !== "!dyżur" && cmd !== "!dyzur") return

    try {
        const runs = await getNearestDutyRuns()

        const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("🛠️ Najbliższy dyżur")
            .setDescription(runs.length
                ? runs.map(dutyLine).join("\n")
                : `_Brak przypisanych dyżurów w grafiku (sprawdzono ${LOOKAHEAD_DAYS} dni w przód)._`)
            .setFooter({ text: "HR4YOU • dane z grafiku" })
            .setTimestamp()

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } })
    } catch (e) {
        console.error("Błąd komendy !dyżur:", e)
        await message.reply("⚠️ Nie udało się pobrać danych o dyżurze. Spróbuj ponownie później.").catch(() => {})
    }
})

client.once("clientReady", () => {
    console.log(`Bot zalogowany jako ${client.user?.tag}`)
})

client.login(TOKEN)
