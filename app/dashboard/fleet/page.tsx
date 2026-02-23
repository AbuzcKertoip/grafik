import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCars } from "@/lib/actions/fleet"
import { CarList } from "@/components/fleet/car-list"

export default async function FleetPage() {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HR")) {
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
