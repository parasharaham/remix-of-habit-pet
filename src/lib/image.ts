/**
 * Client-side image preprocessing for the AI Food Scanner.
 * Guarantees the data URL sent to the AI is a non-empty JPEG under the size cap.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // hard reject before decoding
const MAX_EDGE = 1280; // longest side after resize
const TARGET_BYTES = 1_200_000; // ~1.2 MB encoded payload budget
const MIN_BASE64_LEN = 200;

const SUPPORTED = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

function base64Len(dataUrl: string) {
  const i = dataUrl.indexOf(",");
  return i === -1 ? 0 : dataUrl.length - i - 1;
}

export function dataUrlBytes(dataUrl: string) {
  return Math.floor((base64Len(dataUrl) * 3) / 4);
}

async function decode(source: Blob): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(source);
      return { width: bmp.width, height: bmp.height, draw: bmp };
    } catch {
      /* fall through to <img> decoding (e.g. HEIC or bitmap unsupported) */
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize + compress any image source into a JPEG data URL safe for the AI request. */
export async function prepareImage(source: Blob | HTMLVideoElement): Promise<string> {
  let width: number;
  let height: number;
  let draw: CanvasImageSource;

  if (source instanceof Blob) {
    if (source.size === 0) throw new Error("That file is empty. Please pick another photo.");
    if (source.size > MAX_UPLOAD_BYTES) throw new Error("Image must be under 15 MB.");
    if (source.type && !SUPPORTED.test(source.type)) {
      throw new Error("Unsupported image. Please use a JPEG, PNG or WebP photo.");
    }
    const decoded = await decode(source).catch(() => {
      throw new Error("We couldn't read that image. Please try another photo.");
    });
    width = decoded.width;
    height = decoded.height;
    draw = decoded.draw;
  } else {
    width = source.videoWidth || 1280;
    height = source.videoHeight || 720;
    draw = source;
  }

  if (!width || !height) throw new Error("We couldn't read that image. Please try another photo.");

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't supported on this device.");
  // White matte so transparent PNGs don't become black blobs for the model.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(draw, 0, 0, w, h);
  if ("close" in draw && typeof (draw as ImageBitmap).close === "function") (draw as ImageBitmap).close();

  let quality = 0.85;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (dataUrlBytes(out) > TARGET_BYTES && quality > 0.4) {
    quality -= 0.15;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  if (!out.startsWith("data:image/jpeg;base64,") || base64Len(out) < MIN_BASE64_LEN) {
    throw new Error("That image looks empty. Please try another photo.");
  }
  return out;
}
