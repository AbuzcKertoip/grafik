/**
 * Bot Discord HR4YOU — komenda !dyżur / !dyzur
 * Odpowiada informacją, kto ma dyżur w najbliższy weekend (sobota + niedziela)
 * wraz z numerem telefonu z profilu pracownika.
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // wymaga włączenia "Message Content Intent" w Developer Portal
    ],
})

/** Zwraca [sobota, niedziela] najbliższego weekendu (w trakcie weekendu — bieżący). */
function getTargetWeekend(now = new Date()): [Date, Date] {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dow = d.getDay() // 0 = niedziela, 6 = sobota
    let saturday: Date
    if (dow === 6) {
        saturday = d
    } else if (dow === 0) {
        saturday = new Date(d)
        saturday.setDate(d.getDate() - 1)
    } else {
        saturday = new Date(d)
        saturday.setDate(d.getDate() + (6 - dow))
    }
    const sunday = new Date(saturday)
    sunday.setDate(saturday.getDate() + 1)
    return [saturday, sunday]
}

function fmtDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`
}

async function getDutyForDay(day: Date) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0)
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
    return prisma.scheduleDay.findMany({
        where: { type: "DUTY", date: { gte: start, lte: end } },
        include: { user: { select: { name: true, username: true, phone: true, department: { select: { name: true } } } } },
    })
}

function dutyLine(duty: Awaited<ReturnType<typeof getDutyForDay>>[number]): string {
    const name = duty.user.name || duty.user.username
    const phone = duty.user.phone ? `📞 ${duty.user.phone}` : "📞 brak numeru w systemie"
    const dept = duty.user.department?.name ? ` _(${duty.user.department.name})_` : ""
    return `**${name}**${dept} — ${phone}`
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) return
    const cmd = message.content.trim().toLowerCase()
    if (cmd !== "!dyżur" && cmd !== "!dyzur") return

    try {
        const [saturday, sunday] = getTargetWeekend()
        const [satDuties, sunDuties] = await Promise.all([getDutyForDay(saturday), getDutyForDay(sunday)])

        const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`🛠️ Dyżur weekendowy ${fmtDate(saturday)}–${fmtDate(sunday)}`)
            .addFields(
                {
                    name: `Sobota ${fmtDate(saturday)}`,
                    value: satDuties.length ? satDuties.map(dutyLine).join("\n") : "_Brak przypisanego dyżuru_",
                },
                {
                    name: `Niedziela ${fmtDate(sunday)}`,
                    value: sunDuties.length ? sunDuties.map(dutyLine).join("\n") : "_Brak przypisanego dyżuru_",
                },
            )
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
