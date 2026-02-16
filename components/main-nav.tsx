"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CalendarDays, ClipboardList, Users, PieChart, LogOut, Home, User, Shield } from "lucide-react"

export function MainNav() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"

    const links = [
        {
            href: "/dashboard",
            label: "Pulpit",
            icon: Home,
            show: true,
        },
        {
            href: "/dashboard/schedule",
            label: "Grafik",
            icon: CalendarDays,
            show: true,
        },
        {
            href: "/dashboard/work-logs",
            label: "Karta Pracy",
            icon: ClipboardList,
            show: true,
        },
        {
            href: "/dashboard/users",
            label: "Pracownicy",
            icon: Users,
            show: isAdmin,
        },
        {
            href: "/dashboard/reports",
            label: "Raporty",
            icon: PieChart,
            show: isAdmin,
        },
        {
            href: "/dashboard/profile",
            label: "Mój Profil",
            icon: User,
            show: true,
        },
        {
            href: "/dashboard/hr",
            label: "Panel HR",
            icon: Shield,
            show: isAdmin,
        },
    ]

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white w-64 animate-in slide-in-from-left-64 duration-500 ease-out shadow-xl">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold tracking-tight">System Grafiku</h1>
                <p className="text-xs text-slate-400 mt-1">ENFORMATIC</p>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {links.filter(l => l.show).map((link, index) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out hover:translate-x-1 hover:bg-slate-800 hover:text-white relative overflow-hidden",
                                isActive ? "bg-slate-800 text-white shadow-sm" : "text-slate-400",
                                "animate-in slide-in-from-left-4 fade-in duration-500 fill-mode-backwards"
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Active Indicator Line */}
                            {isActive && (
                                <span className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-lg animate-in fade-in zoom-in duration-300" />
                            )}

                            <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110 duration-200", isActive && "text-indigo-400")} />
                            <span>{link.label}</span>
                        </Link>
                    )
                })}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="flex flex-col gap-2">
                    <div className="px-3">
                        <p className="text-sm font-medium">{session?.user?.name || session?.user?.username}</p>
                        <p className="text-xs text-slate-500 capitalize">{session?.user?.role?.toLowerCase()}</p>
                    </div>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Wyloguj
                    </Button>
                </div>
            </div>
        </div>
    )
}
