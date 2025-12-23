# Chavrutrail – Current Status

## Environment
- OS: Windows
- Dev tool: VS Code
- Mobile run: Expo Go (physical Android device)

---

## Repo Layout
- mobile/   → Expo React Native app
- backend/  → reserved (FastAPI later)
- docs/     → specs and status

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
- Existing users backfilled
- Profile CRUD works from app

### Checkpoint 4 – Navigation & Settings
- AuthGate implemented
- Bottom tabs: Feed / Create / Profile
- Profile stack with Settings screen
- Theme system (System / Light / Dark) implemented
- Language switch (Hebrew / English) implemented
- Preferences persisted via AsyncStorage

### Checkpoint 5 – Rides (Core MVP)
- public.rides table created (timestamptz, location, ride metadata)
- public.ride_participants table created
- RLS policies applied
- Trigger auto-creates owner participation row
- Create Ride wizard implemented:
  - When (date/time)
  - Where (map pin via react-native-maps + GPS)
  - Ride details (type, skill, distance, elevation)
  - Group settings (express / approval, max participants)
  - Review & publish
- Correct UTC storage with local (Israel) time display
- Feed screen lists upcoming published rides
- Feed ordered by start time
- Ride Details screen implemented (tap from Feed)
- End-to-end flow verified:
  Auth → Create → Persist → Feed → Ride Details

---

## How to Run
```bash
cd mobile
npx expo start -c


Known UI TODO

- Screen background styling in dark mode (Paper theme usage)