// Convert SVG icons to PNG using sharp
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');

const icons = [
  { svg: 'icon-192.svg', png: 'icon-192.png', size: 192 },
  { svg: 'icon-512.svg', png: 'icon-512.png', size: 512 },
  { svg: 'apple-touch-icon.svg', png: 'apple-touch-icon.png', size: 180 },
];

async function convertIcons() {
  for (const icon of icons) {
    const svgPath = path.join(publicDir, icon.svg);
    const pngPath = path.join(publicDir, icon.png);
    
    try {
      await sharp(svgPath)
        .resize(icon.size, icon.size)
        .png()
        .toFile(pngPath);
      
      console.log(`✅ ${icon.png} created`);
    } catch (error) {
      console.error(`❌ Error creating ${icon.png}:`, error.message);
    }
  }
}

convertIcons();