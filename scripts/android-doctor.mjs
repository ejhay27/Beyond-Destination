import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function version(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10_000 });
  return result.error || result.status !== 0 ? null : `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}
export function checkAndroidEnvironment({ report = true } = {}) {
  const missing = [];
  const javaBin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  const javacBin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac') : 'javac';
  const java = version(javaBin, ['-version']);
  const javac = version(javacBin, ['-version']);
  const javaMajor = Number(java?.match(/version "(\d+)/)?.[1]);
  if (javaMajor !== 21 || !javac?.startsWith('javac 21')) missing.push('JDK 21 (java and javac); set JAVA_HOME to its installation');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk || !existsSync(sdk)) missing.push('ANDROID_HOME pointing to an installed Android SDK');
  const sdkHas = (relative) => Boolean(sdk && existsSync(path.join(sdk, relative)));
  if (!sdkHas('platforms/android-36/android.jar')) missing.push('SDK platform: platforms;android-36');
  if (!sdkHas('build-tools/36.0.0')) missing.push('SDK build tools: build-tools;36.0.0');
  if (!sdkHas(`platform-tools/adb${process.platform === 'win32' ? '.exe' : ''}`)) missing.push('SDK platform-tools (adb)');
  const commandLine = sdkHas('cmdline-tools/latest/bin') || (sdkHas('cmdline-tools') && readdirSync(path.join(sdk, 'cmdline-tools')).some((name) => sdkHas(`cmdline-tools/${name}/bin`)));
  if (!commandLine) missing.push('Android SDK Command-line Tools (sdkmanager for installation/licenses)');
  const ready = missing.length === 0;
  if (report) {
    console.log(`Node ${process.version} · Capacitor 8.4.3`);
    console.log(`Java: ${java?.split('\n')[0] ?? 'NOT INSTALLED'}`);
    console.log(`Android SDK: ${sdk ?? 'NOT CONFIGURED'}`);
    console.log('Project: Gradle wrapper 8.14.3 · Android Gradle Plugin 8.13.0 · compile/target API 36 · min API 24');
    console.log('A system Gradle installation is NOT required. The checked-in wrapper downloads it.');
    if (ready) console.log('Local prerequisites found. This is a preflight, not proof of an APK or a device test.');
    else { console.log('Android APK build is blocked. Missing/incompatible prerequisites:'); for (const item of missing) console.log(`  - ${item}`); }
    console.log('See docs/ANDROID.md for exact setup, build, verification and device QA steps.');
  }
  return { ready, missing, sdk };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkAndroidEnvironment();
  process.exitCode = result.ready ? 0 : 1;
}
