import { getSchedule } from "@/lib/actions/schedule"

export const dynamic = 'force-dynamic'
import { getUsers } from "@/lib/actions/users"
import { getVacations } from "@/lib/actions/vacations"
import { ScheduleGrid } from "@/components/schedule/schedule-grid"
import { ScheduleActions } from "@/components/schedule/schedule-actions"
import { ScheduleDepartmentFilter } from "@/components/schedule/schedule-department-filter"
import { format, addMonths, subMonths } from "date-fns"
import { pl } from "date-fns/locale"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

interface SchedulePageProps {
    searchParams: Promise<{
        month?: string
        year?: string
        dept?: string
    }>
}

export default async function SchedulePage(props: SchedulePageProps) {
    const searchParams = await props.searchParams;
    const session = await getServerSession(authOptions)

    // Safety check mostly for typings
    if (!session || !session.user) {
        return <div>Zaloguj się aby kontynuować.</div>;
    }

    const now = new Date()
    const year = searchParams?.year ? parseInt(searchParams.year) : now.getFullYear()
    const month = searchParams?.month ? parseInt(searchParams.month) : now.getMonth() + 1

    const currentDate = new Date(year, month - 1, 1)
    const prevDate = subMonths(currentDate, 1)
    const nextDate = addMonths(currentDate, 1)

    const requestedDeptId = searchParams?.dept || null
    const users = await getUsers(requestedDeptId)
    const schedule = await getSchedule(year, month)
    const vacations = await getVacations(year)

    // Admins and HR can see the filter and we need to fetch departments for the dropdown
    const canFilter = session.user.role === 'ADMIN' || session.user.role === 'HR';
    const allDepartments = canFilter ? await prisma.department.findMany({ orderBy: { name: 'asc' } }) : [];

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
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
                    {canFilter && (
                        <div className="hidden sm:block border-l h-8 border-muted" />
                    )}
                    {canFilter && (
                        <div className="w-full sm:w-auto">
                            <ScheduleDepartmentFilter
                                departments={allDepartments}
                                currentDeptId={requestedDeptId || undefined}
                            />
                        </div>
                    )}
                </div>

                <ScheduleActions
                    users={users}
                    vacations={vacations}
                    year={year}
                    month={month}
                    currentUser={session?.user}
                    departmentId={requestedDeptId ? parseInt(requestedDeptId) : undefined}
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
