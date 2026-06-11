const sharp = require('sharp');
const path = require('path');
const files = ['logo-cubik-nav.png', 'logo-cubik-nav-light.png'];
(async () => {
  for (const f of files) {
    const p = path.join(__dirname, '..', 'public', 'brand', f);
    const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
    let minY = info.height;
    let maxY = 0;
    let minX = info.width;
    let maxX = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] > 20) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    console.log(f, {
      canvas: `${info.width}x${info.height}`,
      content: `${maxX - minX + 1}x${maxY - minY + 1}`,
      topPad: minY,
      bottomPad: info.height - maxY - 1,
    });
  }
})();
