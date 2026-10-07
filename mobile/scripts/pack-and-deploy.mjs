import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ANDROID_SDK = 'C:\\Users\\patil\\AppData\\Local\\Android\\Sdk';
const BUILD_TOOLS = path.join(ANDROID_SDK, 'build-tools', '35.0.0');
const ADB = path.join(ANDROID_SDK, 'platform-tools', 'adb.exe');
const APK_SIGNER = path.join(BUILD_TOOLS, 'apksigner.bat');
const ZIPALIGN = path.join(BUILD_TOOLS, 'zipalign.exe');
const JAR = 'C:\\Program Files\\Java\\jdk-21\\bin\\jar.exe';
const HERMESC = path.resolve('node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe');
const KEYSTORE = path.resolve('android/app/debug.keystore');
const ARTIFACT_DIR = 'C:\\Users\\patil\\.gemini\\antigravity\\brain\\ab537cc9-67af-40b4-a0f9-9040fe8ded7b';

console.log('--- OpenJam Live Device Deployment Pipeline ---');

// Ensure dist directories
fs.mkdirSync('dist/assets', { recursive: true });

// 1. Bundle JS
console.log('1. Bundling React Native JavaScript...');
execSync('npx expo export:embed --platform android --dev false --entry-file node_modules/expo-router/entry.js --bundle-output dist/index.android.bundle --assets-dest dist/res', {
  stdio: 'inherit',
});

// 2. Compile to Hermes bytecode
console.log('2. Compiling with Hermes bytecode compiler...');
execSync(`"${HERMESC}" -emit-binary -out "dist/assets/index.android.bundle" "dist/index.android.bundle"`, {
  stdio: 'inherit',
});

// 3. Prepare APK
console.log('3. Injecting JS bundle and resized icon/splash resources into base APK...');
const baseApk = path.resolve('openjam-v1.0.3.apk');
const workingApk = path.resolve('dist/openjam-temp.apk');
const alignedApk = path.resolve('dist/openjam-aligned.apk');
fs.copyFileSync(baseApk, workingApk);

// Update assets/index.android.bundle inside workingApk
execSync(`"${JAR}" uf "${workingApk}" assets/index.android.bundle`, {
  cwd: path.resolve('dist'),
  stdio: 'inherit',
});

// Update resized launcher icon and splashscreen resources inside workingApk
const apkInjectionDir = path.resolve('dist/apk_injection');
if (fs.existsSync(apkInjectionDir)) {
  execSync(`"${JAR}" uf "${workingApk}" -C "${apkInjectionDir}" res`, {
    stdio: 'inherit',
  });
  console.log('Successfully injected custom adaptive launcher icons and splashscreen resources into APK!');
}

// 4. Zipalign
console.log('4. Aligning APK...');
if (fs.existsSync(alignedApk)) fs.unlinkSync(alignedApk);
execSync(`"${ZIPALIGN}" -f -p 4 "${workingApk}" "${alignedApk}"`, {
  stdio: 'inherit',
});

// 5. Sign with debug keystore
console.log('5. Signing APK with debug certificate...');
execSync(`"${APK_SIGNER}" sign --ks "${KEYSTORE}" --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android "${alignedApk}"`, {
  stdio: 'inherit',
});

console.log('APK successfully built and signed: ' + alignedApk);

// 6. Check ADB device
console.log('6. Checking ADB device connection...');
let devicesOutput = '';
try {
  devicesOutput = execSync(`"${ADB}" devices`, { encoding: 'utf8' });
} catch (e) {
  console.log('Could not query ADB devices.');
}

const lines = devicesOutput.trim().split('\n').filter(l => l.trim() && !l.startsWith('List of'));
const activeDevice = lines.find(l => l.includes('device') && !l.includes('offline'));

if (activeDevice) {
  const deviceId = activeDevice.split(/\s+/)[0];
  console.log(`Device found: ${deviceId}. Installing updated APK...`);
  execSync(`"${ADB}" -s ${deviceId} install -r -d "${alignedApk}"`, { stdio: 'inherit' });

  console.log('7. Relaunching OpenJam MainActivity...');
  execSync(`"${ADB}" -s ${deviceId} shell am force-stop fun.openjam.app`, { stdio: 'inherit' });
  execSync(`"${ADB}" -s ${deviceId} shell am start -n fun.openjam.app/.MainActivity`, { stdio: 'inherit' });

  // Wait 1.5s for initial render
  execSync('powershell -Command "Start-Sleep -Milliseconds 1500"');

  console.log('8. Capturing live device screenshot...');
  const screenTarget = path.join(ARTIFACT_DIR, 'live_updated_device.png');
  execSync(`"${ADB}" -s ${deviceId} shell screencap -p /sdcard/live_updated_device.png`);
  execSync(`"${ADB}" -s ${deviceId} pull /sdcard/live_updated_device.png "${screenTarget}"`);
  console.log('Screenshot captured to ' + screenTarget);
} else {
  console.log('Note: Physical device is not currently attached to ADB.');
  console.log('Signed APK is ready at: dist/openjam-aligned.apk');
  console.log('Run `node scripts/pack-and-deploy.mjs` anytime after reconnecting USB debugging.');
}

console.log('--- Pipeline complete! ---');
