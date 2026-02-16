import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { getWorkLogs } from "@/lib/actions/work-logs"
import { WorkLogTable } from "@/components/work-logs/work-log-table"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

interface WorkLogsPageProps {
    searchParams: Promise<{
        month?: string
        year?: string
    }>
}

export default async function WorkLogsPage(props: WorkLogsPageProps) {
    const searchParams = await props.searchParams;
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const now = new Date()
    const year = searchParams?.year ? parseInt(searchParams.year) : now.getFullYear()
    const month = searchParams?.month ? parseInt(searchParams.month) : now.getMonth() + 1
    const userId = parseInt(session.user.id)

    const logs = await getWorkLogs(userId, year, month)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight capitalize">
                    Karta Pracy - {format(new Date(year, month - 1), "LLLL yyyy", { locale: pl })}
                </h2>
            </div>

            <WorkLogTable
                logs={logs}
                year={year}
                month={month}
                user={session.user}
            />
        </div>
    )
}
