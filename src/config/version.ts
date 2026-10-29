/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare const __GIT_APP_VERSION__: string | undefined;

/**
 * Konfigurasi Versi Keluaran Aplikasi (Bundled Release Version)
 * Nilai pusat ini dibundel terus bersama aplikasi.
 * Jika remark commit Git dikesan semasa build (cth: "adjustment 29.10 v3"),
 * ia diselaraskan secara automatik ke dalam pemalar ini.
 */
export const APP_VERSION =
  (typeof __GIT_APP_VERSION__ !== 'undefined' && __GIT_APP_VERSION__)
    ? __GIT_APP_VERSION__
    : '29.10 v3';

/**
 * Label paparan versi berformat penuh untuk footer dan rujukan UI
 */
export const APP_VERSION_LABEL = `Versi ${APP_VERSION}`;
