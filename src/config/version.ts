/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare const __APP_VERSION__: string | undefined;

function getFallbackBuildVersion(): string {
  if (typeof process !== 'undefined' && process.env?.VITE_APP_VERSION) {
    return process.env.VITE_APP_VERSION.trim();
  }
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');
  return `v${day}.${month}.${hour}${minute}`;
}

/**
 * Konfigurasi Versi Keluaran Aplikasi (Bundled Release Version)
 * Nilai dijana secara automatik pada masa build mengikut format v{DD}.{MM}.{HHmm} waktu Malaysia (UTC+8).
 */
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : getFallbackBuildVersion();

/**
 * Label paparan versi (format sudah bermula dengan 'v', cth: v30.10.0815)
 */
export const APP_VERSION_LABEL = APP_VERSION;
