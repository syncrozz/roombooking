/**
 * Helper utility to enforce BookBK export and download naming standards.
 * All downloaded files must begin with the uppercase prefix 'BOOKBK_'.
 * Prevents duplicate prefixes if already present.
 */

export function ensureBookbkPrefix(filename: string): string {
  if (!filename) return 'BOOKBK_download';
  if (filename.startsWith('BOOKBK_')) {
    return filename;
  }
  return `BOOKBK_${filename}`;
}

export function triggerFileDownload(blobOrUrl: Blob | string, filename: string): void {
  const finalFilename = ensureBookbkPrefix(filename);
  const isBlob = typeof blobOrUrl !== 'string';
  const url = isBlob ? URL.createObjectURL(blobOrUrl as Blob) : (blobOrUrl as string);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', finalFilename);
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isBlob) {
    URL.revokeObjectURL(url);
  }
}
