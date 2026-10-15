import { Suspense } from "react"
import { getDepartments, getAllPermissions, getAllUsers, getArchivedEmployees } from "@/lib/actions/admin"
import { getSystemSettings } from "@/lib/actions/system-settings"
import { getSystemLogs } from "@/lib/actions/log-actions"
import { DepartmentList } from "@/components/admin/department-list"
import { UserManagement } from "@/components/admin/user-management"
import { EmployeeArchive } from "@/components/admin/employee-archive"
import { SystemSettingsTab } from "@/components/admin/system-settings"
import { SystemLogsTable } from "@/components/admin/system-logs-table"
import { PermissionsManager } from "@/components/admin/permissions-manager"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { hasPermission } from "@/lib/auth/permissions"

export default async function AdminPage() {
    const session = await getServerSession(authOptions)

    const canViewAdmin = session?.user?.role === 'ADMIN' || hasPermission(session?.user as any, "manage_departments") || hasPermission(session?.user as any, "manage_users") || hasPermission(session?.user as any, "manage_permissions")
    if (!session || !canViewAdmin) {
        redirect("/dashboard")
    }
    // Fetch data in parallel
    const [departments, permissions, usersRes, systemSettings, archivedRes] = await Promise.all([
        getDepartments(),
        getAllPermissions(),
        getAllUsers(),
        getSystemSettings(),
        getArchivedEmployees(),
    ])

    const users = usersRes.success ? usersRes.users : []
    const archivedUsers = archivedRes.success ? (archivedRes.users || []) : []

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Panel Administratora</h2>
            </div>

            <Tabs defaultValue="departments" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="departments">Działy</TabsTrigger>
                    <TabsTrigger value="users">Użytkownicy i Uprawnienia</TabsTrigger>
                    <TabsTrigger value="archive">
                        Archiwum Pracowników
                        {archivedUsers.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 text-[10px] font-semibold">
                                {archivedUsers.length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="permissionsDb">Baza Uprawnień</TabsTrigger>
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
                        currentUser={session.user}
                    />
                </TabsContent>

                <TabsContent value="archive" className="space-y-4">
                    <EmployeeArchive users={archivedUsers} />
                </TabsContent>

                <TabsContent value="permissionsDb" className="space-y-4">
                    <PermissionsManager permissions={permissions} />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <SystemSettingsTab settings={systemSettings} />
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                    <SystemLogsTable />
                </TabsContent>
            </Tabs>
        </div>
    )
}
