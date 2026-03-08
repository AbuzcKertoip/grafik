"use client"

import { useState, useEffect, useCallback } from "react"
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
import { ExternalLink, Search, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { getDocsUrl, ERROR_CODES } from "@/lib/error-codes"
import { getSystemLogs } from "@/lib/actions/log-actions"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

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

export function SystemLogsTable() {
    const [logs, setLogs] = useState<SystemLog[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    const [page, setPage] = useState(1)
    const limit = 20

    const [search, setSearch] = useState("")
    const [actionFilter, setActionFilter] = useState("ALL")

    const fetchLogs = useCallback(async () => {
        setIsLoading(true)
        const offset = (page - 1) * limit
        const res = await getSystemLogs(limit, offset, search, actionFilter)
        if (res.success) {
            setLogs(res.logs as unknown as SystemLog[])
            setTotal(res.total)
        }
        setIsLoading(false)
    }, [page, limit, search, actionFilter])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    const totalPages = Math.ceil(total / limit)

    // Dostępne akcje do filtrowania z ErrorCodes
    const uniqueActions = Array.from(new Set(Object.keys(ERROR_CODES).map(k => ERROR_CODES[k as keyof typeof ERROR_CODES].code)))

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/40 p-4 rounded-lg border">
                <div className="flex flex-1 gap-4 items-center w-full">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Szukaj użytkownika, opisu, kodu..."
                            className="bg-background pl-9"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                        />
                    </div>
                    <Select value={actionFilter} onValueChange={(val) => {
                        setActionFilter(val)
                        setPage(1)
                    }}>
                        <SelectTrigger className="w-[200px] bg-background">
                            <SelectValue placeholder="Wszystkie Akcje" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                            <SelectItem value="ALL">Wszystkie Akcje</SelectItem>
                            <SelectItem value="LOGIN_SUCCESS">Pomyślne Logowania</SelectItem>
                            <SelectItem value="LOGIN_FAILED">Błędy Logowania</SelectItem>
                            <SelectItem value="USER_CREATED">Nowi Użytkownicy</SelectItem>
                            <SelectItem value="SCHEDULE_MODIFIED">Grafiki</SelectItem>
                            <SelectItem value="VACATION_REQUESTED">Urlopy</SelectItem>
                            <SelectItem value="SETTINGS_UPDATED">Ustawienia</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoading} className="bg-background shrink-0">
                    <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="rounded-md border relative">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-muted/50">
                            <TableHead className="font-medium">Data i czas</TableHead>
                            <TableHead className="font-medium">Użytkownik</TableHead>
                            <TableHead className="font-medium">Akcja</TableHead>
                            <TableHead className="font-medium">Opis</TableHead>
                            <TableHead className="font-medium">Kod / Link</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Ładowanie zdarzeń...
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow className="hover:bg-muted/50 transition-colors">
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Brak logów pasujących do kryteriów.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="whitespace-nowrap">
                                        {format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                                    </TableCell>
                                    <TableCell>
                                        {log.user ? (
                                            <span className="font-medium">
                                                {log.user.name || log.user.username}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground italic">System</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${log.action.includes('FAILED') || log.action.includes('REJECTED') ? 'border-destructive/50 text-destructive' : 'text-muted-foreground border-border'}`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[400px] truncate" title={log.description}>
                                        {log.description}
                                    </TableCell>
                                    <TableCell>
                                        {log.errorCode ? (
                                            <a
                                                href={getDocsUrl(log.errorCode)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${log.errorCode.includes('ERR')
                                                    ? 'text-destructive hover:bg-destructive/10 border-destructive/20'
                                                    : 'text-primary hover:bg-primary/10 border-primary/20'
                                                    }`}
                                            >
                                                {log.errorCode}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground mr-4">Strona {page} z {totalPages} ({total} zdarzeń)</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || isLoading}
                        className="bg-background"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || isLoading}
                        className="bg-background"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
