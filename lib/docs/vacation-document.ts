import { Document, Paragraph, TextRun, Packer, AlignmentType, UnderlineType } from "docx";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

function formatDatePL(date: Date | string) {
    return new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(date)).replace(/\//g, ".");
}

function getVacationTypeName(type: string): string {
    switch (type) {
        case "VACATION": return "wypoczynkowego";
        case "ON_DEMAND": return "wypoczynkowego (na żądanie)";
        case "SPECIAL_LEAVE": return "okolicznościowego";
        case "CHILDCARE": return "opiekuńczego";
        case "SICK": return "rehabilitacyjnego (zwolnienie)";
        case "ADDITIONAL": return "dodatkowego";
        case "UNPAID": return "bezpłatnego";
        case "OVERTIME": return "odbioru nadgodzin";
        default: return "wypoczynkowego";
    }
}

export async function generateVacationDoc(vacation: any, user: any, totalDays: number): Promise<Buffer> {
    const dzial = user.department?.name || "";
    // Use createdAt if available, otherwise fallback to startDate or current date
    const applicationDate = formatDatePL(vacation.createdAt || new Date());
    const imieNazwisko = user.name || user.username || "";
    const startDate = formatDatePL(vacation.startDate);
    const endDate = formatDatePL(vacation.endDate);
    const year = new Date(vacation.startDate).getFullYear().toString();
    const typeName = getVacationTypeName(vacation.type);
    const godziny = totalDays * 8;
    const dniLabel = totalDays === 1 ? " dzień " : " dni ";
    
    // Wzór oryginalnego "wniosek-o-urlop.doc":
    // . . . . . . . . . . . . . . . . . . . . . . . . .        . . . . . . . . . . . . . . . . . . . . . . .
    //         (imię i nazwisko)       (miejscowość i data) 
    //    
    // . . . . . . . . . . . . . . . . . . . . . . . . .       
    //         (nazwa działu)  
    // 
    // Wniosek o urlop
    // Niniejszym składam wniosek o udzielenie w dniach od . . . . . . . . . . . . . . . . . . do . . . . . . . . . . . . . . . . . . 
    // przysługującego za rok . . . . . . . urlopu wypoczynkowego / okolicznościowego / rehabilitacyjnego / opiekuńczego / szkoleniowego *) 
    // (ogółem . . . . . dni . . . . . godzin).
    // 
    // . . . . . . . . . . . . . . . . . . . . . . . . .       . . . . . . . . . . . . . . . . . . . . . . . . .
    //         (podpis kierownika)     (podpis pracownika)     
    // *) niepotrzebne skreślić

    const doc = new Document({
        creator: "System HR4YOU",
        title: "Wniosek o urlop",
        description: `Wniosek urlopowy - ${imieNazwisko}`,
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({ text: imieNazwisko.padEnd(50, " "), underline: { type: UnderlineType.SINGLE } }),
                        new TextRun({ text: "\t\t\t\t\t" }), // Tab spacing to push date to the right
                        new TextRun({ text: applicationDate.padEnd(30, " "), underline: { type: UnderlineType.SINGLE } }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({ text: "(imię i nazwisko)".padEnd(50, " "), size: 20, color: "666666" }),
                        new TextRun({ text: "\t\t\t\t\t\t" }),
                        new TextRun({ text: "(miejscowość i data)".padEnd(30, " "), size: 20, color: "666666" }),
                    ],
                }),
                new Paragraph({ text: "" }), // empty line
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: dzial.padEnd(50, " "), underline: { type: UnderlineType.SINGLE } }),
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                        new TextRun({ text: "(nazwa działu)".padEnd(50, " "), size: 20, color: "666666" }),
                    ]
                }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "Wniosek o urlop", bold: true, size: 36 }),
                    ]
                }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: 360 }, // 1.5 line spacing
                    children: [
                        new TextRun({ text: "Niniejszym składam wniosek o udzielenie w dniach od " }),
                        new TextRun({ text: startDate, underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: " do " }),
                        new TextRun({ text: endDate, underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: " przysługującego za rok " }),
                        new TextRun({ text: year, underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: " urlopu " }),
                        new TextRun({ text: typeName, underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: " (ogółem " }),
                        new TextRun({ text: totalDays.toString(), underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: dniLabel }),
                        new TextRun({ text: godziny.toString(), underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: " godzin)." }),
                    ]
                }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({ text: "" }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({ text: "Zatwierdzono w Systemie HR".padEnd(50, " "), underline: { type: UnderlineType.SINGLE }, bold: true }),
                        new TextRun({ text: "\t\t\t\t\t" }),
                        new TextRun({ text: `Złożono w Systemie HR: ${applicationDate}`.padEnd(45, " "), underline: { type: UnderlineType.SINGLE }, bold: true }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({ text: "(podpis kierownika)".padEnd(50, " "), size: 20, color: "666666" }),
                        new TextRun({ text: "\t\t\t\t\t\t" }),
                        new TextRun({ text: "(podpis pracownika)".padEnd(45, " "), size: 20, color: "666666" }),
                    ],
                }),
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer as Buffer;
}
