import sharp from "sharp";

const maxImageDimension = 1024;
const skewSampleWidth = 400;

function estimateDeskewAngle(data: Buffer, width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  let bestAngle = 0;
  let bestScore = 0;
  for (let angle = -3; angle <= 3; angle += 0.5) {
    const radians = angle * Math.PI / 180;
    const sine = Math.sin(radians);
    const cosine = Math.cos(radians);
    const rows = new Uint32Array(height);
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const brightness = data[y * width + x];
        if (brightness > 175) continue;
        const rotatedY = Math.round((x - centerX) * sine + (y - centerY) * cosine + centerY);
        if (rotatedY >= 0 && rotatedY < height) rows[rotatedY] += 1;
      }
    }
    const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    const score = rows.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    if (score > bestScore) { bestScore = score; bestAngle = angle; }
  }
  return Math.abs(bestAngle) >= 0.5 ? bestAngle : 0;
}

export async function preprocessImage(bytes: Uint8Array) {
  const source = sharp(Buffer.from(bytes), { limitInputPixels: 25_000_000 });
  const normalized = source.clone().rotate().resize({ width: skewSampleWidth, height: skewSampleWidth, fit: "inside", withoutEnlargement: true }).greyscale();
  const { data, info } = await normalized.raw().toBuffer({ resolveWithObject: true });
  const angle = estimateDeskewAngle(data, info.width, info.height);
  const output = await source.rotate().rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).median(3).normalise().sharpen({ sigma: 1 }).trim({ background: { r: 255, g: 255, b: 255 }, threshold: 12 }).resize({ width: maxImageDimension, height: maxImageDimension, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return { bytes: output, angle, dataUrl: `data:image/png;base64,${output.toString("base64")}` };
}
