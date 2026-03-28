Deploy these files on your HTTPS site so Universal Links (iOS) and App Links (Android) verify.

URLs (must return 200, no redirects on the JSON files if possible):
  https://t360.in/.well-known/apple-app-site-association
  https://t360.in/.well-known/assetlinks.json

Also host the same under https://www.t360.in/.well-known/ if you use the www host.

Before publishing:
  apple-app-site-association: replace YOUR_APPLE_TEAM_ID with your 10-character Apple Team ID (Membership page in developer.apple.com). appID format is TEAMID.bundleid

  assetlinks.json: replace EACH_PLACEHOLDER_SHA256 with your app signing certificate SHA-256 fingerprints (release + optional debug). Get release fingerprint:
    keytool -list -v -keystore your-release.keystore -alias your-alias

After deploy: iOS can take some time to refresh; Android "adb shell pm verify-app-links --re-verify com.toastmaster360.mobile"
