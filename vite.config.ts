import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function formatDateToKlmVersion(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');

  return `v${day}.${month}.${hour}${minute}`;
}

function generateBuildVersion(): string {
  // Keutamaan 1: jika process.env.VITE_APP_VERSION ada, guna nilai itu.
  if (process.env.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION.trim();
  }

  // Keutamaan 2: ambil masa commit terakhir dengan execSync
  try {
    const gitCommitIsoDate = execSync('git log -1 --format=%cI', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (gitCommitIsoDate) {
      const commitDate = new Date(gitCommitIsoDate);
      if (!isNaN(commitDate.getTime())) {
        return formatDateToKlmVersion(commitDate);
      }
    }
  } catch {
    // Git tidak tersedia atau gagal
  }

  // Keutamaan 3 (jika git tidak tersedia atau gagal): jatuh balik ke masa build semasa dalam format yang sama.
  return formatDateToKlmVersion(new Date());
}

export default defineConfig(() => {
  const buildVersion = generateBuildVersion();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
