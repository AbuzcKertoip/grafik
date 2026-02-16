"use client"

import { useState, useEffect, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createWorkLog, updateWorkLog } from "@/lib/actions/work-logs"
import { useRouter } from "next/navigation"
import { differenceInMinutes, parse } from "date-fns"

interface WorkLogDialogProps {
    log?: any
    date: Date
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function WorkLogDialog({ log, date, open, onOpenChange }: WorkLogDialogProps) {
    const router = useRouter()
    const isEdit = !!log

    const [formData, setFormData] = useState({
        description: "",
        project: "",
        startTime: "08:00",
        endTime: "16:00",
        duration: 8,
        overtime: 0,
    })

    const [quickEntry, setQuickEntry] = useState("")

    useEffect(() => {
        setQuickEntry("")
        if (log) {
            setFormData({
                description: log.description || "",
                project: log.project || "",
                startTime: log.startTime || "08:00",
                endTime: log.endTime || "16:00",
                duration: log.duration || 0,
                overtime: log.overtime || 0,
            })
        } else {
            setFormData({
                description: "",
                project: "",
                startTime: "08:00",
                endTime: "16:00",
                duration: 8,
                overtime: 0,
            })
        }
    }, [log, open])

    const calculateDuration = (start: string, end: string) => {
        try {
            const now = new Date()
            const s = parse(start, 'HH:mm', now)
            const e = parse(end, 'HH:mm', now)
            const diff = differenceInMinutes(e, s)
            const hours = diff / 60
            return hours > 0 ? hours : 0
        } catch (e) {
            return 0
        }
    }

    const handleQuickEntryChange = (value: string) => {
        setQuickEntry(value)

        // Regex handles "8-16", "08-16", "8:30-16:30", with optional spaces
        const match = value.match(/^(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)$/)

        if (match) {
            let start = match[1]
            let end = match[2]

            const formatTime = (t: string) => {
                if (!t.includes(':')) {
                    return t.padStart(2, '0') + ":00"
                }
                const [h, m] = t.split(':')
                return h.padStart(2, '0') + ":" + m
            }

            const startTime = formatTime(start)
            const endTime = formatTime(end)

            const total = calculateDuration(startTime, endTime)
            // Default rule: max 8h regular, rest is overtime
            const duration = Math.min(total, 8)
            const overtime = Math.max(0, total - 8)

            setFormData(prev => ({
                ...prev,
                startTime,
                endTime,
                duration,
                overtime
            }))
        }
    }

    const handleChange = (field: string, value: string | number) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value }
            if (field === 'startTime' || field === 'endTime') {
                const total = calculateDuration(next.startTime as string, next.endTime as string)
                next.duration = Math.min(total, 8)
                next.overtime = Math.max(0, total - 8)
            }
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const payload = {
            ...formData,
            date: date.toISOString(),
        }

        let result
        if (isEdit) {
            result = await updateWorkLog(log.id, payload)
        } else {
            result = await createWorkLog(payload)
        }

        if (result?.success) {
            onOpenChange(false)
            router.refresh()
        } else {
            alert("Błąd zapisu")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edytuj wpis" : "Dodaj wpis"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quickEntry" className="text-right text-blue-600">Szybkie</Label>
                        <Input
                            id="quickEntry"
                            placeholder="np. 8-19"
                            value={quickEntry}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleQuickEntryChange(e.target.value)}
                            className="col-span-3 border-blue-200 focus:border-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="startTime" className="text-right">Od</Label>
                        <Input
                            id="startTime"
                            type="time"
                            value={formData.startTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("startTime", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="endTime" className="text-right">Do</Label>
                        <Input
                            id="endTime"
                            type="time"
                            value={formData.endTime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("endTime", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="duration" className="text-right">Czas (h)</Label>
                        <Input
                            id="duration"
                            type="number"
                            step="0.5"
                            value={formData.duration}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("duration", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="overtime" className="text-right">Nadgodziny</Label>
                        <Input
                            id="overtime"
                            type="number"
                            step="0.5"
                            value={formData.overtime}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("overtime", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="project" className="text-right">Projekt</Label>
                        <Input
                            id="project"
                            value={formData.project}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("project", e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="description" className="text-right pt-2">Opis</Label>
                        <Textarea
                            id="description"
                            rows={3}
                            value={formData.description}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange("description", e.target.value)}
                            //...
                            className="col-span-3"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit">Zapisz</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
