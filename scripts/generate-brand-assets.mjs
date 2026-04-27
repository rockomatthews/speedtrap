/**
 * Generates static raster assets Google reliably crawls:
 * - public/favicon.ico (multi-size ICO from brand SVG)
 * - public/brand/og-share.png (Open Graph / rich results)
 *
 * Run: npm run generate:brand-assets
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public/brand/logo.svg');

async function main() {
  const svg = fs.readFileSync(svgPath);

  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(
    icoSizes.map((size) =>
      sharp(svg, { density: 400 })
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .png()
        .toBuffer()
    )
  );
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), await toIco(icoPngs));

  const logoHeight = Math.round(1200 / (2053.1 / 375.8));
  const logoPng = await sharp(svg, { density: 200 })
    .resize(1200, logoHeight, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  const og = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/brand/og-share.png'), og);

  const logo512 = await sharp(svg, { density: 300 })
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(root, 'public/brand/logo-512.png'), logo512);

  console.log('Wrote public/favicon.ico, public/brand/og-share.png, public/brand/logo-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
