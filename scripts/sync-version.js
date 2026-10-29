import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionFilePath = path.resolve(__dirname, '../src/config/version.ts');

/**
 * Mengesan versi daripada remark commit git tempatan (contoh: "adjustment 29.10 v4").
 */
export function detectGitRemarkVersion() {
  // 1. Semak pembolehubah persekitaran terlebih dahulu
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION.trim();
  if (process.env.APP_VERSION) return process.env.APP_VERSION.trim();

  // 2. Semak git log tempatan jika ada repository git
  try {
    const commitMsg = execSync('git log -1 --pretty=%B', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (commitMsg) {
      const match = commitMsg.match(/(?:adjustment|versi|version|release|tag)\s+([0-9]{1,2}\.[0-9]{1,2}(?:\s+[vV][0-9]+)?)/i) ||
                    commitMsg.match(/([0-9]{1,2}\.[0-9]{1,2}\s+[vV][0-9]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch {
    // Di luar git repository atau tiada commit
  }
  return null;
}

/**
 * Mengesan versi daripada GitHub repository commits API secara langsung jika tiada .git setempat
 */
export async function detectGitHubRemoteVersion() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.github.com/repos/syncrozz/roombooking/commits?per_page=1', {
      headers: { 'User-Agent': 'BookBK-SmartHub-Sync' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const message = data?.[0]?.commit?.message || '';
    const match = message.match(/(?:adjustment|versi|version|release|tag)\s+([0-9]{1,2}\.[0-9]{1,2}(?:\s+[vV][0-9]+)?)/i) ||
                  message.match(/([0-9]{1,2}\.[0-9]{1,2}\s+[vV][0-9]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Di luar talian atau had kadar API
  }
  return null;
}

/**
 * Mengemas kini pemalar APP_VERSION dalam src/config/version.ts secara automatik
 */
export async function syncVersionFile(forcedVersion) {
  let version = forcedVersion || detectGitRemarkVersion();
  if (!version) {
    version = await detectGitHubRemoteVersion();
  }
  if (!version) return null;

  if (fs.existsSync(versionFilePath)) {
    const content = fs.readFileSync(versionFilePath, 'utf-8');
    const updated = content.replace(
      /: '[0-9]{1,2}\.[0-9]{1,2}(?:\s+[vV][0-9]+)?';/,
      `: '${version}';`
    );
    if (updated !== content) {
      fs.writeFileSync(versionFilePath, updated, 'utf-8');
      console.log(`[sync-version] Berjaya mengemas kini APP_VERSION kepada '${version}' dalam src/config/version.ts`);
      return version;
    }
  }
  return version;
}

const argVersion = process.argv[2];
syncVersionFile(argVersion).catch(() => {});
