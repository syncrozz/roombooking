import { StaffUser } from '../types';
import { INITIAL_STAFF_DATA } from '../data/staffData';

/**
 * Official MARA Staff Email & ID Resolution Matcher
 * Enforces @mara.gov.my as the sole ID domain for login and booking identity.
 * Strictly disallows @gmail.com and @bpenawar.kpm.edu.my.
 */
export function matchStaffByEmail(
  inputEmail: string,
  staffList: StaffUser[] = INITIAL_STAFF_DATA
): StaffUser | undefined {
  if (!inputEmail || typeof inputEmail !== 'string') return undefined;
  let clean = inputEmail.trim().toLowerCase();
  if (!clean) return undefined;

  // Strictly block @gmail.com and @bpenawar.kpm.edu.my
  if (clean.endsWith('@gmail.com') || clean.endsWith('@bpenawar.kpm.edu.my')) {
    return undefined;
  }

  // If user entered username without domain (e.g. "syahmi.ismail" or "nurlaili"), normalize to @mara.gov.my
  if (!clean.includes('@') && !clean.startsWith('st')) {
    clean = `${clean}@mara.gov.my`;
  }

  const effectiveList = staffList && staffList.length > 0 ? staffList : INITIAL_STAFF_DATA;

  // 1. Direct match on primary @mara.gov.my email
  let found = effectiveList.find(
    (s) => s.email && s.email.trim().toLowerCase() === clean
  );
  if (found) return found;

  // 2. Direct match on remaining official aliases
  found = effectiveList.find(
    (s) =>
      s.aliases &&
      s.aliases.some((a) => a && a.trim().toLowerCase() === clean)
  );
  if (found) return found;

  // 3. User entered staffId (e.g. ST061 or st061@mara.gov.my)
  const atIdx = clean.indexOf('@');
  if (atIdx !== -1) {
    const userPrefix = clean.substring(0, atIdx).trim();
    const domain = clean.substring(atIdx + 1).trim();

    if (domain === 'mara.gov.my') {
      // Check if userPrefix matches staffId directly (e.g. st061@mara.gov.my)
      found = effectiveList.find((s) => s.id && s.id.toLowerCase() === userPrefix);
      if (found) return found;

      // Match against official name tokens under @mara.gov.my
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
