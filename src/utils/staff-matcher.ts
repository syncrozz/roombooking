import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';

/**
 * Universal Staff Email & Alias Resolution Matcher
 * Resolves lecturer and staff accounts regardless of whether they enter:
 * - Official MARA email: e.g. nurlaili@mara.gov.my, khairi.mohd@mara.gov.my
 * - Institutional email: e.g. nurlaili@kpmbp.edu.my, tahira.tarikh@kpmbp.edu.my
 * - Personal/Spreadsheet registered email: e.g. nurlailibalqis91@gmail.com, khaikerr@gmail.com
 * - Any configured email alias
 * - Staff ID: e.g. ST061, st061@mara.gov.my
 */
export function matchStaffByEmail(
  inputEmail: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): StaffUser | undefined {
  if (!inputEmail || typeof inputEmail !== 'string') return undefined;
  const clean = inputEmail.trim().toLowerCase();
  if (!clean) return undefined;

  const effectiveList = staffList && staffList.length > 0 ? staffList : INITIAL_STAFF_DATA;

  // 1. Direct match on primary email
  let found = effectiveList.find(
    (s) => s.email && s.email.trim().toLowerCase() === clean
  );
  if (found) return found;

  // 2. Direct match on aliases list
  found = effectiveList.find(
    (s) =>
      s.aliases &&
      s.aliases.some((a) => a && a.trim().toLowerCase() === clean)
  );
  if (found) return found;

  // 3. Domain interchangeability between @mara.gov.my and @kpmbp.edu.my
  const atIdx = clean.indexOf('@');
  if (atIdx !== -1) {
    const userPrefix = clean.substring(0, atIdx).trim();
    const domain = clean.substring(atIdx + 1).trim();

    const altDomain =
      domain === 'mara.gov.my'
        ? 'kpmbp.edu.my'
        : domain === 'kpmbp.edu.my'
        ? 'mara.gov.my'
        : null;

    if (altDomain) {
      const altEmail = `${userPrefix}@${altDomain}`;
      found = effectiveList.find(
        (s) =>
          (s.email && s.email.trim().toLowerCase() === altEmail) ||
          (s.aliases && s.aliases.some((a) => a && a.trim().toLowerCase() === altEmail))
      );
      if (found) return found;
    }

    // Check if userPrefix matches staffId directly (e.g. st061@mara.gov.my)
    found = effectiveList.find((s) => s.id && s.id.toLowerCase() === userPrefix);
    if (found) return found;

    // 4. Institutional prefix/name match for @mara.gov.my or @kpmbp.edu.my
    if (domain === 'mara.gov.my' || domain === 'kpmbp.edu.my') {
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
    }
  } else {
    // If entered as staffId directly (e.g. ST061)
    found = effectiveList.find((s) => s.id && s.id.toLowerCase() === clean);
    if (found) return found;
  }

  return undefined;
}
