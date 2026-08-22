# Google Sign-In setup (MediChain+ mobile)

Error **400: invalid_request** means Google rejected the OAuth request — usually a **wrong client ID** or **missing Android OAuth client**.

## 1. Firebase (already done)

Project: `mediclues-e39db`  
Enable **Authentication → Sign-in method → Google**.

Copy **Web client ID** → `mobile/.env`:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=675557370566-xxxx.apps.googleusercontent.com
```

## 2. Android OAuth client (required on phone)

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials** → **Create credentials** → **OAuth client ID** → type **Android**.

### Testing in **Expo Go**

| Field | Value |
|--------|--------|
| Package name | `host.exp.exponent` |
| SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

### Production / dev build (`com.medichain.mobile`)

| Field | Value |
|--------|--------|
| Package name | `com.medichain.mobile` |
| SHA-1 | Run: `cd mobile && npx expo prebuild` then `cd android && ./gradlew signingReport` |

Copy the new **Android client ID** (different from Web!) into `.env`:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=675557370566-yyyyy.apps.googleusercontent.com
```

## 3. Web client redirect URIs (optional)

Credentials → your **Web** client → **Authorized redirect URIs** → add:

```
medichain://oauth2redirect
```

After changing `.env`, restart Metro with cache clear:

```bash
npx expo start -c
```

## 4. OAuth consent screen

Set app name, support email, and add your Gmail as a **Test user** while the app is in Testing mode.
