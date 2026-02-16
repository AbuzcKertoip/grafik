import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { getUserCars } from "@/lib/actions/fleet"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle, Car as CarIcon, Calendar, FileText } from "lucide-react"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

export default async function MyCarsPage() {
    const session = await getServerSession(authOptions)
    if (!session) {
        redirect("/dashboard")
    }

    const cars = await getUserCars(Number(session.user.id))

    const isExpired = (date: Date) => {
        const now = new Date()
        return new Date(date) < now
    }

    const isExpiringSoon = (date: Date) => {
        const now = new Date()
        const target = new Date(date)
        const diffTime = target.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays > 0 && diffDays <= 30
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Moje Pojazdy</h1>
                <p className="text-muted-foreground mt-2">Szczegóły przypisanych samochodów służbowych.</p>
            </div>

            {cars.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                        <CarIcon className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-lg">Nie masz przypisanych żadnych pojazdów.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {cars.map(car => (
                        <Card key={car.id} className="overflow-hidden">
                            <div className="h-2 bg-indigo-500" />
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <CarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                            {car.make} {car.model}
                                        </CardTitle>
                                        <div className="mt-1 font-mono text-xs bg-muted text-muted-foreground inline-block px-2 py-1 rounded">
                                            {car.plate}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm text-muted-foreground">{car.productionYear}</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">VIN</div>
                                    <div className="font-mono text-sm">{car.vin}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            <Calendar className="h-3 w-3" />
                                            Przegląd
                                        </div>
                                        <div className={`text-sm font-medium ${isExpired(car.inspectionValidUntil) ? "text-red-600 dark:text-red-400" :
                                            isExpiringSoon(car.inspectionValidUntil) ? "text-amber-600 dark:text-amber-400" : ""
                                            }`}>
                                            {format(new Date(car.inspectionValidUntil), "d MMM yyyy", { locale: pl })}
                                        </div>
                                        {(isExpired(car.inspectionValidUntil) || isExpiringSoon(car.inspectionValidUntil)) && (
                                            <div className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {isExpired(car.inspectionValidUntil) ? "Wygasł!" : "Wygasa wkrótce"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            <FileText className="h-3 w-3" />
                                            Ubezpieczenie
                                        </div>
                                        <div className={`text-sm font-medium ${isExpired(car.insuranceValidUntil) ? "text-red-600 dark:text-red-400" :
                                            isExpiringSoon(car.insuranceValidUntil) ? "text-amber-600 dark:text-amber-400" : ""
                                            }`}>
                                            {format(new Date(car.insuranceValidUntil), "d MMM yyyy", { locale: pl })}
                                        </div>
                                        {(isExpired(car.insuranceValidUntil) || isExpiringSoon(car.insuranceValidUntil)) && (
                                            <div className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {isExpired(car.insuranceValidUntil) ? "Wygasło!" : "Wygasa wkrótce"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t">
                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Polisa</div>
                                    <div className="text-sm bg-muted/50 p-2 rounded border">{car.policyNumber}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
