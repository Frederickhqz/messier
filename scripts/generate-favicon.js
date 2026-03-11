const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');

async function generateFavicon() {
  // Generate favicon.png (32x32)
  await sharp(path.join(publicDir, 'logo-mark.svg'))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32.png'));
  console.log('✅ favicon-32.png created');

  // Generate favicon.png (16x16)
  await sharp(path.join(publicDir, 'logo-mark.svg'))
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16.png'));
  console.log('✅ favicon-16.png created');

  // Generate og-image.png (1200x630)
  await sharp(path.join(publicDir, 'logo.svg'))
    .resize(1200, 630, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('✅ og-image.png created');
}

generateFavicon().catch(console.error);