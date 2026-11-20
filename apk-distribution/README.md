# APK Distribution (`apk-distribution`)

This directory stores verified Android APK artifacts and SHA-256 checksums produced by local Gradle builds or the automated GitHub Actions release workflow (`.github/workflows/android-apk-release.yml`).

## Local Build & Verification

Run from the repository root on a machine with **JDK 17** and the **Android SDK** (`ANDROID_HOME`) installed:

```bash
# 1. Build the debug APK
gradle assembleDebug

# 2. Verify APK metadata with aapt2
"$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -n 1)/aapt2" \
  dump badging app/build/outputs/apk/debug/app-debug.apk

# 3. Verify APK signature with apksigner
"$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -n 1)/apksigner" \
  verify --verbose --print-certs app/build/outputs/apk/debug/app-debug.apk

# 4. Copy verified APK and checksum into apk-distribution/
cp app/build/outputs/apk/debug/app-debug.apk apk-distribution/MuedPdfPro-debug.apk
sha256sum apk-distribution/MuedPdfPro-debug.apk > apk-distribution/MuedPdfPro-debug.apk.sha256
```

## Optional Signed Release Secrets (GitHub Actions)

To enable signed release APK publishing in GitHub Actions, add the following repository secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded `.jks` or `.keystore` file
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Signing key alias
- `ANDROID_KEY_PASSWORD`: Signing key password
