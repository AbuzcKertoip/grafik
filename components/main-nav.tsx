"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChangePasswordDialog } from "@/components/user-profile/change-password-dialog"
import { useState } from "react"
import { CalendarDays, ClipboardList, Users, PieChart, LogOut, Home, User, Shield, Car, KeyRound } from "lucide-react"

export function MainNav() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"
    const isHR = session?.user?.role === "HR" || isAdmin
    const isManager = session?.user?.role === "MANAGER" || isAdmin
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)

    const links = [
        {
            href: "/dashboard",
            label: "Pulpit",
            icon: Home,
            show: true,
        },
        {
            href: "/dashboard/admin",
            label: "Administracja",
            icon: Shield,
            show: isAdmin,
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
        // {
        //     href: "/dashboard/users",
        //     label: "Pracownicy",
        //     icon: Users,
        //     show: isAdmin, // Superseded by Admin Panel
        // },
        {
            href: "/dashboard/reports",
            label: "Raporty",
            icon: PieChart,
            show: isAdmin || isManager,
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
            icon: Users, // Changed icon to Users for HR
            show: isHR || isManager,
        },
        {
            href: "/dashboard/fleet",
            label: "Flota",
            icon: Car,
            show: isAdmin, // Or specific fleet manager?
        },
        {
            href: "/dashboard/my-cars",
            label: "Moje Auto",
            icon: Car,
            show: true,
        },
    ]

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white w-64 animate-in slide-in-from-left-64 duration-500 ease-out shadow-xl border-r border-slate-800">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold tracking-tight">HR4YOU</h1>
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 px-3">
                            <div className="flex flex-col items-start gap-1">
                                <p className="text-sm font-medium">{session?.user?.name || session?.user?.username}</p>
                                <p className="text-xs text-slate-500 capitalize">{session?.user?.role?.toLowerCase()}</p>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-slate-900 border-slate-800 text-slate-300">
                        <DropdownMenuLabel className="text-slate-400">Moje Konto</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)} className="text-white focus:text-white focus:bg-slate-800 cursor-pointer hover:text-white">
                            <KeyRound className="mr-2 h-4 w-4" />
                            Zmień hasło
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="text-red-400 focus:text-red-300 focus:bg-slate-800 cursor-pointer hover:text-red-300"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Wyloguj
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {session?.user?.id && (
                    <ChangePasswordDialog
                        userId={parseInt(session.user.id)}
                        open={isPasswordDialogOpen}
                        onOpenChange={setIsPasswordDialogOpen}
                    />
                )}
            </div>
        </div>
    )
}
