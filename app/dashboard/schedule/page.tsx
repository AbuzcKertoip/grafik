import { getSchedule } from "@/lib/actions/schedule"

export const dynamic = 'force-dynamic'
import { getUsers } from "@/lib/actions/users"
import { getVacations } from "@/lib/actions/vacations"
import { ScheduleGrid } from "@/components/schedule/schedule-grid"
import { ScheduleActions } from "@/components/schedule/schedule-actions"
import { format, addMonths, subMonths } from "date-fns"
import { pl } from "date-fns/locale"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

interface SchedulePageProps {
    searchParams: Promise<{
        month?: string
        year?: string
    }>
}

export default async function SchedulePage(props: SchedulePageProps) {
    const searchParams = await props.searchParams;
    const session = await getServerSession(authOptions)

    const now = new Date()
    const year = searchParams?.year ? parseInt(searchParams.year) : now.getFullYear()
    const month = searchParams?.month ? parseInt(searchParams.month) : now.getMonth() + 1

    const currentDate = new Date(year, month - 1, 1)
    const prevDate = subMonths(currentDate, 1)
    const nextDate = addMonths(currentDate, 1)

    const users = await getUsers()
    const schedule = await getSchedule(year, month)
    const vacations = await getVacations(year)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" asChild>
                            <Link href={`/dashboard/schedule?year=${prevDate.getFullYear()}&month=${prevDate.getMonth() + 1}`}>
                                <ChevronLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <h2 className="text-2xl font-bold tracking-tight capitalize w-48 text-center">
                            {format(currentDate, "LLLL yyyy", { locale: pl })}
                        </h2>
                        <Button variant="outline" size="icon" asChild>
                            <Link href={`/dashboard/schedule?year=${nextDate.getFullYear()}&month=${nextDate.getMonth() + 1}`}>
                                <ChevronRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <ScheduleActions
                    users={users}
                    vacations={vacations}
                    year={year}
                    month={month}
                    currentUser={session?.user}
                />
            </div>

            <ScheduleGrid
                users={users}
                schedule={schedule}
                year={year}
                month={month}
            />
        </div>
    )
}
