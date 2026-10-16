# Beyond Destination · Android edition

## Actual status (2026-10-16)

**Capacitor project created and web/plugin sync verified. No APK, emulator run or physical-device run has been produced in this sandbox.** `npm run android:doctor` reports that Java/JDK, the Android SDK/platform/build tools and command-line tools are missing. No emulator or adb is installed. Google's SDK/Maven distribution and Gradle distribution hosts are outside this environment's permitted outbound hosts, so installing an unverified partial toolchain here is not a useful build path.

The checked-in project is a thin Android host for the same Vite `dist/` and shared gameplay modules. The app does not connect to a game server, use a development-server URL, or rebuild the world in Java. `npm run android:sync` is **not** an APK build.

## Verified package/toolchain contract

| Requirement | Project value |
| --- | --- |
| Node | 22.17+ (tested here: 22.22.3) |
| Capacitor core / Android / CLI | 8.4.3, pinned in package-lock |
| Native plugins | App 8.1.2, Preferences 8.0.1, Filesystem 8.1.5, Share 8.0.3 |
| Java | **JDK 21**, both java and javac; required by generated native compileOptions |
| Gradle | **8.14.3** via checked-in wrapper; no system Gradle installation required |
| Android Gradle Plugin | **8.13.0** |
| SDK compile / target | **36** |
| Build tools | **36.0.0**, explicitly selected |
| Minimum Android API | **24** (Android 7), not a guarantee of performance/compatibility on all such devices |
| WebView | Current Android System WebView with WebGL 2; config rejects WebViews older than 110 |
| Required graphics | OpenGL ES 3.0 capability / WebGL 2; hardware acceleration enabled |
| Application ID | `io.beyonddestination.game` |
| App version | 0.2.0 / versionCode 1 |

Use an Android Studio installation that supports AGP 8.13, or the command-line SDK. Keep JDK/Gradle/AGP versions aligned; do not solve an unrelated host JDK problem by changing the game's shared source.

## Build on Windows

1. Install Node 22.17+ and **JDK 21**. In Android Studio's SDK Manager install **Android API 36**, **Build-Tools 36.0.0**, **Platform-Tools** and **Command-line Tools (latest)**. Accept Android SDK licenses.
2. Open a new PowerShell terminal in the repository. Set `JAVA_HOME` to the *actual* installed JDK 21 folder; the path below is an example, not an installer location:

```powershell
$env:JAVA_HOME = 'C:\Java\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

java -version
javac -version
sdkmanager --sdk_root="$env:ANDROID_HOME" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
sdkmanager --sdk_root="$env:ANDROID_HOME" --licenses

npm ci
npm test
npm run android:doctor
npm run android:debug
```

`android:debug` builds the web assets, runs Capacitor sync, checks prerequisites, invokes `gradlew.bat --no-daemon assembleDebug lintDebug`, checks that the output exists and is a nonempty ZIP, and runs **apksigner verify** before printing its size and SHA256. A failed preflight exits with status 1 instead of claiming an APK.

## Build on Linux/macOS

Install a JDK 21 and Android SDK at your chosen paths, then (adjust the two paths to those real installations):

```bash
export JAVA_HOME="$HOME/.jdks/jdk-21"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

java -version
javac -version
sdkmanager --sdk_root="$ANDROID_HOME" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
sdkmanager --sdk_root="$ANDROID_HOME" --licenses

npm ci
npm test
chmod +x android/gradlew
npm run android:doctor
npm run android:debug
```

On macOS the conventional SDK path is `$HOME/Library/Android/sdk`; select it instead if that is where Android Studio installed it. `ANDROID_SDK_ROOT` is also recognized by the preflight, but prefer `ANDROID_HOME` consistently. Gradle also understands an ignored `android/local.properties` SDK path. The preflight deliberately requires an environment SDK path to make command-line builds reproducible.

First builds require internet to obtain the Gradle distribution and Google/Maven dependencies. After dependencies and SDK are cached, the packaged game's startup/play is local/offline. Do not commit SDKs, caches, generated web assets, build outputs, local.properties or signing keys.

### Expected output after a successful build elsewhere

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

**That is an expected output location, not a file generated in this milestone.** The build helper only prints “Verified debug APK” when the real file passes its checks. For another independent check on Windows:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose android\app\build\outputs\apk\debug\app-debug.apk
Get-FileHash android\app\build\outputs\apk\debug\app-debug.apk -Algorithm SHA256
adb devices
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

On Linux/macOS use `"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose ...` and `sha256sum`/`shasum -a 256` respectively. A debug signature is for testing, not a Play Store release signature. For release, use Android Studio's **Generate Signed Bundle / APK**, keep the signing key/password outside the repository, increment versionCode, and follow distribution policy/device QA. No release signing or store upload is configured here.

### Android Studio and optional CI

```bash
npm run android:sync
npm run android:open
```

Android Studio must use JDK 21 for this Gradle project. Re-run sync after shared-source/plugin/config changes. Native sources/icons remain checked in, while copied `dist/` files are generated.

A separate **manual** `.github/workflows/android-debug.yml` provisions JDK/SDK on a GitHub runner, builds/lints/verifies and uploads a debug artifact if it succeeds. **It was not executed as part of this local milestone.** Once this workflow is available to GitHub Actions (normally after adding it to the default branch), select **Android debug APK (manual)** and the desired checked-in branch. This is optional CI, not runtime cloud storage or proof that an APK currently exists. The ordinary shared-game CI runs state/build/browser checks without an Android compile.

## Native implementation details

- `capacitor.config.json`: no `server.url`, HTTPS internal asset origin, no cleartext/mixed-content allowance. Web contents debugging is not forced on in production.
- Native App events pause/save/resume and handle Back. A menu/different app/screen lock must never leave movement or look held. Resume stays paused until the player chooses Return.
- Preferences holds the same versioned JSON slots. The JS adapter caches reads and flushes an ordered write queue; it does not duplicate save/gameplay rules. Import/export is explicit and account-free.
- Filesystem export writes only a small file under the app cache's `exports/`. Share hands it to the Android share sheet. FileProvider is restricted to that cache directory; there are no broad external-storage permissions.
- App data backup is disabled; no cloud sync is implemented. Clearing storage/uninstalling loses native saves. Export important lives first.
- SystemBars CSS insets and `viewport-fit=cover` support edge-to-edge layouts and cutouts. Orientation is not locked; configuration changes resize the shared renderer and clear pointers rather than restarting a separate game.
- Launcher legacy/round/adaptive/monochrome icons and launch theme are derived from **the existing SVG mark**, not Capacitor's template logo. Regenerate with `npm run android:icons` (Sharp is dev-only). Adaptive foreground artwork stays within the safe central region.

## Required emulator and physical-device QA (NOT YET PERFORMED)

Browser touch emulation verifies DOM/layout/input code, **not Android WebView, native Back, Preferences, file chooser, share-sheet or GPU drivers**. Before claiming Android support is device-verified:

1. Build/install the verified APK on an API-36 emulator and at least a modest Android phone and a tablet. Record manufacturer/model, Android/WebView version, RAM, GPU, resolution and selected quality. An emulator using software GPU is not a phone performance benchmark.
2. Start in airplane mode after install: no network/account should be required. Walk/run/jump, collide at buildings/water, rotate/look, zoom and switch both cameras.
3. Hold joystick + camera drag + third-finger jump. Mix keyboard/mouse with touch if supported. Tap UI while moving; world input must clear and page scrolling must not occur.
4. Complete Mira's entire route **without QA helpers**, check one parcel/one 35-credit reward, inspect inventory/journal, rest and advance the day.
5. Rotate portrait/landscape while moving, in dialogue, and in settings. Check gestures vs 3-button navigation, notches, font/display scaling, small phone and large tablet, and independently scrollable menus.
6. Back through dialogue → world, inventory → world, world → pause, pause → exit offer, and confirmation → cancel. Cancel all destructive prompts. Test failed-save exit consent too.
7. Lock/unlock the screen, switch apps, open the file chooser/share sheet, take a call/notification interruption, and resume. Time should not fast-forward; no camera/run/jump should stick. Use Developer Options “Don't keep activities” to exercise restoration.
8. Save, force-stop/restart, and reboot the device. Check all three slots, selected-target vs active autosave, credits/task/items/day/camera and imported schema-1 preferences. Check incomplete writes/low storage, not just a normal in-memory reload.
9. Export to a local file provider and import on PC. Export from PC and import on Android. Confirm rejection/cancellation of invalid/future saves and retention of the previous readable backup. Keep an external copy before uninstalling.
10. Measure 1/5/15-minute frame time, draw calls, memory and thermals on each real device; repeat Low/Balanced/High and shadows. Measure pause/background CPU/GPU and repeated rotation/menu/save cycles for leaks. Do not promise 30/60 FPS from headless browser results.
11. With a device/emulator attached, run `cd android` then `./gradlew connectedDebugAndroidTest` (Windows: `gradlew.bat connectedDebugAndroidTest`) for the checked-in package/asset smoke test. This test has not been executed here. Exercise WebGL context interruption/restore and outdated/disabled WebView errors. Check native Logcat, `lintDebug`, APK package/signature and permission list before distribution.

Career/shop/rental/construction tests are not possible in the audited source because those systems are absent. Recover/add their shared rules before adding device-specific presentations for them.
