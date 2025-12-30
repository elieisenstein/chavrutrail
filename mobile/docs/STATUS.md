# Chavrutrail – Project Status

**Status:** Production-ready MVP  
**Last updated:** December 2025

---

## Overview

Chavrutrail is a mobile app for organizing and joining cycling rides.  
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
**Project:** Chavrutrail  
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