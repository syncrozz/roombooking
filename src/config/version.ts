/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare const __GIT_APP_VERSION__: string | undefined;

/**
 * Konfigurasi Versi Keluaran Aplikasi (Bundled Release Version)
 * Nilai pusat ini dibundel terus bersama aplikasi.
 * Jika remark commit Git atau pembolehubah persekitaran dikesan semasa build,
 * ia diselaraskan secara automatik ke dalam pemalar ini.
 */
export const APP_VERSION =
  (typeof __GIT_APP_VERSION__ !== 'undefined' && __GIT_APP_VERSION__)
    ? __GIT_APP_VERSION__
    : (typeof process !== 'undefined' && (process.env?.VITE_APP_VERSION || process.env?.APP_VERSION))
    ? (process.env?.VITE_APP_VERSION || process.env?.APP_VERSION)!
    : '29.10 v4';

/**
 * Label paparan versi berformat penuh untuk footer dan rujukan UI
 */
export const APP_VERSION_LABEL = `Versi ${APP_VERSION}`;
