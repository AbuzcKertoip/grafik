import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MONTHS: Record<string, number> = {
  'styczeń': 0, 'stycznia': 0,
  'luty': 1, 'lutego': 1,
  'marzec': 2, 'marca': 2,
  'kwiecień': 3, 'kwietnia': 3,
  'maj': 4, 'maja': 4,
  'czerwiec': 5, 'czerwca': 5,
  'lipiec': 6, 'lipca': 6,
  'sierpień': 7, 'sierpnia': 7,
  'wrzesień': 8, 'września': 8,
  'październik': 9, 'października': 9,
  'listopad': 10, 'listopada': 10,
  'grudzień': 11, 'grudnia': 11
};

function parseMonth(text: string): number | null {
  const lower = text.toLowerCase();
  for (const [name, index] of Object.entries(MONTHS)) {
    if (lower.includes(name)) return index;
  }
  return null;
}

function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function main() {
  const isDryRun = !process.argv.includes('--execute');
  
  console.log(`Starting parsing... (Dry Run: ${isDryRun ? 'YES' : 'NO'})`);
  
  const wb = xlsx.readFile('Grafik Serwisanci.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  let currentMonth = -1;
  let currentYear = 2026;
  let colMap: Record<number, { year: number, month: number, day: number }> = {};
  
  const schedules: { name: string, date: Date, type: string }[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    const firstCol = String(row[0] || '').trim();
    
    if (firstCol.startsWith('Grafik -')) {
      const m = parseMonth(firstCol);
      if (m !== null) {
        currentMonth = m;
        const yearMatch = firstCol.match(/20\d{2}/);
        if (yearMatch) {
            currentYear = parseInt(yearMatch[0]);
        } else {
            currentYear = 2024; // Domyslny dla starych wpisow bez roku (np Grafik - Luty jako row 1)
        }

        i++;
        const headerRow = data[i];
        colMap = {};
        for (let col = 1; col < headerRow.length; col++) {
          const val = Number(headerRow[col]);
          if (!isNaN(val) && val > 0) {
            let m = currentMonth;
            let y = currentYear;
            
            if (col < 10 && val > 20) {
                m = currentMonth - 1;
                if (m < 0) { m = 11; y--; }
            } else if (col >= 20 && val < 15) {
                m = currentMonth + 1;
                if (m > 11) { m = 0; y++; }
            }
            colMap[col] = { year: y, month: m, day: val };
          }
        }
      }
      continue;
    }
    
    if (firstCol === 'Imię i Nazwisko' || firstCol === '') continue;
    if (firstCol.match(/\d+ -/) || firstCol.match(/^[A-Z] -/)) continue;
    if (firstCol.includes('Odebranie dnia')) continue;
    
    if (Object.keys(colMap).length > 0 && firstCol) {
      for (const colStr of Object.keys(colMap)) {
        const col = Number(colStr);
        const dateInfo = colMap[col];
        const rawVal = String(row[col] || '').trim().toUpperCase();
        
        let type = '';
        if (rawVal === '1') type = 'SHIFT_1';
        else if (rawVal === '2') type = 'SHIFT_2';
        else if (rawVal === 'D') type = 'DUTY';
        else if (rawVal === 'U') type = 'VACATION';
        else if (rawVal === 'L4') type = 'SICK';
        else if (rawVal === 'DW') type = 'OFF';
        
        if (!type) continue;
        
        const date = new Date(Date.UTC(dateInfo.year, dateInfo.month, dateInfo.day, 12, 0, 0));
        schedules.push({ name: firstCol, date, type });
      }
    }
  }
  
  const dbUsers = await prisma.user.findMany();
  const matchedSchedules: { userId: number, date: Date, type: string }[] = [];
  const missingUsers = new Set<string>();
  
  for (const s of schedules) {
    const normName = normalizeName(s.name);
    const dbUser = dbUsers.find(u => normalizeName(u.name || '') === normName);
    if (dbUser) {
      matchedSchedules.push({ userId: dbUser.id, date: s.date, type: s.type });
    } else {
      missingUsers.add(s.name);
    }
  }
  
  console.log(`Total entries mapped to existig users: ${matchedSchedules.length}`);
  if (missingUsers.size > 0) {
    console.log(`Skipped unmatched users from Excel:`, Array.from(missingUsers));
  }
  
  if (isDryRun) {
    console.log('Run with --execute to apply changes to the database.');
    return;
  }
  
  const userIds = Array.from(new Set(matchedSchedules.map(s => s.userId)));
  console.log('Deleting old 2026 schedule records for matched users...');
  
  const deleted = await prisma.scheduleDay.deleteMany({
    where: {
      userId: { in: userIds },
      date: {
        gte: new Date('2026-01-01T00:00:00Z'),
        lt: new Date('2027-01-01T00:00:00Z')
      }
    }
  });
  console.log(`Deleted ${deleted.count} old records.`);
  
  console.log('Inserting new records...');
  
  // Przekształcamy na unikanie duplikatów ze względu na nachodzące dni w arkuszach
  const uniqueSchedules = Array.from(
      new Map(matchedSchedules.filter(s => s.date.getFullYear() === 2026).map(s => [`${s.userId}_${s.date.getTime()}`, s]))
  .values());
  
  let insertedCount = 0;
  const chunkSize = 200;
  for (let i = 0; i < uniqueSchedules.length; i += chunkSize) {
    const chunk = uniqueSchedules.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map(data => prisma.scheduleDay.create({ data }))
    );
    insertedCount += chunk.length;
  }
  console.log(`Inserted ${insertedCount} new schedule records successfully!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
