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
export function mapToDayOfWeek(rawDay: string): DayOfWeek | null {
  if (!rawDay) return null;
  const clean = rawDay.trim().toUpperCase();
  if (clean.includes('MON') || clean.includes('ISNIN') || clean === '1') return 'Isnin';
  if (clean.includes('TUE') || clean.includes('SELASA') || clean === '2') return 'Selasa';
  if (clean.includes('WED') || clean.includes('RABU') || clean === '3') return 'Rabu';
  if (clean.includes('THU') || clean.includes('KHAMIS') || clean === '4') return 'Khamis';
  if (clean.includes('FRI') || clean.includes('JUMAAT') || clean === '5') return 'Jumaat';
  if (clean.includes('SAT') || clean.includes('SABTU') || clean === '6') return 'Sabtu';
  if (clean.includes('SUN') || clean.includes('AHAD') || clean === '7') return 'Ahad';
  return null;
}

// Format time HH:MM (e.g. "8:30" -> "08:30")
export function formatTimeStr(tStr: string): string {
  const clean = tStr.trim();
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  const hour = parts[0].padStart(2, '0');
  const min = parts[1].padStart(2, '0');
  return `${hour}:${min}`;
}

// Parse header time string (e.g. "8:30AM", "12:30AM", "1:30PM", "5:30 PM", "8:30") into { start, end }
export function parseHeaderTimeSlot(headerStr: string): { startTime: string; endTime: string } | null {
  const clean = headerStr.trim().toUpperCase();
  
  // Explicit matches for standard master columns
  if (clean.startsWith('8:30') || clean.startsWith('08:30')) return { startTime: '08:30', endTime: '09:30' };
  if (clean.startsWith('9:30') || clean.startsWith('09:30')) return { startTime: '09:30', endTime: '10:30' };
  if (clean.startsWith('10:30')) return { startTime: '10:30', endTime: '11:30' };
  if (clean.startsWith('11:30')) return { startTime: '11:30', endTime: '12:30' };
  if (clean.startsWith('12:30')) return { startTime: '12:30', endTime: '13:30' };
  if (clean.startsWith('1:30') || clean.startsWith('13:30')) return { startTime: '13:30', endTime: '14:30' };
  if (clean.startsWith('2:30') || clean.startsWith('14:30')) return { startTime: '14:30', endTime: '15:30' };
  if (clean.startsWith('3:30') || clean.startsWith('15:30')) return { startTime: '15:30', endTime: '16:30' };
  if (clean.startsWith('4:30') || clean.startsWith('16:30')) return { startTime: '16:30', endTime: '17:30' };
  if (clean.startsWith('5:30') || clean.startsWith('17:30')) return { startTime: '17:30', endTime: '18:30' };

  // Generic range (e.g. 08:30-09:30)
  if (clean.includes('-')) {
    const [s, e] = clean.split('-').map(t => t.trim());
    return { startTime: formatTimeStr(s), endTime: formatTimeStr(e) };
  }

  return null;
}

// Smart extractor for cell contents: e.g. "LAW 2523 DLM 4B ADAM" or "LOG 3533 DLM 4E NOR LIZA BINTI RAMLIY CMILT"
export function parseCellAcademicDetails(rawContent: string): {
  courseCode: string;
  courseName: string;
  className: string;
  lecturerName: string;
} {
  const text = rawContent.trim();
  if (!text) {
    return { courseCode: 'AKADEMIK', courseName: 'Sesi Kuliah', className: '', lecturerName: 'Pensyarah KPMBP' };
  }

  // Handle multiline
  const lines = text.split(/\r\n|\n|\\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length >= 2) {
    const courseCode = lines[0];
    const className = lines[1] || '';
    const lecturerName = lines.slice(2).join(' ') || 'Pensyarah KPMBP';
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName
    };
  }

  // Single line with spaces
  // Regex 1: Matches pattern like "LAW 2523 DLM 4B ADAM" or "COM 2512 DIA 4B SOLAHUDDIN" or "LOG 2063 DLM 3C SYAKIRAH"
  const standardPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z0-9\/\s\-]+?)\s+([A-Z@\.\s\']+)$/i;
  const match = text.match(standardPattern);
  if (match) {
    const courseCode = match[1].trim();
    const className = match[2].trim();
    const lecturerName = match[3].trim();
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName
    };
  }

  // Regex 2: Matches "COM 2512 DIA 4C"
  const courseClassPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z0-9\/\s\-]+)$/i;
  const match2 = text.match(courseClassPattern);
  if (match2) {
    const courseCode = match2[1].trim();
    const className = match2[2].trim();
    return {
      courseCode,
      courseName: courseCode,
      className,
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  // Regex 3: Matches course code only "MGT 1013" or "LOG 1053"
  const courseOnlyPattern = /^([A-Z]{2,4}\s*\d{3,4}[A-Z]?)$/i;
  if (courseOnlyPattern.test(text)) {
    return {
      courseCode: text,
      courseName: text,
      className: '',
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  // Regex 4: Matches class code only like "DIA 4C" or "DLM 3B" or "DCAT 7C"
  const classOnlyPattern = /^([A-Z]{2,4}\s*\d[A-Z0-9]?(\/[A-Z0-9\s]+)?)$/i;
  if (classOnlyPattern.test(text)) {
    return {
      courseCode: 'KULIAH',
      courseName: `Kelas ${text}`,
      className: text,
      lecturerName: 'Pensyarah KPMBP'
    };
  }

  // Fallback: Lecturer name or General Activity (e.g. "AKMAL BINTI ARIFF@FAUZI" or "AFIF BIN MAMAT")
  return {
    courseCode: 'PENGAJIAN',
    courseName: 'Sesi Pembelajaran',
    className: '',
    lecturerName: text
  };
}

// Find matching Room ID in existing rooms
export function resolveRoomId(rawVenue: string, tableId: string, existingRooms: Room[]): string {
  const venueUpper = rawVenue.trim().toUpperCase();
  const tableUpper = tableId.trim().toUpperCase();

  // Try matching rawVenue with room code, id or name
  for (const r of existingRooms) {
    if (
      venueUpper === r.code.toUpperCase() ||
      venueUpper === r.id.toUpperCase() ||
      venueUpper === r.name.toUpperCase()
    ) {
      return r.id;
    }
  }

  // Normalized search (e.g. "MAKMAL ALFA", "SURAU 1", "ARAS 1 PERPUSTAKAAN", "DEWAN SEMINAR")
  for (const r of existingRooms) {
    const cleanR = r.code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const cleanV = venueUpper.replace(/[^A-Z0-9]/gi, '');
    if (cleanR === cleanV && cleanR.length > 0) {
      return r.id;
    }
  }

  // Try Table mapping
  if (tableUpper) {
    const numMatch = tableUpper.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      const bkCode = `BK${num < 10 ? '0' + num : num}`;
      const bkRoom = existingRooms.find(r => r.id === bkCode || r.code === bkCode);
      if (bkRoom) return bkRoom.id;
    }
  }

  // If room is something like "SURAU 1" -> "SURAU_1"
  const fallbackId = venueUpper.replace(/\s+/g, '_');
  const fallbackRoom = existingRooms.find(r => r.id === fallbackId);
  if (fallbackRoom) return fallbackRoom.id;

  return venueUpper || 'BK01';
}

export function parseTimetableCSV(csvText: string, existingRooms: Room[]): ParseTimetableResult {
  const errors: string[] = [];
  const validSlots: AcademicScheduleSlot[] = [];
  const affectedRoomIds = new Set<string>();

  const lines = csvText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return {
      slots: [],
      errors: ['Fail CSV kosong atau tiada baris data selepas pengepala (header).'],
      summary: { totalRowsProcessed: 0, validSlotsCount: 0, roomsAffected: [] }
    };
  }

  // Parse CSV line considering quotes
  const parseCSVLine = (line: string, delimiter: string): string[] => {
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

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const rawHeaders = parseCSVLine(headerLine, delimiter);
  const headers = rawHeaders.map(h => h.toLowerCase().trim());

  // Check Format 1: Master Matrix Format (Table X, Jadual Petempatan, Hari, 8:30AM, 9:30AM, ...)
  const isMasterMatrixFormat = headers.some(h => h.includes('petempatan') || h.includes('ruang') || h.includes('bilik')) &&
    headers.some(h => h.includes('8:30') || h.includes('08:30') || h.includes('9:30'));

  if (isMasterMatrixFormat || headers[1]?.includes('petempatan') || headers[0]?.includes('table')) {
    // Find column indexes
    let tableColIdx = 0;
    let roomColIdx = 1;
    let dayColIdx = 2;

    headers.forEach((h, idx) => {
      if (h.includes('table')) tableColIdx = idx;
      if (h.includes('petempatan') || h.includes('ruang') || h.includes('venue') || h.includes('bilik')) roomColIdx = idx;
      if (h.includes('hari') || h.includes('day')) dayColIdx = idx;
    });

    // Identify time slot columns from headers
    const timeSlotCols: { colIdx: number; startTime: string; endTime: string }[] = [];
    for (let col = 0; col < rawHeaders.length; col++) {
      if (col === tableColIdx || col === roomColIdx || col === dayColIdx) continue;
      const parsedSlot = parseHeaderTimeSlot(rawHeaders[col]);
      if (parsedSlot) {
        timeSlotCols.push({ colIdx: col, startTime: parsedSlot.startTime, endTime: parsedSlot.endTime });
      }
    }

    let slotCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const rawTable = cols[tableColIdx] || '';
      const rawRoom = cols[roomColIdx] || '';
      const rawDay = cols[dayColIdx] || '';

      if (!rawRoom && !rawTable) continue;
      const dayOfWeek = mapToDayOfWeek(rawDay);
      if (!dayOfWeek) continue;

      const roomId = resolveRoomId(rawRoom, rawTable, existingRooms);

      // Iterate each time slot column in this row
      for (const timeSlot of timeSlotCols) {
        const cellValue = cols[timeSlot.colIdx]?.trim();
        if (!cellValue) continue;

        // Filter out non-academic entries
        const upperVal = cellValue.toUpperCase();
        if (
          upperVal === 'MON' || upperVal === 'TUE' || upperVal === 'WED' || upperVal === 'THU' || upperVal === 'FRI' ||
          upperVal.includes('KOLEJ PROFESIONAL MARA') ||
          upperVal.includes('ASSEMBLY')
        ) {
          continue;
        }

        const parsedDetails = parseCellAcademicDetails(cellValue);

        validSlots.push({
          id: `SCH-CSV-${Date.now()}-${slotCounter++}`,
          roomId,
          dayOfWeek,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          courseCode: parsedDetails.courseCode,
          courseName: parsedDetails.courseName,
          className: parsedDetails.className,
          lecturerName: parsedDetails.lecturerName,
          department: 'Jabatan Akademik KPMBP'
        });

        affectedRoomIds.add(roomId);
      }
    }
  } else if (headers.includes('table_id') || headers.includes('nilai_asal')) {
    // Format 2: College Timetable Unit (table_id, hari, slot, masa, cell, merged_range, header_asal, nilai_asal)
    const tableIdIdx = headers.indexOf('table_id');
    const hariIdx = headers.indexOf('hari');
    const masaIdx = headers.indexOf('masa');
    const mergedIdx = headers.indexOf('merged_range');
    const nilaiIdx = headers.indexOf('nilai_asal');

    const tableToRoomMap = new Map<string, string>();
    for (let i = 1; i <= 28; i++) {
      const code = `BK${i < 10 ? '0' + i : i}`;
      tableToRoomMap.set(`Table ${i}`, code);
      tableToRoomMap.set(`Table${i}`, code);
    }
    tableToRoomMap.set('Table 29', 'MAKMAL_ALFA');
    tableToRoomMap.set('Table 30', 'MAKMAL_BETA');
    tableToRoomMap.set('Table 31', 'MAKMAL_SIGMA');
    tableToRoomMap.set('Table 32', 'MAKMAL_GAMMA');
    tableToRoomMap.set('Table 33', 'MAKMAL_DELTA');
    tableToRoomMap.set('Table 34', 'DKA');
    tableToRoomMap.set('Table 35', 'DKB');
    tableToRoomMap.set('Table 36', 'ARAS_1_PERPUSTAKAAN');
    tableToRoomMap.set('Table 37', 'BILIK_KOTA_TINGGI');
    tableToRoomMap.set('Table 38', 'DEWAN_SEMINAR');
    tableToRoomMap.set('Table 39', 'MINI_SEMINAR');
    tableToRoomMap.set('Table 40', 'SURAU_1');
    tableToRoomMap.set('Table 41', 'SURAU_2');

    let slotCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const tableId = cols[tableIdIdx] || '';
      const rawHari = cols[hariIdx] || '';
      const rawMasa = cols[masaIdx] || '';
      const mergedRange = cols[mergedIdx] || '';
      const nilaiAsal = cols[nilaiIdx] || '';

      if (!tableId || !rawHari || !nilaiAsal) continue;

      const dayOfWeek = mapToDayOfWeek(rawHari);
      if (!dayOfWeek) continue;

      const upperNilai = nilaiAsal.toUpperCase();
      if (
        upperNilai.includes('ASSEMBLY') || 
        upperNilai.includes('LUNCH') ||
        upperNilai.includes('KOLEJ PROFESIONAL MARA')
      ) {
        continue;
      }

      const roomId = tableToRoomMap.get(tableId) || resolveRoomId(tableId, tableId, existingRooms);
      const targetRoom = existingRooms.find(r => r.id.toUpperCase() === roomId.toUpperCase() || r.code.toUpperCase() === roomId.toUpperCase());
      const finalRoomId = targetRoom ? targetRoom.id : roomId;

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

      const parsedDetails = parseCellAcademicDetails(nilaiAsal);

      validSlots.push({
        id: `SCH-CSV-${Date.now()}-${slotCounter++}`,
        roomId: finalRoomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode: parsedDetails.courseCode,
        courseName: parsedDetails.courseName,
        className: parsedDetails.className,
        lecturerName: parsedDetails.lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(finalRoomId);
    }
  } else {
    // Format 3: Standard list (roomId, dayOfWeek, startTime, endTime, courseCode, className, lecturerName)
    const findIndex = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
    const roomIdx = findIndex(['room', 'bilik', 'dewan', 'petempatan']);
    const dayIdx = findIndex(['day', 'hari']);
    const startIdx = findIndex(['start', 'mula']);
    const endIdx = findIndex(['end', 'tamat']);
    const courseIdx = findIndex(['course', 'kursus', 'kod']);
    const classIdx = findIndex(['class', 'kelas']);
    const lecturerIdx = findIndex(['lecturer', 'pensyarah', 'nama']);

    let slotCounter = 1;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      const rawRoom = roomIdx !== -1 ? cols[roomIdx] : cols[0];
      const rawDay = dayIdx !== -1 ? cols[dayIdx] : cols[1];
      const rawStart = startIdx !== -1 ? cols[startIdx] : cols[2];
      const rawEnd = endIdx !== -1 ? cols[endIdx] : cols[3];
      const courseCode = courseIdx !== -1 ? cols[courseIdx] : cols[4] || 'AKADEMIK';
      const className = classIdx !== -1 ? cols[classIdx] : cols[5] || '';
      const lecturerName = lecturerIdx !== -1 ? cols[lecturerIdx] : cols[6] || 'Pensyarah KPMBP';

      if (!rawRoom || !rawDay || !rawStart) continue;

      const dayOfWeek = mapToDayOfWeek(rawDay);
      if (!dayOfWeek) {
        errors.push(`Baris ${i + 1}: Hari "${rawDay}" tidak sah.`);
        continue;
      }

      const startTime = formatTimeStr(rawStart);
      const endTime = rawEnd ? formatTimeStr(rawEnd) : `${String(parseInt(startTime.split(':')[0], 10) + 1).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
      const roomId = resolveRoomId(rawRoom, '', existingRooms);

      validSlots.push({
        id: `SCH-CSV-${Date.now()}-${slotCounter++}`,
        roomId,
        dayOfWeek,
        startTime,
        endTime,
        courseCode,
        courseName: courseCode,
        className,
        lecturerName,
        department: 'Jabatan Akademik KPMBP'
      });

      affectedRoomIds.add(roomId);
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

