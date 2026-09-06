// Utility to optimize and compress images on the client before network transmission
// Prevents HTTP 413 Payload Too Large and "Failed to fetch" network drops caused by multi-megabyte camera photos.

export async function optimizeImage(
  fileOrDataUrl: File | string,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined') {
        if (typeof fileOrDataUrl === 'string') return resolve(fileOrDataUrl);
        return resolve('');
      }

      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // If image is already reasonably sized and below max dimensions
          if (width <= maxDimension && height <= maxDimension) {
            // If already a small dataUrl, return directly
            if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.length < 500000) {
              return resolve(fileOrDataUrl);
            }
          }

          // Compute proportional scaled dimensions
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (typeof fileOrDataUrl === 'string') return resolve(fileOrDataUrl);
            return resolve('');
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Output high-legibility compressed JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (canvasErr) {
          console.warn('Canvas optimization fallback:', canvasErr);
          if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
          else resolve('');
        }
      };

      img.onerror = () => {
        console.warn('Image load error during optimization, returning fallback');
        if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
        else resolve('');
      };

      if (typeof fileOrDataUrl === 'string') {
        img.src = fileOrDataUrl;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = (e.target?.result as string) || '';
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileOrDataUrl);
      }
    } catch (err) {
      console.warn('optimizeImage global catch:', err);
      if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
      else resolve('');
    }
  });
}
