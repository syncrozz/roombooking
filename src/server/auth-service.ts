import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { INITIAL_STAFF_DATA } from '../data/staffData';
import { StaffUser } from '../types';

/**
 * Standard scrypt configuration for server-side PIN key derivation
 * High memory-hardness and CPU cost parameters resist GPU/ASIC brute-force
 * against 4-digit PIN search spaces (10,000 combinations).
 */
export const SCRYPT_CONFIG = {
  N: 16384, // CPU/memory cost parameter (2^14)
  r: 8,     // Block size parameter
  p: 1,     // Parallelization parameter
  keylen: 64, // 512-bit derived key length
  maxmem: 32 * 1024 * 1024, // 32MB max memory
};

/**
 * Derives a cryptographically strong scrypt hash for a staff PIN.
 * Uses a unique 16-byte cryptographically secure random salt per user.
 */
export async function hashPinScrypt(
  pin: string,
  saltHex?: string
): Promise<{ encoded: string; salt: string; hash: string }> {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const saltStr = salt.toString('hex');

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      pin.trim(),
      salt,
      SCRYPT_CONFIG.keylen,
      {
        N: SCRYPT_CONFIG.N,
        r: SCRYPT_CONFIG.r,
        p: SCRYPT_CONFIG.p,
        maxmem: SCRYPT_CONFIG.maxmem,
      },
      (err, derivedKey) => {
        if (err) return reject(err);
        const hashStr = derivedKey.toString('hex');
        const encoded = `scrypt$${SCRYPT_CONFIG.N}$${SCRYPT_CONFIG.r}$${SCRYPT_CONFIG.p}$${saltStr}$${hashStr}`;
        resolve({ encoded, salt: saltStr, hash: hashStr });
      }
    );
  });
}

/**
 * Synchronous scrypt derivation for deterministic execution and unit tests.
 */
export function hashPinScryptSync(
  pin: string,
  saltHex?: string
): { encoded: string; salt: string; hash: string } {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const saltStr = salt.toString('hex');

  const derivedKey = crypto.scryptSync(pin.trim(), salt, SCRYPT_CONFIG.keylen, {
    N: SCRYPT_CONFIG.N,
    r: SCRYPT_CONFIG.r,
    p: SCRYPT_CONFIG.p,
    maxmem: SCRYPT_CONFIG.maxmem,
  });

  const hashStr = derivedKey.toString('hex');
  const encoded = `scrypt$${SCRYPT_CONFIG.N}$${SCRYPT_CONFIG.r}$${SCRYPT_CONFIG.p}$${saltStr}$${hashStr}`;
  return { encoded, salt: saltStr, hash: hashStr };
}

/**
 * Verifies a candidate PIN against a stored scrypt encoded string.
 * Uses constant-time comparison (timingSafeEqual) to prevent timing attacks.
 */
export async function verifyPinScrypt(pin: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], 'hex');
  const expectedKey = Buffer.from(parts[5], 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(
      pin.trim(),
      salt,
      expectedKey.length,
      { N, r, p, maxmem: SCRYPT_CONFIG.maxmem },
      (err, candidateKey) => {
        if (err) return resolve(false);
        try {
          const match = crypto.timingSafeEqual(expectedKey, candidateKey);
          resolve(match);
        } catch {
          resolve(false);
        }
      }
    );
  });
}

/**
 * Synchronous scrypt verification using constant-time comparison.
 */
export function verifyPinScryptSync(pin: string, encoded: string): boolean {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], 'hex');
  const expectedKey = Buffer.from(parts[5], 'hex');

  try {
    const candidateKey = crypto.scryptSync(pin.trim(), salt, expectedKey.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_CONFIG.maxmem,
    });
    return crypto.timingSafeEqual(expectedKey, candidateKey);
  } catch {
    return false;
  }
}

/**
 * Server-Side Rate Limiter
 * Enforces maximum 5 failed attempts per staffId/IP with 15-minute lockout.
 */
interface RateLimitEntry {
  failures: number;
  lockedUntil?: number;
  lastAttemptAt: number;
}

export class ServerRateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private readonly maxFailures: number;
  private readonly lockoutDurationMs: number;

  constructor(maxFailures = 5, lockoutDurationMs = 15 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.lockoutDurationMs = lockoutDurationMs;
  }

  public checkLimit(key: string): {
    allowed: boolean;
    remainingLockoutSeconds?: number;
    attemptsLeft: number;
  } {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry) {
      return { allowed: true, attemptsLeft: this.maxFailures };
    }

    // Active lockout check
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
      return { allowed: false, remainingLockoutSeconds: remainingSeconds, attemptsLeft: 0 };
    }

    // Lockout expired: reset window
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      this.attempts.delete(key);
      return { allowed: true, attemptsLeft: this.maxFailures };
    }

    const attemptsLeft = Math.max(0, this.maxFailures - entry.failures);
    return { allowed: true, attemptsLeft };
  }

  public recordFailure(key: string): {
    locked: boolean;
    remainingLockoutSeconds?: number;
    attemptsLeft: number;
  } {
    const now = Date.now();
    let entry = this.attempts.get(key);

    if (!entry) {
      entry = { failures: 0, lastAttemptAt: now };
      this.attempts.set(key, entry);
    }

    entry.failures += 1;
    entry.lastAttemptAt = now;

    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.lockoutDurationMs;
      const remainingSeconds = Math.ceil(this.lockoutDurationMs / 1000);
      return { locked: true, remainingLockoutSeconds: remainingSeconds, attemptsLeft: 0 };
    }

    const attemptsLeft = this.maxFailures - entry.failures;
    return { locked: false, attemptsLeft };
  }

  public reset(key: string): void {
    this.attempts.delete(key);
  }

  public clearAll(): void {
    this.attempts.clear();
  }
}

/**
 * Server-Side Credential Vault
 * Keeps sensitive hashes and salts isolated on the server boundary.
 * Never leaks hashes, salts, or credentials to client objects.
 */
interface StaffCredentialRecord {
  staffId: string;
  email: string;
  aliases?: string[];
  scryptHash: string;
  pinStatus: 'DEFAULT' | 'CUSTOM';
  pinChangedAt?: string;
  updatedAt: string;
}

export const VAULT_STORAGE_PATH = path.resolve(process.cwd(), 'src/data/staff-credentials-vault.json');

export class StaffCredentialsVault {
  private vault = new Map<string, StaffCredentialRecord>();
  public rateLimiter = new ServerRateLimiter(5, 15 * 60 * 1000);

  constructor() {
    this.seedDefaultCredentials();
    this.loadPersistentVault();
  }

  /**
   * Initializes vault with default PIN ('1234') hashed via scrypt with unique salts.
   */
  private seedDefaultCredentials(): void {
    for (const staff of INITIAL_STAFF_DATA) {
      const defaultHash = hashPinScryptSync('1234');
      this.vault.set(staff.id.toLowerCase(), {
        staffId: staff.id,
        email: staff.email.trim().toLowerCase(),
        aliases: staff.aliases ? staff.aliases.map((a) => a.trim().toLowerCase()) : undefined,
        scryptHash: defaultHash.encoded,
        pinStatus: staff.pinStatus || 'DEFAULT',
        pinChangedAt: staff.pinChangedAt,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Loads saved persistent custom credentials from disk so they survive
   * server restarts, container cold boots, and code updates.
   */
  public loadPersistentVault(): void {
    try {
      if (fs.existsSync(VAULT_STORAGE_PATH)) {
        const raw = fs.readFileSync(VAULT_STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.staffId && item.scryptHash) {
              this.vault.set(item.staffId.toLowerCase(), item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[StaffCredentialsVault] Failed to load persistent vault file:', err);
    }
  }

  /**
   * Atomically saves the vault state to disk.
   */
  public savePersistentVault(): void {
    try {
      const dir = path.dirname(VAULT_STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.vault.values());
      fs.writeFileSync(VAULT_STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[StaffCredentialsVault] Failed to write persistent vault file:', err);
    }
  }

  /**
   * Smart Staff Record Lookup
   * Resolves staff records by:
   * 1. Direct email match
   * 2. Alias match (e.g. nurlailibalqis91@gmail.com and nurlaili@mara.gov.my)
   * 3. Domain interchangeability between @mara.gov.my and @kpmbp.edu.my
   * 4. Staff ID match (e.g. ST061 or st061@mara.gov.my)
   * 5. Institutional prefix matching for @mara.gov.my or @kpmbp.edu.my
   */
  public findStaffRecord(cleanEmail: string): StaffCredentialRecord | undefined {
    const emailNorm = cleanEmail.trim().toLowerCase();
    if (!emailNorm) return undefined;

    const allRecords = Array.from(this.vault.values());

    // 1. Direct match on primary email
    let record = allRecords.find((r) => r.email.toLowerCase() === emailNorm);
    if (record) return record;

    // 2. Direct match on configured aliases
    record = allRecords.find(
      (r) => r.aliases && r.aliases.some((a) => a.toLowerCase() === emailNorm)
    );
    if (record) return record;

    // 3. Domain interchangeability (@mara.gov.my <-> @kpmbp.edu.my)
    const atIdx = emailNorm.indexOf('@');
    if (atIdx !== -1) {
      const userPrefix = emailNorm.substring(0, atIdx).trim();
      const domain = emailNorm.substring(atIdx + 1).trim();

      const altDomain =
        domain === 'mara.gov.my'
          ? 'kpmbp.edu.my'
          : domain === 'kpmbp.edu.my'
          ? 'mara.gov.my'
          : null;

      if (altDomain) {
        const altEmail = `${userPrefix}@${altDomain}`;
        record = allRecords.find(
          (r) =>
            r.email.toLowerCase() === altEmail ||
            (r.aliases && r.aliases.some((a) => a.toLowerCase() === altEmail))
        );
        if (record) return record;
      }

      // Check if userPrefix matches staffId (e.g. st061@mara.gov.my)
      record = this.vault.get(userPrefix);
      if (record) return record;

      // 4. Match against INITIAL_STAFF_DATA aliases or name prefix for official domains
      if (domain === 'mara.gov.my' || domain === 'kpmbp.edu.my') {
        const staffFromInitial = INITIAL_STAFF_DATA.find((s) => {
          if (s.id.toLowerCase() === userPrefix) return true;
          if (s.aliases && s.aliases.some((a) => a.toLowerCase() === emailNorm)) return true;

          const cleanTokens = s.name
            .toLowerCase()
            .replace(/dr\.|hj\.|hjh\.|bin|binti|bt\.|ibni|cmilt|afpm|m\.t\.a\.m|c\.a\.\(m\)/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 3);

          return cleanTokens.some(
            (token) => token === userPrefix || userPrefix.startsWith(token) || token.startsWith(userPrefix)
          );
        });

        if (staffFromInitial) {
          const matchedVaultRecord = this.vault.get(staffFromInitial.id.toLowerCase());
          if (matchedVaultRecord) return matchedVaultRecord;
        }
      }
    } else {
      // Direct staffId match
      record = this.vault.get(emailNorm);
      if (record) return record;
    }

    return undefined;
  }

  /**
   * Clears any active rate-limit lockout for a given staff member and clears IP locks.
   */
  public unlockStaff(staffId: string): boolean {
    const idLower = staffId.toLowerCase();
    this.rateLimiter.reset(`staff_${idLower}`);
    this.rateLimiter.clearAll();
    return true;
  }

  /**
   * Strips all credential data before returning staff object to client.
   */
  public sanitizeStaffForClient(rawStaff: StaffUser | Record<string, any>): StaffUser {
    return {
      id: rawStaff.id,
      name: rawStaff.name,
      email: rawStaff.email,
      role: rawStaff.role,
      department: rawStaff.department,
      phone: rawStaff.phone,
      aliases: rawStaff.aliases,
      pinStatus: rawStaff.pinStatus || 'DEFAULT',
      pinChangedAt: rawStaff.pinChangedAt,
    };
  }

  /**
   * Verifies staff credentials against server vault with rate-limiting.
   */
  public async verifyStaff(
    email: string,
    pin: string,
    clientIp?: string
  ): Promise<{
    success: boolean;
    staff?: StaffUser;
    errorMsg?: string;
    isDefaultPin?: boolean;
    remainingAttempts?: number;
    isLocked?: boolean;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanEmail || !cleanPin || !/^\d{4}$/.test(cleanPin)) {
      return { success: false, errorMsg: 'Email atau PIN tidak sah (mesti 4 digit nombor).' };
    }

    // Lookup staff by email with smart alias and institutional domain resolution
    const staffRecord = this.findStaffRecord(cleanEmail);

    const rateKey = staffRecord ? `staff_${staffRecord.staffId.toLowerCase()}` : `ip_${clientIp || 'unknown'}`;
    const rateCheck = this.rateLimiter.checkLimit(rateKey);

    if (!rateCheck.allowed) {
      return {
        success: false,
        isLocked: true,
        errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan (5 kali). Sila cuba lagi selepas ${rateCheck.remainingLockoutSeconds} saat.`,
      };
    }

    if (!staffRecord) {
      this.rateLimiter.recordFailure(rateKey);
      return { success: false, errorMsg: 'Email atau PIN tidak sah.' };
    }

    // Verify scrypt hash
    const isValid = await verifyPinScrypt(cleanPin, staffRecord.scryptHash);

    if (!isValid) {
      const failure = this.rateLimiter.recordFailure(rateKey);
      if (failure.locked) {
        return {
          success: false,
          isLocked: true,
          errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan (5 kali). Sila cuba lagi selepas ${failure.remainingLockoutSeconds} saat.`,
        };
      }
      return {
        success: false,
        remainingAttempts: failure.attemptsLeft,
        errorMsg: 'Email atau PIN tidak sah.',
      };
    }

    // Success: reset rate limit for both staff account and client IP
    this.rateLimiter.reset(rateKey);
    if (clientIp) {
      this.rateLimiter.reset(`ip_${clientIp}`);
    }

    const staffData = INITIAL_STAFF_DATA.find((s) => s.id === staffRecord.staffId) || {
      id: staffRecord.staffId,
      name: staffRecord.staffId,
      email: staffRecord.email,
      role: 'Staf',
      department: 'Pentadbiran',
      phone: '',
      pinStatus: staffRecord.pinStatus,
    };

    const sanitized = this.sanitizeStaffForClient({
      ...staffData,
      email: cleanEmail.includes('@') ? cleanEmail : staffData.email,
      pinStatus: staffRecord.pinStatus,
      pinChangedAt: staffRecord.pinChangedAt,
    });

    return {
      success: true,
      staff: sanitized,
      isDefaultPin: staffRecord.pinStatus === 'DEFAULT' || cleanPin === '1234',
    };
  }

  /**
   * Synchronous credential verification (for synchronous legacy calls).
   */
  public verifyStaffSync(
    email: string,
    pin: string,
    clientIp?: string
  ): {
    success: boolean;
    staff?: StaffUser;
    errorMsg?: string;
    isDefaultPin?: boolean;
    remainingAttempts?: number;
    isLocked?: boolean;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanEmail || !cleanPin || !/^\d{4}$/.test(cleanPin)) {
      return { success: false, errorMsg: 'Email atau PIN tidak sah (mesti 4 digit nombor).' };
    }

    const staffRecord = this.findStaffRecord(cleanEmail);

    const rateKey = staffRecord ? `staff_${staffRecord.staffId.toLowerCase()}` : `ip_${clientIp || 'unknown'}`;
    const rateCheck = this.rateLimiter.checkLimit(rateKey);

    if (!rateCheck.allowed) {
      return {
        success: false,
        isLocked: true,
        errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan (5 kali). Sila cuba lagi selepas ${rateCheck.remainingLockoutSeconds} saat.`,
      };
    }

    if (!staffRecord) {
      this.rateLimiter.recordFailure(rateKey);
      return { success: false, errorMsg: 'Email atau PIN tidak sah.' };
    }

    const isValid = verifyPinScryptSync(cleanPin, staffRecord.scryptHash);

    if (!isValid) {
      const failure = this.rateLimiter.recordFailure(rateKey);
      if (failure.locked) {
        return {
          success: false,
          isLocked: true,
          errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan (5 kali). Sila cuba lagi selepas ${failure.remainingLockoutSeconds} saat.`,
        };
      }
      return {
        success: false,
        remainingAttempts: failure.attemptsLeft,
        errorMsg: 'Email atau PIN tidak sah.',
      };
    }

    this.rateLimiter.reset(rateKey);
    if (clientIp) {
      this.rateLimiter.reset(`ip_${clientIp}`);
    }

    const staffData = INITIAL_STAFF_DATA.find((s) => s.id === staffRecord.staffId) || {
      id: staffRecord.staffId,
      name: staffRecord.staffId,
      email: staffRecord.email,
      role: 'Staf',
      department: 'Pentadbiran',
      phone: '',
      pinStatus: staffRecord.pinStatus,
    };

    const sanitized = this.sanitizeStaffForClient({
      ...staffData,
      email: cleanEmail.includes('@') ? cleanEmail : staffData.email,
      pinStatus: staffRecord.pinStatus,
      pinChangedAt: staffRecord.pinChangedAt,
    });

    return {
      success: true,
      staff: sanitized,
      isDefaultPin: staffRecord.pinStatus === 'DEFAULT' || cleanPin === '1234',
    };
  }

  /**
   * Updates staff PIN with fresh salt and scrypt hash.
   * Enforces server-side authentication (currentPin or adminPasscode) and rate limiting.
   */
  public async updateStaffPin(
    staffId: string,
    newPin: string,
    options?: {
      clientIp?: string;
      currentPin?: string;
      adminPasscode?: string;
      skipAuth?: boolean;
    } | string
  ): Promise<{
    success: boolean;
    errorMsg?: string;
    isLocked?: boolean;
    remainingAttempts?: number;
  }> {
    const cleanPin = newPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, errorMsg: 'PIN baharu mesti tepat 4 digit nombor.' };
    }

    if (cleanPin === '1234') {
      return { success: false, errorMsg: 'PIN baharu tidak boleh sama dengan PIN lalai (1234).' };
    }

    if (/^(\d)\1{3}$/.test(cleanPin)) {
      return { success: false, errorMsg: 'PIN baharu tidak boleh menggunakan digit berulang (contoh: 0000, 1111).' };
    }

    const clientIp = typeof options === 'string' ? options : options?.clientIp;
    const currentPin = typeof options === 'object' && options !== null ? options.currentPin : undefined;
    const adminPasscode = typeof options === 'object' && options !== null ? options.adminPasscode : undefined;
    const skipAuth = typeof options === 'object' && options !== null ? !!options.skipAuth : options === undefined;

    const idLower = staffId.toLowerCase();
    const rateKey = `staff_${idLower}`;

    // Rate Limiting Check
    const rateCheck = this.rateLimiter.checkLimit(rateKey);
    if (!rateCheck.allowed) {
      return {
        success: false,
        isLocked: true,
        errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan. Sila cuba lagi selepas ${rateCheck.remainingLockoutSeconds} saat.`,
      };
    }

    const existing = this.vault.get(idLower);

    // Authentication / Authorization Check
    if (!skipAuth) {
      const isAdmin = adminPasscode === '5313';
      if (!isAdmin) {
        if (!currentPin) {
          return { success: false, errorMsg: 'PIN semasa atau Passcode Pentadbir diperlukan untuk pengesahan.' };
        }
        if (!existing) {
          const fail = this.rateLimiter.recordFailure(rateKey);
          return {
            success: false,
            errorMsg: 'Akaun staf tidak dijumpai.',
            remainingAttempts: fail.attemptsLeft,
            isLocked: fail.locked,
          };
        }
        const isCurrentValid = await verifyPinScrypt(currentPin.trim(), existing.scryptHash);
        if (!isCurrentValid) {
          const fail = this.rateLimiter.recordFailure(rateKey);
          if (fail.locked) {
            return {
              success: false,
              isLocked: true,
              errorMsg: `Akaun dikunci sementara kerana melebihi had cubaan. Sila cuba lagi selepas ${fail.remainingLockoutSeconds} saat.`,
            };
          }
          return {
            success: false,
            errorMsg: 'PIN semasa tidak sah.',
            remainingAttempts: fail.attemptsLeft,
          };
        }
      }
    }

    const newHash = await hashPinScrypt(cleanPin);
    const now = new Date().toISOString();

    if (existing) {
      existing.scryptHash = newHash.encoded;
      existing.pinStatus = 'CUSTOM';
      existing.pinChangedAt = now;
      existing.updatedAt = now;
    } else {
      const staffData = INITIAL_STAFF_DATA.find((s) => s.id.toLowerCase() === idLower);
      this.vault.set(idLower, {
        staffId,
        email: staffData?.email.toLowerCase() || `${idLower}@mara.gov.my`,
        scryptHash: newHash.encoded,
        pinStatus: 'CUSTOM',
        pinChangedAt: now,
        updatedAt: now,
      });
    }

    this.rateLimiter.reset(rateKey);
    this.savePersistentVault();
    return { success: true };
  }

  /**
   * Resets staff PIN to default '1234' (admin maintenance operation).
   * Enforces admin authorization and server-side rate limiting.
   */
  public async resetStaffPin(
    staffId: string,
    options?: {
      adminPasscode?: string;
      clientIp?: string;
      skipAuth?: boolean;
    } | string
  ): Promise<{
    success: boolean;
    errorMsg?: string;
    isLocked?: boolean;
  }> {
    const clientIp = typeof options === 'string' ? options : options?.clientIp;
    const adminPasscode = typeof options === 'object' && options !== null ? options.adminPasscode : undefined;
    const skipAuth = typeof options === 'object' && options !== null ? !!options.skipAuth : options === undefined;

    const rateKey = `admin_${clientIp || 'local'}`;
    const rateCheck = this.rateLimiter.checkLimit(rateKey);
    if (!rateCheck.allowed) {
      return {
        success: false,
        isLocked: true,
        errorMsg: `Had pentadbir dicapai. Sila cuba lagi selepas ${rateCheck.remainingLockoutSeconds} saat.`,
      };
    }

    if (!skipAuth && adminPasscode !== '5313') {
      this.rateLimiter.recordFailure(rateKey);
      return { success: false, errorMsg: 'Akses dinafikan: Passcode Pentadbir diperlukan atau tidak sah.' };
    }

    const idLower = staffId.toLowerCase();
    const defaultHash = await hashPinScrypt('1234');
    const existing = this.vault.get(idLower);
    const now = new Date().toISOString();

    if (existing) {
      existing.scryptHash = defaultHash.encoded;
      existing.pinStatus = 'DEFAULT';
      existing.pinChangedAt = undefined;
      existing.updatedAt = now;
    }

    this.rateLimiter.reset(`staff_${idLower}`);
    this.savePersistentVault();
    return { success: true };
  }

  /**
   * Helper to verify no client-exposed object contains PIN or hash.
   */
  public hasCredentialLeak(obj: Record<string, any>): boolean {
    const forbiddenKeys = ['pin', 'pinhash', 'scrypthash', 'salt', 'secret', 'password'];
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.includes(key.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
}

// Export singleton server vault instance
export const serverAuthVault = new StaffCredentialsVault();
