import { Suspense } from "react"
import { getDepartments, getAllPermissions, getAllUsers } from "@/lib/actions/admin"
import { getSystemSettings } from "@/lib/actions/system-settings"
import { getSystemLogs } from "@/lib/actions/log-actions"
import { DepartmentList } from "@/components/admin/department-list"
import { UserManagement } from "@/components/admin/user-management"
import { SystemSettingsTab } from "@/components/admin/system-settings"
import { SystemLogsTable } from "@/components/admin/system-logs-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export default async function AdminPage() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect("/dashboard")
    }
    // Fetch data in parallel
    const [departments, permissions, usersRes, systemSettings, logsRes] = await Promise.all([
        getDepartments(),
        getAllPermissions(),
        getAllUsers(),
        getSystemSettings(),
        getSystemLogs(200),
    ])

    const users = usersRes.success ? usersRes.users : []

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Panel Administratora</h2>
            </div>

            <Tabs defaultValue="departments" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="departments">Działy</TabsTrigger>
                    <TabsTrigger value="users">Użytkownicy i Uprawnienia</TabsTrigger>
                    <TabsTrigger value="settings">Ustawienia Systemu</TabsTrigger>
                    <TabsTrigger value="logs">Dziennik Zdarzeń</TabsTrigger>
                </TabsList>

                <TabsContent value="departments" className="space-y-4">
                    <DepartmentList departments={departments} />
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <UserManagement
                        users={users}
                        departments={departments}
                        permissions={permissions}
                    />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <SystemSettingsTab settings={systemSettings} />
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                    <SystemLogsTable logs={logsRes.success ? (logsRes.logs as any) : []} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
