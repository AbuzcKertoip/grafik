import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path } = await params
        const filePath = join(process.cwd(), "public", "uploads", ...path)

        // Security: prevent path traversal
        const uploadsDir = join(process.cwd(), "public", "uploads")
        if (!filePath.startsWith(uploadsDir)) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        if (!existsSync(filePath)) {
            return new NextResponse("Not found", { status: 404 })
        }

        const fileBuffer = await readFile(filePath)
        const fileName = path[path.length - 1]
        const ext = fileName.split(".").pop()?.toLowerCase()

        const mimeTypes: Record<string, string> = {
            pdf: "application/pdf",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
        }

        const contentType = mimeTypes[ext || ""] || "application/octet-stream"

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${fileName}"`,
                "Cache-Control": "private, max-age=3600",
            },
        })
    } catch (e) {
        console.error("File serve error:", e)
        return new NextResponse("Error", { status: 500 })
    }
}
