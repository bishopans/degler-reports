/**
 * HEIC/HEIF support utilities.
 *
 * Browsers (Chrome, Firefox) cannot natively display HEIC images.
 * These helpers detect HEIC URLs and convert them to JPEG blobs
 * that the browser can render.
 */

/** Check if a URL points to a HEIC/HEIF file (by extension) */
export function isHeicUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.heic') || pathname.endsWith('.heif');
  } catch {
    return /\.heic|\.heif/i.test(url);
  }
}

/**
 * Fetch a HEIC image URL, convert it to a JPEG blob URL using heic2any.
 * Returns the original URL unchanged if it's not HEIC.
 * Returns null if conversion fails.
 */
export async function convertHeicUrlToJpeg(url: string): Promise<string | null> {
  if (!isHeicUrl(url)) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const heicBlob = await response.blob();
    const heic2any = (await import('heic2any')).default;
    const jpegBlob = await heic2any({
      blob: heicBlob,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const result = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;
    return URL.createObjectURL(result);
  } catch (err) {
    console.warn('HEIC URL conversion failed:', url, err);
    return null;
  }
}

/**
 * Convert a HEIC URL to a base64 JPEG data URL (for PDF generation).
 * Returns null on failure.
 */
export async function convertHeicUrlToBase64(url: string): Promise<string | null> {
  if (!isHeicUrl(url)) return null; // not HEIC, caller should use normal loading

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const heicBlob = await response.blob();
    const heic2any = (await import('heic2any')).default;
    const jpegBlob = await heic2any({
      blob: heicBlob,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const result = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;

    // Convert blob to base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(result);
    });
  } catch (err) {
    console.warn('HEIC base64 conversion failed:', url, err);
    return null;
  }
}
