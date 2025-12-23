# Chavrutrail – Current Status

## Environment
- OS: Windows
- Dev tool: VS Code
- Mobile run: Expo Go (physical Android device)

---

## Repo Layout
- mobile/  → Expo React Native app
- backend/ → reserved (FastAPI later)
- docs/    → specs and status

---

## Completed Checkpoints

### Checkpoint 1 – App bootstrap
- Expo app running on Android
- Hebrew i18n working
- RTL enabled

### Checkpoint 2 – Authentication
- Supabase Phone OTP works
- Twilio Verify configured
- User can sign in and stay signed in
- Verified user visible in Supabase Auth
- DEV auth bypass (email/password) added due to Twilio block

### Checkpoint 3 – Profiles
- public.profiles table created
- RLS policies applied
- Trigger auto-creates profile on new auth user
- Existing user backfilled
- Profile CRUD works from app

### Checkpoint 4 – Navigation & Settings
- AuthGate implemented
- Bottom tabs: Feed / Create / Profile
- Profile stack with Settings screen
- Theme system (System / Light / Dark) implemented
- Language switch (Hebrew / English) implemented
- Preferences persisted via AsyncStorage

---

## How to Run
```bash
cd mobile
npx expo start -c

Known UI TODO
- Screen background styling in dark mode (Paper theme usage)