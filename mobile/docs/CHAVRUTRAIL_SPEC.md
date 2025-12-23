# Chavrutrail – MVP Specification

## Overview
Chavrutrail is an Android-first mobile application for matching off-road cyclists
in Israel (MTB / Gravel) for shared rides, optimized for operational compatibility
(pace, skill, terrain, timing), not social/dating use.

The MVP targets fast, low-friction ride discovery and joining, with lightweight
trust and privacy.

---

## Target Platform
- Android first (physical device + Expo Go)
- iOS later (no architectural blockers)

---

## Technology Stack

### Mobile
- React Native + Expo
- TypeScript
- react-native-paper (Material Design 3)
- i18next + react-i18next
- RTL support (Hebrew-first)

### Backend / Data
- Supabase:
  - Auth: Phone OTP
  - Database: PostgreSQL
  - RLS enabled
  - Realtime (future chat)
- SMS provider: Twilio Verify (configured in Supabase)

### Backend API
- FastAPI (Python) – reserved for later phases
  (moderation, scoring, jobs, integrations)

---

## Authentication
- Phone OTP only
- Session persistence enabled
- OTP typically required:
  - first login
  - new device
  - logout / reinstall
- Phone number is NOT duplicated in app tables

---

## Data Model (MVP)

### auth.users (Supabase-managed)
- id (uuid)
- phone (authoritative)
- created_at

### public.profiles
- id (uuid, FK to auth.users)
- created_at
- updated_at
- display_name
- home_region
- ride_type
- skill
- pace
- preferred_ride_times

Profiles are auto-created via DB trigger on new auth user.

---

## Privacy Principles
- Phone numbers are private and never exposed to other users
- profiles table does NOT store raw phone numbers
- App-facing identity uses display_name only

---

## UI / UX Principles (Strava-like)

- Clean, minimal UI
- Consistent components:
  - Cards (rides)
  - Chips (filters)
  - BottomSheet (filters)
  - FAB (create ride)
- Motion: subtle (150–250ms)
- Skeleton loading
- Icons consistent
- Max 2–3 brand colors, rest neutral

---

## Navigation (MVP)
Bottom Tabs:
- Feed / Discover
- Create (FAB / center action)
- Profile

Filters open as Bottom Sheet from Feed.

---

## MVP Screens

- Feed / Discover
- Filters (Bottom Sheet)
- Ride Details
- Create Ride (short wizard)
- Ride Chat (text-only initially)
- Profile
- Settings (Dark Mode, Language, Notifications)

---

## Internationalization
- Hebrew-first (RTL)
- English supported
- All strings externalized
- Layout supports RTL/LTR

---

## KPIs (MVP)
- Time to first joined ride
- % of rides that actually happened
- Repeat rides with same people
