// Generate PWA icons and logos
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// SVG template for the logo
const createLogoSVG = (size, variant = 'full') => {
  const scale = size / 512;
  
  const templates = {
    full: `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0284c7;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="url(#bgGrad)"/>
  
  <!-- House -->
  <path d="M256 110L115 220V370C115 385.464 127.536 398 143 398H210V295C210 284.507 218.507 276 229 276H283C293.493 276 302 284.507 302 295V398H369C384.464 398 397 385.464 397 370V220L256 110Z" fill="white"/>
  
  <!-- Door -->
  <rect x="227" y="302" width="58" height="96" rx="6" fill="#0ea5e9"/>
  <circle cx="272" cy="352" r="5" fill="white"/>
  
  <!-- Sparkle -->
  <circle cx="355" cy="165" r="28" fill="#fbbf24"/>
  <path d="M355 137L359.5 155.5L378 160L359.5 164.5L355 183L350.5 164.5L332 160L350.5 155.5L355 137Z" fill="white"/>
</svg>`,
    
    icon: `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="#0ea5e9"/>
  
  <!-- House simplified -->
  <path d="M256 110L115 220V370C115 385.464 127.536 398 143 398H210V295C210 284.507 218.507 276 229 276H283C293.493 276 302 284.507 302 295V398H369C384.464 398 397 385.464 397 370V220L256 110Z" fill="white"/>
  
  <!-- Door -->
  <rect x="227" y="302" width="58" height="96" rx="6" fill="white" fill-opacity="0.9"/>
</svg>`,
    
    mark: `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="#0ea5e9"/>
  
  <!-- House mark -->
  <path d="M256 100L100 220V400H200V300H312V400H412V220L256 100Z" fill="white"/>
  <rect x="230" y="320" width="52" height="80" fill="#0ea5e9"/>
</svg>`
  };
  
  return templates[variant] || templates.full;
};

// Generate Apple Touch Icon (simplified)
const appleTouchIcon = `<svg width="180" height="180" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0ea5e9"/>
  <path d="M256 100L100 220V400H200V300H312V400H412V220L256 100Z" fill="white"/>
  <rect x="230" y="320" width="52" height="80" fill="#0ea5e9"/>
</svg>`;

// Write SVGs
const publicDir = path.join(__dirname, '..', 'public');

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), createLogoSVG(192, 'icon'));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), createLogoSVG(512, 'icon'));
fs.writeFileSync(path.join(publicDir, 'logo.svg'), createLogoSVG(512, 'full'));
fs.writeFileSync(path.join(publicDir, 'logo-mark.svg'), createLogoSVG(512, 'mark'));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.svg'), appleTouchIcon);

console.log('✅ SVG icons generated');
console.log('Note: Convert to PNG using a tool like sharp or online converter');