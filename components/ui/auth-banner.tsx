"use client"

import { Building2, Globe, ShieldCheck } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"

export function AuthBanner() {
    return (
        <div className="absolute top-0 left-0 w-full z-20 px-6 py-4 flex items-center justify-between bg-background/40 backdrop-blur-md border-b border-white/5 shadow-sm">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight text-foreground/90">HR4YOU</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Enterprise Portal</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center space-x-6 text-sm text-muted-foreground">
                    <div className="flex items-center group cursor-default">
                        <ShieldCheck className="w-4 h-4 mr-2 group-hover:text-primary transition-colors" />
                        <span className="group-hover:text-foreground transition-colors">Secure Connection</span>
                    </div>
                    <div className="flex items-center group cursor-default">
                        <Globe className="w-4 h-4 mr-2 group-hover:text-primary transition-colors" />
                        <span className="group-hover:text-foreground transition-colors">Global Access</span>
                    </div>
                </div>
                <ModeToggle />
            </div>
        </div>
    )
}
