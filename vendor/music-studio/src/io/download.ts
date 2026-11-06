export function downloadBytes(data: Uint8Array | string, filename: string, mime: string): void {
  const blob = typeof data === 'string'
    ? new Blob([data], { type: mime })
    : new Blob([Uint8Array.from(data)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadSequence(
  items: Array<{ data: Uint8Array | string; filename: string; mime: string }>,
  delayMs = 400,
  downloader: (data: Uint8Array | string, filename: string, mime: string) => void = downloadBytes,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    downloader(item.data, item.filename, item.mime);
    if (i < items.length - 1 && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function safeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'untitled';
}
