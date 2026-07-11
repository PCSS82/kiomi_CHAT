// Script para generar iconos PNG desde SVG
// Ejecutar: node generar_iconos.js
// Requiere: npm install canvas

const fs = require('fs');
const path = require('path');

// Intenta usar canvas si está instalado
let Canvas;
try { Canvas = require('canvas'); } catch { Canvas = null; }

const SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="transparent"/>
      <stop offset="100%" stop-color="#d946ef" stop-opacity="0.8"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="250" fill="none" stroke="#e879f9" stroke-width="12"/>
  <circle cx="256" cy="256" r="256" fill="url(#glow)"/>
  <text x="256" y="300" font-size="220" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">🌸</text>
  <text x="256" y="470" font-size="72" font-weight="bold" text-anchor="middle"
        font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" fill="white"
        letter-spacing="2">Kiomi</text>
</svg>`;

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

if (Canvas) {
  [192, 512].forEach(size => {
    const svg = SVG_TEMPLATE.replace(/SIZE/g, size);
    const canvas = Canvas.createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const img = new Canvas.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      const buf = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf);
      console.log(`✓ icon-${size}.png generado`);
    };
    img.src = Buffer.from(svg);
  });
} else {
  // Sin canvas: guardar como SVG renombrado (funciona en la mayoría de navegadores modernos)
  const svg = SVG_TEMPLATE.replace(/SIZE/g, 512);
  fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), svg);
  fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), SVG_TEMPLATE.replace(/SIZE/g, 192));
  console.log('SVGs guardados. Para PNG instala: npm install canvas');
}
