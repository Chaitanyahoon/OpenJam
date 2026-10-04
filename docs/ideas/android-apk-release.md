# OpenJam Android APK Standalone Release

## Problem Statement
How might we compile, sign, and distribute an authentic, installable Android APK binary (`openjam-v1.0.0.apk`) for OpenJam that installs with one tap on any Android phone, replacing the non-runnable JavaScript bundle (`openjam-android-v1.0.0-bundle.zip`) on GitHub release `v1.0.0-mobile`?

## Recommended Direction: Local Native Gradle Assemble & CI Automated Release
Build a self-contained, sideloadable Android APK locally using the machine's configured JDK 21 (`C:\Program Files\Java\jdk-21`) and Android SDK 34/35 (`C:\Users\patil\AppData\Local\Android\Sdk`). 

1. **Native Prebuild**: Execute `npx expo prebuild --platform android --clean` in `mobile/` to produce a pristine native Android project with all Expo autolinked plugins (`expo-audio`, `expo-notifications`, `expo-splash-screen`, etc.).
2. **Gradle Assembly**: Configure `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the local SDK, then assemble the standalone APK via Gradle (`gradlew.bat assembleRelease` or unsigned `assembleRelease` with standard release signing).
3. **Release Packaging**:
   - Rename output binary to `openjam-v1.0.0.apk`.
   - Upload `openjam-v1.0.0.apk` directly to GitHub release `v1.0.0-mobile` (`gh release upload v1.0.0-mobile ... --clobber`).
   - Remove the non-executable `openjam-android-v1.0.0-bundle.zip` from release assets.
   - Update release notes with direct download link, file size, SHA256 checksum, and sideload installation instructions (Settings > Install unknown apps).
4. **CI Automation**: Add `.github/workflows/android-release.yml` so that subsequent version tags (`v*`) build the APK automatically on GitHub Actions and attach it to releases.

## Key Assumptions to Validate
- [ ] **Assumption 1**: Expo 57 and Android Gradle Plugin 8.7+ can build with JDK 21 without major Gradle version incompatibilities.
  *Validation*: Test Gradle execution with `JAVA_HOME="C:\Program Files\Java\jdk-21"` during `prebuild` and `assemble`.
- [ ] **Assumption 2**: Sideloadable Release APK works without requiring a Google Play Console private signing key.
  *Validation*: Configure the release build type in `app/build.gradle` to sign with standard release key or fallback to debug signing config for instant sideloading.
- [ ] **Assumption 3**: Standalone APK installs cleanly on physical Android devices without requiring Metro dev server or Expo Go.
  *Validation*: Ensure Hermes JS bundle is compiled directly into the APK assets (`assets/index.android.bundle`).

## MVP Scope
- Clean prebuild in `mobile/android/` with package name `fun.openjam.app`.
- Successfully generated standalone APK file (`openjam-v1.0.0.apk`) containing Hermes bytecode, native C++ audio libraries, and Android manifest.
- Replaced GitHub release asset on `v1.0.0-mobile` with `openjam-v1.0.0.apk`.
- Updated release notes with SHA256 hash and Android installation guide.
- GitHub Actions workflow `.github/workflows/android-release.yml` committed to `main` and `mobile-app`.

## Not Doing (and Why)
- **Google Play Store AAB Publishing**: Out of scope for a direct GitHub release; requires Google Play Console developer account ($25 fee) and privacy policy approvals.
- **EAS Cloud Build Queue**: Skipped in favor of local build to eliminate external account dependencies and cloud build queue latency.
- **ADB direct device installation**: User explicitly stated no ADB commands on local devices.
- **Modifying `frontend-next/`**: Web application remains 100% untouched.

## Open Questions
- None. Build environment (JDK 21, Android SDK 34/35) is verified and ready for execution.
