/**
 * Loads and compresses the SIIF logo for PDF embedding.
 * Uses 200×200px canvas with PNG format — lossless quality for logos
 * with sharp lines and text, while keeping file size reasonable.
 */
export const loadLogoForPdf = async (): Promise<string | undefined> => {
  try {
    const img = new Image();
    img.src = '/assets/SIIF Logo.png';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    if (!img.naturalWidth) return undefined;

    // Scale to max 200×200 — large enough for crisp rendering in PDF
    const MAX = 200;
    const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // White background then draw logo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // PNG is lossless — essential for logos with fine lines
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
};
