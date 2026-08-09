// Compresses a screenshot before it's stored as a base64 data URL.
// Chart screenshots pasted straight from clipboard/phone are often 2-5MB —
// that's what made saving, loading, and "AI Summary" feel slow. Resizing to a
// sane max dimension + re-encoding as JPEG cuts that to ~100-300KB with no
// visible loss for reading candles/levels, which speeds up every save, every
// page load, and every AI call that sends these images to Gemini.
export function compressImage(file, { maxDim = 1600, quality = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Same idea, but for images that are already a data URL (e.g. clipboard paste
// already converted upstream) — re-encodes/downsizes in place.
export function compressDataUrl(dataUrl, opts) {
  return fetch(dataUrl).then(r => r.blob()).then(blob => compressImage(blob, opts));
}
