# Bishvil – Project Status

**Status:** Production-ready MVP  
**Last updated:** December 2025

---

## Overview

Bishvil is a mobile app for organizing and joining cycling rides.  
The MVP is fully implemented, tested on real Android devices, and ready for pilot testing.

Core principles:
- Simple UX (no unnecessary GPS complexity)
- Hebrew/English bilingual support with proper RTL/LTR
- Reliable real-time flows (join, approve, cancel)
- Fast local development cycle

---

## Tech Stack

- **Frontend:** Expo + React Native (TypeScript)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, RLS)
- **Auth:** Phone OTP (Twilio)
- **Maps:** Mapbox GL + Israel Hiking Map tiles
- **Storage:** AsyncStorage (sessions, preferences)
- **Platform:** Android (APK distribution)

---

## MVP Scope (M1) – ✅ Complete

### Authentication
- Phone OTP login
- Persistent sessions (no re-login)
- Profile auto-creation on signup
- Multi-user testing validated

### Ride Creation
- Step-based wizard:
  - When (date, time, duration)
  - Where (text + map pin)
  - Details (discipline, skill, pace, distance, elevation)
  - Group rules (instant join vs approval)
  - Review & publish
- Prevents invalid or past rides

### Ride Participation
- Express join or approval flow
- Owner approve/reject requests
- Participant leave
- Owner cancel (removes ride from feed)
- Real-time participant counts

### Feed & Filters
- Upcoming rides feed
- Filters by:
  - Discipline
  - Skill level
  - Time range
  - Distance radius (optional)
- Persistent filter preferences
- Clean empty states

### Profiles
- Display name
- Discipline preferences
- Skill & pace
- Optional bio (500 chars)
- Language & theme settings

### Internationalization
- Hebrew + English
- Full RTL/LTR support
- Device language detection
- Persistent language choice
- Stable tab order across languages

### UI & UX
- Light / Dark / System themes
- Consistent iconography and colors
- Loading & disabled states everywhere
- Defensive validation (no silent failures)

---

## Maps & Location

- Full Mapbox GL integration (native build)
- Israel Hiking Map tiles (trails, contours)
- Location selection via:
  - Current location
  - Full-screen map picker
- Stored silently (no coordinate exposure)
- External navigation via Google Maps / Waze

Design choice:
> Text + map pin required. No reverse geocoding. Simple and reliable.

---

## Database Design (Supabase)

**Core tables**
- `profiles`
- `rides`
- `ride_participants`

**Key decisions**
- UTC timestamps in DB, Israel time in UI
- RLS enforced everywhere
- Upsert pattern for profiles
- No orphaned rides or participants

---

## Production Readiness

✅ Tested on physical Android devices  
✅ Real OTP authentication  
✅ Session persistence verified  
✅ Multi-user scenarios validated  
✅ Fast local builds (~30s)  
✅ Signed APKs ready for distribution  

No known blocking issues.

---

## Known Limitations (Intentional)

- No push notifications yet
- No in-app chat yet
- No distance sorting (filter only)
- No GPS tracking during rides
- No moderation/admin panel

All deferred by design, not technical debt.

---

## Next Phase (M2 – Planned)

**Priority order:**

1. **In-App Chat (Critical)**
   - Per-ride text chat
   - Supabase Realtime
   - No media, no reactions

2. **Push Notifications (Critical)**
   - Join requests & approvals
   - Ride cancellations
   - New chat messages

3. **Polish & Discovery**
   - Smarter defaults
   - Saved filters
   - Ride lifecycle (completed/history)

Estimated effort: 2–3 weeks.

---

## Distribution

- APK shared via WhatsApp / Drive / link
- No Play Store dependency for pilot
- Simple install flow for testers

---

## Success Criteria (Pilot)

- Users create rides without guidance
- Rides get joined successfully
- Repeat usage
- No language or UX confusion
- No critical bugs

---

## Ownership

**Developer:** Eli Eisenstein  
**Project:** Bishvil  
**Stage:** Pilot-ready MVP

---

🚀 **Ready for real users**

✅ What We've Accomplished:
M2.1 Features Complete:

✅ Ride Duration/End Time (1-8h picker)
✅ Road Biking Discipline (blue color)
✅ Profile Bio (500 char limit)
✅ Location Filtering with Persistence
✅ Mapbox + Israel Hiking Map Integration

Full-screen map picker
Israel Hiking tiles with colored trails
Red pin markers
Navigation to meeting points



New: My Rides Tab Feature:

✅ 4-tab navigation (Feed, My Rides, New, Profile)
✅ My Rides with 3 sections:

Organizing (orange stripe + OWNER badge)
Joined (green stripe + JOINED badge)
Requested (yellow stripe + REQUESTED badge)


✅ Auto-navigation after publish → RideDetails
✅ Coordinates saving correctly (not 0,0)
✅ No duplication - Owner rides only in Organizing


🎯 Ready for Next Phase!
What would you like to tackle next?
Suggested Options:
A. Polish & Testing:

End-to-end testing with multiple users
Edge cases (cancellations, past rides, etc.)
Performance optimization

B. M2.2+ Features:

Multi-day rides support
Ride editing
Push notifications
Ride sharing (copy link)
Photo uploads

C. Onboarding & Discovery:

Tutorial for new users
Better empty states
Search/filters on My Rides

D. Social Features:

Comments on rides
Ride chat
User ratings/reviews

Note : cannot run build using expo go - it's not supporting mapbox!!!

🛌 The Final Status
Mapbox: Integrated and stable.

Firebase: Initialized and communicating.

Supabase: Syncing push tokens to the correct id column.

Permissions: Granted and active.

TODO

Phase 1: The "Engagement" Foundation (Priority 1)
Goal: Prove the notification system actually works and provides value.

Test Notification (Solo): Use the Expo Push Tool to send a message to your token. This confirms the "Plumbing" we built tonight is 100% functional.

Trigger "Fill Phone" on Join: This is a crucial UX step. When a user clicks "Join," if their profile is missing a phone number, you must prompt them. Without a phone number, the ride coordination fails.

Default Rides Feed (Personalization): Update your Supabase query to filter the Feed based on the user's home_region or preferred_ride_times from their profile. This makes the app feel "alive" and relevant the moment they open it.

Phase 2: The "Social" Bridge (Priority 2)
Goal: Get users from the app into the actual car.

WhatsApp Link Creation: This is the "Safety Net." Even if your internal chat isn't ready, a button that opens a WhatsApp chat with the originator is a must-have.

Review Link for Sharing: To grow the app, users need to be able to share a ride link (Deep Linking). Since we added the scheme: "bishvil" to your config tonight, we are ready for this.

Phase 3: The "Refinement" (Priority 3)
Goal: Prepare for the first 10 testers.

Test with another phone: This will reveal any "Last Device Wins" confusion or permission edge cases.

Auth (Google/OTP): I suggest OTP (Email or Phone) for the first 10 testers. It feels more personal and secure for a "vetted" group. Google Login adds more native configuration (SHA-1 keys) that can wait a week.

Chat (Internal): Postpone this. WhatsApp handles chat better than a V1 app. Only build internal chat if you need to keep data private or structured.

My Suggestions to Improve the App
Ride Status "Auto-Cleanup": Add a background task or a simple filter so that rides that happened in the past disappear from the feed. Nothing kills an app faster than "Ghost Rides" from three days ago.

"I'm at the Spot" Button: A simple button that sends a high-priority notification to everyone in the ride: "Eli has arrived at the pickup point!" This solves the most stressful part of carpooling.

Simple Onboarding: Since you have a profiles table, ensure that the very first time a user logs in, they are forced to pick a home_region.

Edit rides and send notifications to joined.


run createUsers - run from bishvil "npx tsx --env-file=./scripts/.env.local scripts/createUsers.js"