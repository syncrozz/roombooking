import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';

function getGitRemarkVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION.trim();
  if (process.env.APP_VERSION) return process.env.APP_VERSION.trim();

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
    // Git not available in environment
  }
  return '';
}

export default defineConfig(() => {
  const gitVersion = getGitRemarkVersion();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __GIT_APP_VERSION__: JSON.stringify(gitVersion || ''),
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
