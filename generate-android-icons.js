#!/usr/bin/env node

/**
 * Script to generate Android launcher icons from source image
 * This generates the required mipmap resources for all density buckets
 */

const fs = require('fs');
const path = require('path');

// Icon sizes for different density buckets (in dp, converted to px)
const iconSizes = {
  'mipmap-mdpi': 48,    // 1x
  'mipmap-hdpi': 72,    // 1.5x
  'mipmap-xhdpi': 96,   // 2x
  'mipmap-xxhdpi': 144, // 3x
  'mipmap-xxxhdpi': 192 // 4x
};

const sourceIcon = path.join(__dirname, 'src', 'assets', 'SG.png');
const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Check if sharp is available, otherwise provide instructions
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp package is required to generate icons.');
  console.error('   Please install it with: npm install --save-dev sharp');
  console.error('\n   Alternatively, run: npm run regenerate-icons');
  process.exit(1);
}

async function generateIcons() {
  if (!fs.existsSync(sourceIcon)) {
    console.error(`❌ Source icon not found: ${sourceIcon}`);
    process.exit(1);
  }

  console.log('🔄 Generating Android launcher icons...');
  console.log(`   Source: ${sourceIcon}`);

  // Create mipmap directories and generate icons
  for (const [density, size] of Object.entries(iconSizes)) {
    const mipmapDir = path.join(resDir, density);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(mipmapDir)) {
      fs.mkdirSync(mipmapDir, { recursive: true });
    }

    // Generate ic_launcher.png
    const launcherPath = path.join(mipmapDir, 'ic_launcher.png');
    await sharp(sourceIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(launcherPath);
    console.log(`   ✅ Created ${density}/ic_launcher.png (${size}x${size})`);

    // Generate ic_launcher_round.png (same as regular for now)
    const roundPath = path.join(mipmapDir, 'ic_launcher_round.png');
    await sharp(sourceIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(roundPath);
    console.log(`   ✅ Created ${density}/ic_launcher_round.png (${size}x${size})`);
  }

  console.log('\n✅ Icon generation complete!');
  console.log('   You can now build your Android app.');
}

generateIcons().catch(err => {
  console.error('❌ Error generating icons:', err);
  process.exit(1);
});














