import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCars } from "@/lib/actions/fleet"
import { CarList } from "@/components/fleet/car-list"

export default async function FleetPage() {
    const session = await getServerSession(authOptions)
    if (!session) {
        redirect("/dashboard")
    }

    const { role, departmentId } = session.user as any;
    let isManagerInHR = false;
    if (role === 'MANAGER' && departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            isManagerInHR = true;
        }
    }

    if (role !== "ADMIN" && role !== "HR" && !isManagerInHR) {
        redirect("/dashboard")
    }

    const cars = await getCars()
    const users = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            username: true
        }
    })

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Ewidencja Pojazdów</h1>
                <p className="text-muted-foreground mt-2">Zarządzaj flotą samochodową i przypisuj opiekunów.</p>
            </div>

            <CarList initialCars={cars} users={users} />
        </div>
    )
}
