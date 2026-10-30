/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare const __APP_VERSION__: string | undefined;

/**
 * Konfigurasi Versi Keluaran Aplikasi (Bundled Release Version)
 * Nilai dibundel semasa build mengikut masa commit Git terakhir (format v{DD}.{MM}.{HHmm} waktu Malaysia UTC+8).
 * Jika __APP_VERSION__ tidak dibekalkan oleh bundler, gunakan penanda ralat statik tanpa mengira masa di pelayar.
 */
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : 'v-.--.----';

/**
 * Label paparan versi (format sudah bermula dengan 'v', cth: v30.10.0815)
 */
export const APP_VERSION_LABEL = APP_VERSION;
