import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

// Optional restricted-Linux fallback: the npm-distributed headless browser includes
// SwiftShader and NSS libraries. No CDN browser download or root apt install needed.
export async function browserRuntime() {
  if (process.env.BROWSER_PATH) return { executablePath: process.env.BROWSER_PATH, headless: true, args: ['--enable-unsafe-swiftshader'] };
  if (process.platform !== 'linux' || process.arch !== 'x64') return { headless: true };
  const { default: chromium } = await import('@sparticuz/chromium');
  const packageBuild = path.dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium')));
  const folder = path.resolve('.artifacts/chromium-libs');
  await mkdir(folder, { recursive: true });
  try { await access(path.join(folder, 'lib/libnspr4.so')); }
  catch {
    const tar = path.join(folder, 'al2023.tar');
    const archive = await readFile(path.resolve(packageBuild, '../bin/al2023.tar.br'));
    await writeFile(tar, brotliDecompressSync(archive));
    execFileSync('tar', ['-xf', tar, '-C', folder]);
  }
  return {
    executablePath: await chromium.executablePath(), headless: true,
    args: chromium.args.filter((arg) => !arg.includes('web-security') && !arg.includes('insecure-content') && arg !== '--single-process'),
    env: { ...process.env, LD_LIBRARY_PATH: `${folder}/lib:${process.env.LD_LIBRARY_PATH ?? ''}` },
  };
}
