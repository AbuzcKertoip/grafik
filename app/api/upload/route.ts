import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { v4 as uuidv4 } from "uuid";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { role, departmentId } = session.user as any;
    let isAdmin = role === "ADMIN" || role === "HR" || hasPermission(session.user as any, "manage_fleet");

    if (!isAdmin && role === 'MANAGER' && departmentId) {
        const userDept = await prisma.department.findUnique({
            where: { id: parseInt(departmentId.toString()) }
        });
        if (userDept && userDept.name.toUpperCase() === 'HR') {
            isAdmin = true;
        }
    }

    if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generowanie unikalnej nazwy pliku
        const fileExtension = path.extname(file.name);
        const fileName = `${uuidv4()}${fileExtension}`;
        
        // Ścieżka katalogu docelowego w 'public'
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'repairs');
        const filePath = path.join(uploadDir, fileName);

        // Upewnienie się, że katalog docelowy istnieje
        await mkdir(uploadDir, { recursive: true });

        // Zapis pliku
        await writeFile(filePath, buffer);

        // Zwracanie ścieżki dostępnej publicznie z poziomu przeglądarki
        const fileUrl = `/uploads/repairs/${fileName}`;

        return NextResponse.json({ success: true, url: fileUrl });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
