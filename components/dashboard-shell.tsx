"use client"

import { useState } from "react"
import { MainNav } from "@/components/main-nav"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardShell({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 bg-slate-900 transition-all duration-500 ease-in-out overflow-hidden",
                    // Reset to relative on desktop
                    "md:relative",
                    // State handling:
                    // OPEN: Mobile=Translate0, Desktop=Width64
                    // CLOSED: Mobile=Translate-Full, Desktop=Width0
                    isSidebarOpen
                        ? "w-64 translate-x-0"
                        : "w-64 -translate-x-full md:w-0 md:translate-x-0 md:min-w-0"
                )}
            >
                <div className="w-64 h-full flex flex-col relative whitespace-nowrap">
                    <div className="absolute right-4 top-4 md:hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                    <MainNav />
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full relative">
                <header className="flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm shrink-0 z-30">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors group"
                    >
                        <Menu className={cn(
                            "h-6 w-6 text-slate-600 transition-transform duration-500",
                            !isSidebarOpen && "rotate-180"
                        )} />
                        <span className="sr-only">Przełącz menu</span>
                    </Button>

                    <div className="flex flex-1 items-center justify-between">
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">System Grafiku</h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto w-full">
                    <div className="p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className={cn(
                        "fixed inset-0 z-40 bg-slate-900/50 md:hidden backdrop-blur-[2px] animate-in fade-in duration-300",
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    )
}
