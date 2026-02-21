import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkTimeReport } from "@/components/reports/work-time-report"
import { VacationsReport } from "@/components/reports/vacations-report"
import { TeamAlertsReport } from "@/components/reports/team-alerts-report"
import { PieChart, Clock, CalendarDays, AlertCircle } from "lucide-react"

export default async function ReportsPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const { role } = session.user

    if (role !== "ADMIN" && role !== "MANAGER") {
        redirect("/dashboard")
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <PieChart className="h-8 w-8 text-indigo-500" />
                        Raporty i Zestawienia
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Przeglądaj statystyki czasu pracy, urlopów oraz alerty w zespole.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="work-time" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none px-0 h-auto bg-transparent">
                    <TabsTrigger
                        value="work-time"
                        className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-all data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 pt-3 px-6"
                    >
                        <Clock className="w-4 h-4 mr-2" />
                        Czas Pracy
                    </TabsTrigger>
                    <TabsTrigger
                        value="vacations"
                        className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-all data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 pt-3 px-6"
                    >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Urlopy
                    </TabsTrigger>
                    <TabsTrigger
                        value="alerts"
                        className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-all data-[state=active]:shadow-none data-[state=active]:bg-transparent pb-3 pt-3 px-6"
                    >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Zespół i Flota
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="work-time" className="m-0 border-none p-0 outline-none">
                        <WorkTimeReport />
                    </TabsContent>
                    <TabsContent value="vacations" className="m-0 border-none p-0 outline-none">
                        <VacationsReport />
                    </TabsContent>
                    <TabsContent value="alerts" className="m-0 border-none p-0 outline-none">
                        <TeamAlertsReport />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
