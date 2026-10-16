import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android/app/src/main/res');
const source = await readFile(path.join(root, 'assets/beyond-destination-mark.svg'), 'utf8');
const inner = source.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(13.2 13.2) scale(.85)">${inner}</g></svg>`;
const legacy = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" rx="18" fill="#10202a"/><g transform="translate(6 6)">${inner}</g></svg>`;
for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  const folder = path.join(res, `mipmap-${density}`); await mkdir(folder, { recursive: true });
  await sharp(Buffer.from(legacy)).resize(size, size).png().toFile(path.join(folder, 'ic_launcher.png'));
  const mask = `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`;
  await sharp(Buffer.from(legacy)).resize(size, size).composite([{ input: Buffer.from(mask), blend: 'dest-in' }]).png().toFile(path.join(folder, 'ic_launcher_round.png'));
  await sharp(Buffer.from(foreground)).resize(size * 108 / 48, size * 108 / 48).png().toFile(path.join(folder, 'ic_launcher_foreground.png'));
}
function vector(monochrome = false) {
  const paths = [...inner.matchAll(/<path\s+([^>]+)\/>/g)].map(([, attributes]) => {
    const attrs = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]+)"/g)].map(([, key, value]) => [key, value]));
    return `    <path android:pathData="${attrs.d}" android:fillColor="@android:color/transparent" android:strokeColor="${monochrome ? '#FFFFFF' : attrs.stroke}" android:strokeWidth="${attrs['stroke-width']}" android:strokeLineCap="${attrs['stroke-linecap'] ?? 'butt'}" android:strokeLineJoin="${attrs['stroke-linejoin'] ?? 'miter'}" />`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<!-- Derived from assets/beyond-destination-mark.svg by npm run android:icons. -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n  <group android:translateX="13.2" android:translateY="13.2" android:scaleX="0.85" android:scaleY="0.85">\n${paths}\n  </group>\n</vector>\n`;
}
await writeFile(path.join(res, 'drawable-v24/ic_launcher_foreground.xml'), vector());
await writeFile(path.join(res, 'drawable/ic_launcher_monochrome.xml'), vector(true));
for (const api of [26, 33]) {
  const folder = path.join(res, `mipmap-anydpi-v${api}`); await mkdir(folder, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background" />\n  <foreground android:drawable="@drawable/ic_launcher_foreground" />\n${api >= 33 ? '  <monochrome android:drawable="@drawable/ic_launcher_monochrome" />\n' : ''}</adaptive-icon>\n`;
  for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) await writeFile(path.join(folder, file), xml);
}
console.log('Generated legacy, round, adaptive and monochrome launcher icons from the existing mark.');
