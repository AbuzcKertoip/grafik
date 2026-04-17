"use server"

import { writeFile, unlink, mkdir } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { isFleetAdmin } from "@/lib/actions/fleet"

export async function uploadAvatar(userId: number, formData: FormData) {
    const session = await getServerSession(authOptions)

    // Authorization: User can update their own, Admin can update anyone's
    if (!session || (session.user.role !== 'ADMIN' && parseInt(session.user.id) !== userId)) {
        return { error: "Brak uprawnień" }
    }

    const file = formData.get("file") as File
    if (!file) {
        return { error: "Nie wybrano pliku" }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Ensure directory exists
    const relativeUploadDir = `/uploads/avatars`
    const uploadDir = join(process.cwd(), "public", relativeUploadDir)

    try {
        await mkdir(uploadDir, { recursive: true })

        const timestamp = Date.now()
        const filename = `${userId}-${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`
        const filepath = join(uploadDir, filename)

        await writeFile(filepath, buffer)

        const imageUrl = `${relativeUploadDir}/${filename}`

        // Update User in DB
        await (prisma as any).user.update({
            where: { id: userId },
            data: { image: imageUrl }
        })

        revalidatePath("/dashboard/profile")
        revalidatePath("/dashboard/hr")

        return { success: true, imageUrl }
    } catch (e) {
        console.error("Upload error:", e)
        return { error: "Błąd podczas przesyłania pliku" }
    }
}

export async function uploadCarPolicyScan(
    carId: number,
    type: "oc" | "ac",
    formData: FormData
) {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
        return { error: "Brak uprawnień" }
    }

    const file = formData.get("file") as File
    if (!file) {
        return { error: "Nie wybrano pliku" }
    }

    if (file.type !== "application/pdf") {
        return { error: "Dozwolone są tylko pliki PDF" }
    }

    if (file.size > 10 * 1024 * 1024) {
        return { error: "Plik nie może przekraczać 10 MB" }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const relativeUploadDir = `/uploads/policies`
    const uploadDir = join(process.cwd(), "public", relativeUploadDir)

    try {
        await mkdir(uploadDir, { recursive: true })

        const timestamp = Date.now()
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
        const filename = `car-${carId}-${type}-${timestamp}-${safeFilename}`
        const filepath = join(uploadDir, filename)

        await writeFile(filepath, buffer)

        const fileUrl = `/api/uploads/policies/${filename}`

        const fieldName = type === "oc" ? "policyUrl" : "acPolicyUrl"

        // Remove old file if exists
        const existing = await (prisma as any).car.findUnique({ where: { id: carId }, select: { [fieldName]: true } })
        if (existing?.[fieldName]) {
            // Convert /uploads/... to actual filesystem path
            const relPath = existing[fieldName].startsWith('/api/uploads') ? 
                existing[fieldName].replace(/^\/api\/uploads/, "/uploads") : 
                existing[fieldName];
            const oldPath = join(process.cwd(), "public", relPath)
            try { await unlink(oldPath) } catch { /* ignore if not found */ }
        }

        await (prisma as any).car.update({
            where: { id: carId },
            data: { [fieldName]: fileUrl }
        })

        revalidatePath("/dashboard/fleet")
        return { success: true, fileUrl }
    } catch (e) {
        console.error("Policy upload error:", e)
        return { error: "Błąd podczas przesyłania pliku" }
    }
}

export async function deleteCarPolicyScan(carId: number, type: "oc" | "ac") {
    const session = await getServerSession(authOptions)
    if (!await isFleetAdmin(session)) {
        return { error: "Brak uprawnień" }
    }

    const fieldName = type === "oc" ? "policyUrl" : "acPolicyUrl"

    try {
        const car = await (prisma as any).car.findUnique({ where: { id: carId }, select: { [fieldName]: true } })
        if (car?.[fieldName]) {
            const relPath = car[fieldName].startsWith('/api/uploads') ? 
                car[fieldName].replace(/^\/api\/uploads/, "/uploads") : 
                car[fieldName];
            const oldPath = join(process.cwd(), "public", relPath)
            try { await unlink(oldPath) } catch { /* ignore */ }
        }

        await (prisma as any).car.update({
            where: { id: carId },
            data: { [fieldName]: null }
        })

        revalidatePath("/dashboard/fleet")
        return { success: true }
    } catch (e) {
        console.error("Policy delete error:", e)
        return { error: "Błąd podczas usuwania pliku" }
    }
}
