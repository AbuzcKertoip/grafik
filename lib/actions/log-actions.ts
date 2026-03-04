"use server"

import { prisma as db } from "@/lib/prisma"
import { ErrorCodeKey, ERROR_CODES } from "@/lib/error-codes"

interface CreateLogProps {
    action: string;
    description: string;
    userId?: number;
    errorCodeKey?: ErrorCodeKey;
    details?: Record<string, any>;
}

export async function createLog({
    action,
    description,
    userId,
    errorCodeKey,
    details
}: CreateLogProps) {
    try {
        let errorCode = undefined;
        if (errorCodeKey) {
            errorCode = ERROR_CODES[errorCodeKey]?.code;
        }

        const log = await db.systemLog.create({
            data: {
                action,
                description,
                userId,
                errorCode,
                details: details ? JSON.stringify(details) : undefined,
            }
        })

        return { success: true, log }
    } catch (error) {
        console.error("Failed to create system log:", error)
        return { success: false, error: "Failed to create log" }
    }
}

export async function getSystemLogs(limit = 100, offset = 0) {
    try {
        const logs = await db.systemLog.findMany({
            take: limit,
            skip: offset,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    }
                }
            }
        })

        const total = await db.systemLog.count()

        return {
            success: true,
            logs,
            total,
            hasMore: offset + logs.length < total
        }
    } catch (error) {
        console.error("Failed to fetch system logs:", error)
        return { success: false, error: "Failed to fetch logs", logs: [], total: 0, hasMore: false }
    }
}
