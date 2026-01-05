const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, fileName) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background - Deep Medical Green
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, size, size);

    // Medical Cross - Vibrant Green
    const padding = size * 0.2;
    const crossWidth = size * 0.15;
    const crossLength = size * 0.5;

    ctx.fillStyle = '#10b981';
    
    // Vertical bar
    ctx.fillRect((size - crossWidth) / 2, (size - crossLength) / 2 - size * 0.05, crossWidth, crossLength);
    // Horizontal bar
    ctx.fillRect((size - crossLength) / 2, (size - crossWidth) / 2 - size * 0.05, crossLength, crossWidth);

    // Text "ДОКТОР ОПУС"
    ctx.fillStyle = '#ffffff';
    const fontSize = Math.floor(size * 0.12);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    
    // Draw text at the bottom
    ctx.fillText('ДОКТОР ОПУС', size / 2, size - padding / 2);

    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(__dirname, '..', 'public', fileName);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Updated ${fileName} (${size}x${size}) with green theme and text.`);
}

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

generateIcon(192, 'icon-192.png');
generateIcon(512, 'icon-512.png');
