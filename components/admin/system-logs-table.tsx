"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { ExternalLink, Info } from "lucide-react"
import { getDocsUrl } from "@/lib/error-codes"

interface SystemLog {
    id: number
    action: string
    description: string
    errorCode: string | null
    createdAt: Date
    user: {
        name: string | null
        username: string
    } | null
}

interface SystemLogsTableProps {
    logs: SystemLog[]
}

export function SystemLogsTable({ logs }: SystemLogsTableProps) {
    return (
        <div className="space-y-4">
            <div className="rounded-md border border-slate-800">
                <Table>
                    <TableHeader className="bg-slate-800/50">
                        <TableRow className="border-slate-800 hover:bg-slate-800/50">
                            <TableHead className="text-slate-300">Data i czas</TableHead>
                            <TableHead className="text-slate-300">Użytkownik</TableHead>
                            <TableHead className="text-slate-300">Akcja</TableHead>
                            <TableHead className="text-slate-300">Opis</TableHead>
                            <TableHead className="text-slate-300">Kod / Link</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow className="border-slate-800 hover:bg-slate-800/10 transition-colors">
                                <TableCell colSpan={5} className="h-24 text-center text-slate-400">
                                    Brak logów w systemie.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/10 transition-colors text-slate-300">
                                    <TableCell className="whitespace-nowrap">
                                        {format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                                    </TableCell>
                                    <TableCell>
                                        {log.user ? (
                                            <span className="font-medium text-slate-200">
                                                {log.user.name || log.user.username}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 italic">System</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-slate-800/50 text-slate-300 border-slate-700">
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate" title={log.description}>
                                        {log.description}
                                    </TableCell>
                                    <TableCell>
                                        {log.errorCode ? (
                                            <a
                                                href={getDocsUrl(log.errorCode)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20 transition-colors"
                                            >
                                                {log.errorCode}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            <span className="text-slate-500">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
