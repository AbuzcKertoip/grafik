import { NextResponse } from "next/server"
import { processAndSendExpirationAlerts } from "@/lib/actions/email-logs"
import { createLog } from "@/lib/actions/log-actions"

export async function GET(request: Request) {
    // Secure this endpoint with a secret key in the header
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const result = await processAndSendExpirationAlerts(false)
        
        if (result.success && result.stats) {
            // Log the successful automated cron run (using system user 0 or a generic message)
            await createLog({
                action: "CRON_ALERT_TRIGGERED",
                description: `Wygenerowano i wysłano systemowy automatyczny raport alertów. Znaleziono: ${result.stats.exams} badań, ${result.stats.cars} pojazdów.`,
                userId: 0, // 0 can signify system
                errorCodeKey: "CRON_ALERT_TRIGGERED",
            });
        }

        if (result.success) {
            return NextResponse.json({ success: true, message: result.message })
        } else {
            return NextResponse.json({ success: false, message: result.message }, { status: 400 })
        }

    } catch (error: any) {
        console.error("Cron Alert Error:", error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
