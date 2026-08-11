import { AcademicScheduleSlot, DayOfWeek, Room } from '../types';

export interface ParseTimetableResult {
  slots: AcademicScheduleSlot[];
  errors: string[];
  summary: {
    totalRowsProcessed: number;
    validSlotsCount: number;
    roomsAffected: string[];
  };
}

// Convert day string to valid DayOfWeek
function mapToDayOfWeek(rawDay: string): DayOfWeek | null {
  const clean = rawDay.trim().toUpperCase();
  if (clean === 'MON' || clean === 'ISNIN') return 'Isnin';
  if (clean === 'TUE' || clean === 'SELASA') return 'Selasa';
  if (clean === 'WED' || clean === 'RABU') return 'Rabu';
  if (clean === 'THU' || clean === 'KHAMIS') return 'Khamis';
  if (clean === 'FRI' || clean === 'JUMAAT') return 'Jumaat';
  if (clean === 'SAT' || clean === 'SABTU') return 'Sabtu';
  if (clean === 'SUN' || clean === 'AHAD') return 'Ahad';
  return null;
}

// Format time HH:MM (e.g. "8:30" -> "08:30")
function formatTimeStr(tStr: string): string {
  const clean = tStr.trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  const hour = parts[0].padStart(2, '0');
  const min = parts[1].padStart(2, '0');
  return `${hour}:${min}`;
}

export function parseTimetableCSV(csvText: string, existingRooms: Room[]): ParseTimetableResult {
  const errors: string[] = [];
  const validSlots: AcademicScheduleSlot[] = [];
  const affectedRoomIds = new Set<string>();

  // Helper to split CSV lines safely considering quotes
  const lines = csvText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return {
      slots: [],
      errors: ['Fail CSV kosong atau tiada kandungan selepas pengepala.'],
      summary: { totalRowsProcessed: 0, validSlotsCount: 0, roomsAffected: [] }
    };
  }

  // Detect header format
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';

  // Parse CSV line taking quotes into account
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());

  // Check if College Timetable Unit CSV format (table_id, hari, slot, masa, ...)
  const isCollegeUnitFormat = headers.includes('table_id') || headers.includes('nilai_asal');

  if (isCollegeUnitFormat) {
    const tableIdIdx = headers.indexOf('table_id');
    const hariIdx = headers.indexOf('hari');
    const masaIdx = headers.indexOf('masa');
    const mergedIdx = headers.indexOf('merged_range');
    const nilaiIdx = headers.indexOf('nilai_asal');

    // First pass: scan table_ids to map Table X to Room IDs
    const tableToRoomMap = new Map<string, string>();
    
    // Default mapping: Table 1 -> BK01, Table 2 -> BK02 ... Table 28 -> BK28
    for (let i = 1; i <= 28; i++) {
      const code = `BK${i < 10 ? '0' + i : i}`;
      tableToRoomMap.set(`Table ${i}`, code);
      tableToRoomMap.set(`Table${i}`, code);
    }
    // Table 29, 30 defaults
    tableToRoomMap.set('Table 29', 'DKA');
    tableToRoomMap.set('Table 30', 'DKB');

    // Scan header lines for explicit room titles like "SURAU 2", "DKA", etc.
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const tableId = cols[tableIdIdx] || '';
      const nilai = cols[nilaiIdx] || '';

      if (!tableId) continue;

      const upperNilai = nilai.toUpperCase();
      existingRooms.forEach(room => {
        if (upperNilai.includes(room.code.toUpperCase()) || upperNilai.includes(room.id.toUpperCase())) {
          tableToRoomMap.set(tableId, room.id);
        }
      });
    }

    // Second pass: Parse schedule rows
    let slotCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const tableId = cols[tableIdIdx] || '';
      const rawHari = cols[hariIdx] || '';
      const rawMasa = cols[masaIdx] || '';
      const mergedRange = cols[mergedIdx] || '';
      const nilaiAsal = cols[nilaiIdx] || '';

      if (!tableId || !rawHari || !nilaiAsal) continue;

      const dayOfWeek = mapToDayOfWeek(rawHari);
      if (!dayOfWeek) continue;

      // Filter out non-academic entries
      const upperNilai = nilaiAsal.toUpperCase();
      if (
        upperNilai.includes('FRIDAY') || 
        upperNilai.includes('ASSEMBLY') || 
        upperNilai.includes('LUNCH') ||
        upperNilai.includes('KOLEJ PROFESIONAL MARA') ||
        upperNilai.trim() === 'MON' || upperNilai.trim() === 'TUE' || upperNilai.trim() === 'WED' || upperNilai.trim() === 'THU' || upperNilai.trim() === 'FRI'
      ) {
        continue;
      }

      // Map room ID
      const mappedRoomId = tableToRoomMap.get(tableId);
      let roomId = mappedRoomId;
      if (!roomId) {
        const numMatch = tableId.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          roomId = `BK${num < 10 ? '0' + num : num}`;
        } else {
          roomId = tableId;
        }
      }

      // Check if valid room exists
      const targetRoom = existingRooms.find(r => r.id.toUpperCase() === roomId?.toUpperCase() || r.code.toUpperCase() === roomId?.toUpperCase());
      const finalRoomId = targetRoom ? targetRoom.id : (roomId || 'BK01');

      // Parse time
      let startTime = '08:30';
      let endTime = '09:30';

      if (rawMasa.includes('-')) {
        const timeParts = rawMasa.split('-').map(t => t.trim());
        startTime = formatTimeStr(timeParts[0]);
        endTime = formatTimeStr(timeParts[1]);
      } else if (rawMasa) {
        startTime = formatTimeStr(rawMasa);
        if (mergedRange && mergedRange.includes(':')) {
          const rangeParts = mergedRange.split(':');
          const startCol = rangeParts[0].charAt(0);
          const endCol = rangeParts[1].charAt(0);
          const colSpan = Math.max(1, endCol.charCodeAt(0) - startCol.charCodeAt(0) + 1);
          
          const [sH, sM] = startTime.split(':').map(Number);
          const durationHours = Math.max(1, Math.min(3, Math.floor(colSpan / 2)));
          const eH = sH + durationHours;
          endTime = `${String(eH).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}`;
        } else {
          const [sH, sM] = startTime.split(':').map(Number);
          endTime = `${String(sH + 1).padStart(2, '0')}:${String(sM || 0).padStart(2, '0')}`;
        }
      }

      // Parse course, class, lecturer from multiline nilai_asal
      const nilaiLines = nilaiAsal.split(/\r\n|\n|\\n/).map(l => l.trim()).filter(l => l.length > 0);
      const courseCode = nilaiLines[0] || 'AKADEMIK';
      const className = nilaiLines[1] || '';
      const lecturerName = nilaiLines.slice(2).join(' ') || 'Pensyarah KPMBP';

      validSlots.push({
        id: `SCH-CSV-${Date.now()}-${slotCounter++}`,
        roomId: finalRoomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode,
        courseName: courseCode,
        className,
        lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(finalRoomId);
    }
  } else {
    // Standard format CSV (roomId, dayOfWeek, startTime, endTime, courseCode, className, lecturerName)
    const findIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
    const roomIdx = findIndex(['room', 'bilik', 'dewan']);
    const dayIdx = findIndex(['day', 'hari']);
    const startIdx = findIndex(['start', 'mula']);
    const endIdx = findIndex(['end', 'tamat']);
    const courseIdx = findIndex(['course', 'kursus', 'kod']);
    const classIdx = findIndex(['class', 'kelas']);
    const lecturerIdx = findIndex(['lecturer', 'pensyarah', 'nama']);

    let slotCounter = 1;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const rawRoom = roomIdx !== -1 ? cols[roomIdx] : cols[0];
      const rawDay = dayIdx !== -1 ? cols[dayIdx] : cols[1];
      const rawStart = startIdx !== -1 ? cols[startIdx] : cols[2];
      const rawEnd = endIdx !== -1 ? cols[endIdx] : cols[3];
      const courseCode = courseIdx !== -1 ? cols[courseIdx] : cols[4] || 'AKADEMIK';
      const className = classIdx !== -1 ? cols[classIdx] : cols[5] || '';
      const lecturerName = lecturerIdx !== -1 ? cols[lecturerIdx] : cols[6] || 'Pensyarah';

      if (!rawRoom || !rawDay || !rawStart) continue;

      const dayOfWeek = mapToDayOfWeek(rawDay);
      if (!dayOfWeek) {
        errors.push(`Baris ${i + 1}: Hari "${rawDay}" tidak sah.`);
        continue;
      }

      const startTime = formatTimeStr(rawStart);
      const endTime = rawEnd ? formatTimeStr(rawEnd) : `${String(parseInt(startTime.split(':')[0], 10) + 1).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;

      const targetRoom = existingRooms.find(r => r.id.toUpperCase() === rawRoom.toUpperCase() || r.code.toUpperCase() === rawRoom.toUpperCase());
      const finalRoomId = targetRoom ? targetRoom.id : rawRoom;

      validSlots.push({
        id: `SCH-CSV-${Date.now()}-${slotCounter++}`,
        roomId: finalRoomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode,
        courseName: courseCode,
        className,
        lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(finalRoomId);
    }
  }

  return {
    slots: validSlots,
    errors,
    summary: {
      totalRowsProcessed: lines.length - 1,
      validSlotsCount: validSlots.length,
      roomsAffected: Array.from(affectedRoomIds)
    }
  };
}
