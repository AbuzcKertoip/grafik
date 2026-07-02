/**
 * Ustawia Discord ID użytkownikom (dopasowanie po imieniu/nazwisku) oraz opcjonalnie webhook.
 *
 * Użycie (na serwerze, w katalogu projektu):
 *   npx ts-node scripts/set-discord-ids.ts                # podgląd dopasowań (dry-run)
 *   npx ts-node scripts/set-discord-ids.ts --apply        # zapis do bazy
 *   npx ts-node scripts/set-discord-ids.ts --apply --webhook "https://discord.com/api/webhooks/..."
 *
 * Webhooka celowo NIE ma w kodzie (repo jest publiczne).
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// imię (lub imię+nazwisko) -> Discord User ID
const MAPPING: Record<string, string> = {
    "andrzej": "1209406916623601685",
    "bruno": "1199697530594791515",
    "marcin": "1199648641703497760",
    "piotrek": "441950072469454858",
    "robert": "1398552969644867584",
    "lukasz karnas": "1199647120509112403",
    "adrian": "1199705682090393642",
    "dawid": "1200006477428043809",
    "krystian": "430325479258587136",
    "maciek": "1199804061839523940",
    "mateusz": "1199978065758007319",
    "sebastian": "694105020316254248",
    "lukasz rakowski": "1076528537357525053",
}

// aliasy zdrobnień -> możliwe imiona w bazie
const ALIASES: Record<string, string[]> = {
    "piotrek": ["piotr", "piotrek"],
    "maciek": ["maciej", "maciek"],
}

function normalize(s: string): string {
    return s.toLowerCase()
        .replace(/ł/g, "l")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ").trim()
}

async function main() {
    const apply = process.argv.includes("--apply")
    const webhookIdx = process.argv.indexOf("--webhook")
    const webhook = webhookIdx > -1 ? process.argv[webhookIdx + 1] : null

    const users = await prisma.user.findMany({
        select: { id: true, username: true, name: true, discordId: true }
    })

    const results: { key: string; status: string; user?: string }[] = []

    for (const [key, discordId] of Object.entries(MAPPING)) {
        const tokens = normalize(key).split(" ")
        const firstNames = ALIASES[tokens[0]] || [tokens[0]]
        const surname = tokens[1] // undefined dla samego imienia

        const matches = users.filter(u => {
            const full = normalize(`${u.name || ""} ${u.username}`)
            const hasFirst = firstNames.some(fn => full.includes(fn))
            const hasSurname = !surname || full.includes(surname)
            return hasFirst && hasSurname
        })

        if (matches.length === 1) {
            const u = matches[0]
            results.push({ key, status: apply ? "ZAPISANO" : "DOPASOWANO", user: `${u.name || u.username} (id=${u.id})` })
            if (apply) {
                await prisma.user.update({ where: { id: u.id }, data: { discordId } })
            }
        } else if (matches.length === 0) {
            results.push({ key, status: "BRAK DOPASOWANIA — ustaw ręcznie w panelu admina" })
        } else {
            results.push({ key, status: `NIEJEDNOZNACZNE (${matches.map(m => m.name || m.username).join(", ")}) — ustaw ręcznie` })
        }
    }

    for (const r of results) {
        console.log(`${r.key.padEnd(20)} -> ${r.status}${r.user ? `: ${r.user}` : ""}`)
    }

    if (webhook) {
        if (!webhook.startsWith("https://discord.com/api/webhooks/")) {
            console.error("\nNieprawidłowy webhook URL — pominięto.")
        } else if (apply) {
            await prisma.systemSettings.upsert({
                where: { id: 1 },
                update: { discordWebhookUrl: webhook },
                create: { id: 1, discordWebhookUrl: webhook }
            })
            console.log("\nWebhook zapisany w ustawieniach systemowych.")
        } else {
            console.log("\nWebhook zostanie zapisany po uruchomieniu z --apply.")
        }
    }

    if (!apply) console.log("\n(dry-run — nic nie zapisano; uruchom z --apply aby zapisać)")
}

main().finally(() => prisma.$disconnect())
