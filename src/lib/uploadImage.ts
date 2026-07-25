// Client-side image handling: resize + convert to base64 data URI.
// Avoids storage buckets entirely — stored directly in the image_url / logo_url text columns.

export async function fileToBase64Resized(
  file: File,
  maxSize = 800,
  quality = 0.75,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    if (width >= height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas غير مدعوم");
  ctx.drawImage(img, 0, 0, width, height);
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const out = canvas.toDataURL(mime, quality);
  if (out.length > 900_000) {
    // Compress harder if still large
    return canvas.toDataURL("image/jpeg", 0.55);
  }
  return out;
}

// Backwards-compat shim used by existing screens.
export async function uploadTenantImage(_tenantId: string, file: File, _prefix?: string): Promise<string> {
  return fileToBase64Resized(file);
}
