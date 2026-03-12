"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from "date-fns"
import { getBusinessDaysCount } from "../holidays"
import { hasPermission } from "@/lib/auth/permissions"

// Helper to check permissions
async function checkReportAccess(departmentId?: number) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        throw new Error("Brak autoryzacji")
    }

    const role = session.user.role
    if (role !== "ADMIN" && role !== "MANAGER" && !hasPermission(session.user as any, "view_reports")) {
        throw new Error("Brak uprawnień")
    }

    // Optional: Manager can only see their department
    if (role === "MANAGER") {
        const user = await prisma.user.findUnique({ where: { id: parseInt(session.user.id) } })
        if (departmentId && user?.departmentId !== departmentId && user?.secondaryDepartmentId !== departmentId) {
            throw new Error("Odmowa dostępu do innego działu")
        }
        return departmentId || null // Managers must specify a target department, or we get complicated. In current codebase, they always pass it or null. If null, we might limit it further down. But let's just return what they asked for if allowed.
    }

    return departmentId
}

export type WorkTimeReportRow = {
    userId: number
    name: string
    department: string
    totalHours: number
    totalOvertime: number
    regularHours: number
}

export async function getWorkTimeReport(year: number, month: number, departmentId?: number): Promise<WorkTimeReportRow[]> {
    const targetDepartmentId = await checkReportAccess(departmentId)

    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)

    const users = await prisma.user.findMany({
        where: {
            OR: targetDepartmentId ? [
                { departmentId: targetDepartmentId },
                { secondaryDepartmentId: targetDepartmentId }
            ] : undefined,
            role: { not: "ADMIN" } // Exclude admins from reports usually
        },
        include: {
            department: true,
            workLogs: {
                where: {
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            }
        },
        orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' }
        ]
    })

    return users.map(user => {
        const totalHours = user.workLogs.reduce((sum, log) => sum + (log.duration || 0), 0)
        const totalOvertime = user.workLogs.reduce((sum, log) => sum + (log.overtime || 0), 0)
        return {
            userId: user.id,
            name: user.name || user.username,
            department: user.department?.name || "-",
            totalHours,
            totalOvertime,
            regularHours: totalHours - totalOvertime
        }
    })
}

export type VacationReportRow = {
    userId: number
    name: string
    department: string
    limit: number
    carriedOver: number
    usedThisYear: number
    pendingThisYear: number
    remaining: number
}

export async function getVacationsReport(year: number, departmentId?: number): Promise<VacationReportRow[]> {
    const targetDepartmentId = await checkReportAccess(departmentId)

    const startDate = startOfYear(new Date(year, 0, 1))
    const endDate = endOfYear(new Date(year, 0, 1))

    const users = await prisma.user.findMany({
        where: {
            OR: targetDepartmentId ? [
                { departmentId: targetDepartmentId },
                { secondaryDepartmentId: targetDepartmentId }
            ] : undefined,
            role: { not: "ADMIN" }
        },
        include: {
            department: true,
            vacations: {
                where: {
                    type: "VACATION",
                    startDate: { gte: startDate },
                    endDate: { lte: endDate }
                }
            }
        },
        orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' }
        ]
    })

    return users.map(user => {
        let usedThisYear = 0
        let pendingThisYear = 0

        user.vacations.forEach(v => {
            const diffDays = getBusinessDaysCount(v.startDate, v.endDate)

            if (v.status === "APPROVED") {
                usedThisYear += diffDays
            } else if (v.status === "PENDING") {
                pendingThisYear += diffDays
            }
        })

        const totalAvailable = user.vacationDaysLimit + user.carriedOverVacationDays
        const remaining = totalAvailable - usedThisYear

        return {
            userId: user.id,
            name: user.name || user.username,
            department: user.department?.name || "-",
            limit: user.vacationDaysLimit,
            carriedOver: user.carriedOverVacationDays,
            usedThisYear,
            pendingThisYear,
            remaining
        }
    })
}

export type AlertReportData = {
    medicalExams: Array<{
        userId: number
        name: string
        type: string
        validUntil: Date
        daysRemaining: number
    }>
    cars: Array<{
        carId: number
        make: string
        model: string
        plate: string
        inspectionValidUntil: Date
        insuranceValidUntil: Date
        inspectionDaysRemaining: number
        insuranceDaysRemaining: number
    }>
}

export async function getAlertsReport(departmentId?: number): Promise<AlertReportData> {
    const targetDepartmentId = await checkReportAccess(departmentId)
    const now = new Date()
    const alertThresholdDate = addMonths(now, 2) // Alert for things expiring in next 2 months

    const medicalExams = await prisma.medicalExam.findMany({
        where: {
            validUntil: { lte: alertThresholdDate },
            user: targetDepartmentId ? {
                OR: [
                    { departmentId: targetDepartmentId },
                    { secondaryDepartmentId: targetDepartmentId }
                ]
            } : undefined
        },
        include: { user: true },
        orderBy: { validUntil: 'asc' }
    })

    let cars: any[] = []

    // Only Admin or Manager without specific department restriction sees cars usually,
    // or if cars are assigned to users in the department. Let's show all active cars for now.
    // Assuming Manager can see cars assigned to their department's users.
    if (!targetDepartmentId) {
        cars = await prisma.car.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    { inspectionValidUntil: { lte: alertThresholdDate } },
                    { insuranceValidUntil: { lte: alertThresholdDate } }
                ]
            },
            orderBy: [
                { inspectionValidUntil: 'asc' }
            ]
        })
    } else {
        cars = await prisma.car.findMany({
            where: {
                status: "ACTIVE",
                caretaker: {
                    OR: [
                        { departmentId: targetDepartmentId },
                        { secondaryDepartmentId: targetDepartmentId }
                    ]
                },
                OR: [
                    { inspectionValidUntil: { lte: alertThresholdDate } },
                    { insuranceValidUntil: { lte: alertThresholdDate } }
                ]
            },
            orderBy: [
                { inspectionValidUntil: 'asc' }
            ]
        })
    }

    const typeMapping: Record<string, string> = {
        'MEDICINE_WORK': 'Medycyna Pracy',
        'SANITARY': 'Sanepid',
        'SAFETY_TRAINING': 'BHP'
    }

    return {
        medicalExams: medicalExams.map(exam => {
            const diffTime = exam.validUntil.getTime() - now.getTime()
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return {
                userId: exam.userId,
                name: exam.user.name || exam.user.username,
                type: typeMapping[exam.type] || exam.type,
                validUntil: exam.validUntil,
                daysRemaining
            }
        }),
        cars: cars.map(car => {
            const inspDiffTime = car.inspectionValidUntil.getTime() - now.getTime()
            const insDiffTime = car.insuranceValidUntil.getTime() - now.getTime()
            return {
                carId: car.id,
                make: car.make,
                model: car.model,
                plate: car.plate,
                inspectionValidUntil: car.inspectionValidUntil,
                insuranceValidUntil: car.insuranceValidUntil,
                inspectionDaysRemaining: Math.ceil(inspDiffTime / (1000 * 60 * 60 * 24)),
                insuranceDaysRemaining: Math.ceil(insDiffTime / (1000 * 60 * 60 * 24))
            }
        })
    }
}
