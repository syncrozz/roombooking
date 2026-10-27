import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';

/**
 * Staff Email & ID Resolution Matcher
 * Matches input against registered emails and aliases from CSV / staff sources.
 * When data matches the entered email, the system permits access.
 */
export function matchStaffByEmail(
  inputEmail: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): StaffUser | undefined {
  if (!inputEmail || typeof inputEmail !== 'string') return undefined;
  let clean = inputEmail.trim().toLowerCase();
  if (!clean) return undefined;

  const effectiveList = staffList && staffList.length > 0 ? staffList : INITIAL_STAFF_DATA;

  // 1. Direct match on primary email in sources (e.g. from CSV or initial staff data)
  let found = effectiveList.find(
    (s) => s.email && s.email.trim().toLowerCase() === clean
  );
  if (found) return found;

  // 2. Direct match on registered aliases in sources (e.g. @kpmbp.edu.my, alternative emails)
  found = effectiveList.find(
    (s) =>
      s.aliases &&
      s.aliases.some((a) => a && a.trim().toLowerCase() === clean)
  );
  if (found) return found;

  // 3. User entered staffId directly (e.g. ST061 or st001)
  found = effectiveList.find((s) => s.id && s.id.toLowerCase() === clean);
  if (found) return found;

  // 4. If full email entered (with @ domain):
  // Allow official staffId prefix resolution (e.g. st061@mara.gov.my or st061@kpmbp.edu.my)
  if (clean.includes('@')) {
    const atIdx = clean.indexOf('@');
    const userPrefix = clean.substring(0, atIdx).trim();
    const domain = clean.substring(atIdx + 1).trim();

    if (domain === 'mara.gov.my' || domain === 'kpmbp.edu.my') {
      found = effectiveList.find((s) => s.id && s.id.toLowerCase() === userPrefix);
      if (found) return found;
    }
    // Any other email with domain that doesn't match primary or aliases is NOT registered in CSV sources
    return undefined;
  }

  // 5. If entered without @ (username or name token):
  const userPrefix = clean;

  // Check if prefix matches any registered email username
  found = effectiveList.find((s) => {
    if (!s.email) return false;
    const prefix = s.email.split('@')[0].trim().toLowerCase();
    return prefix === userPrefix;
  });
  if (found) return found;

  // Check if prefix matches any registered alias username
  found = effectiveList.find((s) => {
    if (!s.aliases) return false;
    return s.aliases.some((a) => {
      const aliasPrefix = a.split('@')[0].trim().toLowerCase();
      return aliasPrefix === userPrefix;
    });
  });
  if (found) return found;

  // Match against official name tokens for registered staff in the CSV sources
  const candidates = effectiveList.filter((s) => {
    if (!s.name) return false;
    const cleanName = s.name
      .toLowerCase()
      .replace(/dr\.|hj\.|hjh\.|bin|binti|bt\.|ibni|cmilt|afpm|m\.t\.a\.m|c\.a\.\(m\)/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleanName.split(/\s+/).filter((t) => t.length >= 3);
    return tokens.some((token) => token === userPrefix || userPrefix.startsWith(token) || token.startsWith(userPrefix));
  });

  if (candidates.length === 1) {
    return candidates[0];
  }

  // Fallback: If entered without @, try with @mara.gov.my
  const withMaraDomain = `${clean}@mara.gov.my`;
  found = effectiveList.find((s) => s.email && s.email.trim().toLowerCase() === withMaraDomain);
  if (found) return found;
  found = effectiveList.find((s) => s.aliases && s.aliases.some((a) => a && a.trim().toLowerCase() === withMaraDomain));
  if (found) return found;

  return undefined;
}

