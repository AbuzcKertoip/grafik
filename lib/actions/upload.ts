"use server"

import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

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
