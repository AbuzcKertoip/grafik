import { getUsers } from "@/lib/actions/users"
import { UsersTable } from "@/components/users/users-table"

export default async function UsersPage() {
    const users = await getUsers()

    return (
        <div>
            <UsersTable users={users} />
        </div>
    )
}
