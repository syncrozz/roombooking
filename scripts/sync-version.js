import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionFilePath = path.resolve(__dirname, '../src/config/version.ts');

/**
 * Mengesan versi daripada remark commit git terkini (contoh: "adjustment 29.10 v3").
 */
export function detectGitRemarkVersion() {
  try {
    const commitMsg = execSync('git log -1 --pretty=%B', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (!commitMsg) return null;

    // Padanan corak seperti 'adjustment 29.10 v3' atau 'adjustment 30.10'
    const match = commitMsg.match(/adjustment\s+([0-9]{1,2}\.[0-9]{1,2}(?:\s+[vV][0-9]+)?)/i) ||
                  commitMsg.match(/(?:versi|version)\s+([0-9]{1,2}\.[0-9]{1,2}(?:\s+[vV][0-9]+)?)/i);

    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // Di luar git repository atau tiada commit
  }
  return null;
}

/**
 * Mengemas kini pemalar APP_VERSION dalam src/config/version.ts secara automatik
 */
export function syncVersionFile(forcedVersion) {
  const version = forcedVersion || detectGitRemarkVersion();
  if (!version) return null;

  if (fs.existsSync(versionFilePath)) {
    const content = fs.readFileSync(versionFilePath, 'utf-8');
    const updated = content.replace(
      /export const APP_VERSION = '.*?';/,
      `export const APP_VERSION = '${version}';`
    );
    if (updated !== content) {
      fs.writeFileSync(versionFilePath, updated, 'utf-8');
      console.log(`[sync-version] Berjaya mengemas kini APP_VERSION kepada '${version}' dalam src/config/version.ts`);
      return version;
    }
  }
  return null;
}

syncVersionFile();
