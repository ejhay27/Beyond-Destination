import { spawnSync } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { checkAndroidEnvironment } from './android-doctor.mjs';

const environment = checkAndroidEnvironment();
if (!environment.ready) process.exit(1);
const windows = process.platform === 'win32';
const gradle = spawnSync(windows ? 'gradlew.bat' : './gradlew', ['--no-daemon', 'assembleDebug', 'lintDebug'], { cwd: 'android', stdio: 'inherit', shell: windows });
if (gradle.error || gradle.status !== 0) process.exit(gradle.status || 1);
const apk = path.resolve('android/app/build/outputs/apk/debug/app-debug.apk');
const bytes = await readFile(apk);
if ((await stat(apk)).size === 0 || bytes.subarray(0, 2).toString() !== 'PK') throw new Error('APK missing, empty, or not a ZIP archive.');
const signer = path.join(environment.sdk, 'build-tools', '36.0.0', windows ? 'apksigner.bat' : 'apksigner');
const verified = spawnSync(signer, ['verify', '--verbose', apk], { stdio: 'inherit', shell: windows });
if (verified.error || verified.status !== 0) throw new Error('APK signature verification failed.');
console.log(`Verified debug APK: ${apk}\nBytes: ${bytes.length}\nSHA256: ${createHash('sha256').update(bytes).digest('hex')}`);
console.log('A debug build is for testing, not a signed Play Store release. Run the device QA checklist before distribution.');
