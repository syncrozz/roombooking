/**
 * displayName.ts
 * Utility for formatting lecturer and applicant names into concise short display names for the matrix view.
 */

export const OVERRIDES: Record<string, string> = {
  'akmal binti ariff @ fauzi': 'Akmal Ariff',
  'akmal lutfi bin esa': 'Akmal Lutfi'
};

const KEPT_TITLES: Record<string, string> = {
  'dr': 'Dr.',
  'dr.': 'Dr.',
  'prof': 'Prof.',
  'prof.': 'Prof.',
  'ts': 'Ts.',
  'ts.': 'Ts.',
  'ir': 'Ir.',
  'ir.': 'Ir.'
};

const IGNORED_HONORIFICS_AND_CREDS = new Set([
  'hj', 'hj.', 'hjh', 'hjh.', 'en', 'en.', 'pn', 'pn.', 'cik', 'cik.',
  'dato', 'dato.', 'dato\'', 'datuk', 'datuk.', 'datin', 'datin.',
  'tuan', 'tuan.', 'puan', 'puan.', 'encik', 'encik.',
  'cmilt', 'afpm', 'm.t.a.m', 'c.a.(m)', 'mba', 'phd', 'ph.d', 'ph.d.', 'madya'
]);

const STOP_WORDS = new Set([
  'bin', 'binti', 'bt', 'bt.', 'bte', 'bte.', 'b', 'b.', 'a/l', 'a/p', 'anak', '@'
]);

const COMPOUND_PREFIXES = new Set([
  'siti', 'nur', 'nor', 'noor', 'nurul', 'nurus', 'raja', 'syed', 'sharifah', 'wan', 'tengku'
]);

const DROP_PREFIXES = new Set([
  'mohd', 'mohd.', 'muhammad', 'mohamad', 'muhamad', 'mohamed', 'md', 'md.', 'ahmad', 'abdul', 'abd', 'abd.'
]);

/**
 * Capitalizes a word into Title Case (e.g. 'FAZLY' -> 'Fazly', 'rabiahtul' -> 'Rabiahtul')
 */
function toTitleCase(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Derives a short display name from a full staff/lecturer name for the room availability matrix.
 */
export function getShortName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return '';
  }

  // 1. Check exact overrides map (case-insensitive)
  const lookupKey = trimmed.toLowerCase();
  if (OVERRIDES[lookupKey]) {
    return OVERRIDES[lookupKey];
  }

  // 2. Tokenize by whitespace and commas (to separate trailing credentials like CMILT, M.T.A.M)
  const rawTokens = trimmed.split(/[\s,]+/);

  let keptTitle: string | null = null;
  const coreWords: string[] = [];

  for (const rawToken of rawTokens) {
    const token = rawToken.trim();
    if (!token) continue;

    const lower = token.toLowerCase();

    // Stop reading at patronymic indicators: BIN, BINTI, BT, BTE, B, A/L, A/P, ANAK, @
    if (STOP_WORDS.has(lower)) {
      break;
    }

    // Check kept title (kept only at the front)
    if (KEPT_TITLES[lower]) {
      if (!keptTitle && coreWords.length === 0) {
        keptTitle = KEPT_TITLES[lower];
      }
      continue;
    }

    // Check ignored honorifics or credentials
    if (IGNORED_HONORIFICS_AND_CREDS.has(lower)) {
      continue;
    }

    // Strip surrounding punctuation (e.g. brackets, quotes)
    const cleaned = token.replace(/^[^\w.]+|[^\w.]+$/g, '');
    if (!cleaned) continue;

    const cleanedLower = cleaned.toLowerCase();
    if (IGNORED_HONORIFICS_AND_CREDS.has(cleanedLower)) {
      continue;
    }

    if (STOP_WORDS.has(cleanedLower)) {
      break;
    }

    coreWords.push(cleaned);
  }

  // If no usable core words remain, return the original text
  if (coreWords.length === 0) {
    return trimmed;
  }

  let namePart = '';
  const firstWordLower = coreWords[0].toLowerCase();

  // Rule: If first word is Siti, Nur, Nor, Noor, Nurul, Nurus, Raja, Syed, Sharifah, Wan or Tengku
  if (COMPOUND_PREFIXES.has(firstWordLower)) {
    if (coreWords.length > 1) {
      const secondWordLower = coreWords[1].toLowerCase();
      // If the second word is a drop prefix like Mohd or Mohamad (e.g. Raja Mohamad Syahmi, Syed Mohd Fadly),
      // drop it and take the next word to yield "Raja Syahmi" or "Syed Fadly"
      if (DROP_PREFIXES.has(secondWordLower) && coreWords.length > 2) {
        namePart = `${toTitleCase(coreWords[0])} ${toTitleCase(coreWords[2])}`;
      } else {
        namePart = `${toTitleCase(coreWords[0])} ${toTitleCase(coreWords[1])}`;
      }
    } else {
      namePart = toTitleCase(coreWords[0]);
    }
  }
  // Rule: Otherwise drop leading Mohd, Muhammad, Mohamad, Muhamad, Mohamed, Md, Ahmad, Abdul, Abd and use the next word
  else if (DROP_PREFIXES.has(firstWordLower)) {
    if (coreWords.length > 1) {
      const secondWordLower = coreWords[1].toLowerCase();
      // If the second word is also a drop prefix (e.g. Ahmad Abdul...), take the third if available
      if (DROP_PREFIXES.has(secondWordLower) && coreWords.length > 2) {
        namePart = toTitleCase(coreWords[2]);
      } else {
        namePart = toTitleCase(coreWords[1]);
      }
    } else {
      namePart = toTitleCase(coreWords[0]);
    }
  }
  // Rule: Otherwise use the first word only
  else {
    namePart = toTitleCase(coreWords[0]);
  }

  // Combine kept title with the short name
  if (keptTitle) {
    return `${keptTitle} ${namePart}`;
  }

  return namePart;
}
