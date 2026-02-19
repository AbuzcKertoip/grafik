import { Suspense } from "react"
import { getDepartments, getAllPermissions, getAllUsers } from "@/lib/actions/admin"
import { DepartmentList } from "@/components/admin/department-list"
import { UserManagement } from "@/components/admin/user-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function AdminPage() {
    // Fetch data in parallel
    const [departments, permissions, usersRes] = await Promise.all([
        getDepartments(),
        getAllPermissions(),
        getAllUsers(),
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
            </Tabs>
        </div>
    )
}
