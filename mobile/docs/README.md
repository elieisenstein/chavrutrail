# Bishvil – Project Documentation

*Last updated: 2026-01-21*

---

## Overview

Bishvil is an **Android-first mobile app** for organizing and joining cycling rides in Israel (MTB / Gravel / Road), optimized for *operational compatibility* (pace, skill, timing, gender preferences) rather than social networking.

**Current Stage:** Production-ready MVP with self-service sign-up
**Status:** Ready for beta testing

---

## Table of Contents

1. [Product Specification](#1-product-specification)
2. [Technology Stack](#2-technology-stack)
3. [Architecture & Key Decisions](#3-architecture--key-decisions)
4. [Current Features](#4-current-features)
5. [Known Limitations](#5-known-limitations)
6. [TODO & Roadmap](#6-todo--roadmap)
7. [Quick Reference](#7-quick-reference)

---

## 1. Product Specification

### Purpose

Fast, low-friction ride discovery and joining for Israeli cyclists, optimized for operational compatibility (pace, skill, timing, gender) with lightweight trust and privacy.

### Core Principles

* Fast ride discovery and joining
* Low friction, minimal ceremony
* Privacy-first (no phone exposure)
* Hebrew-first with full RTL/LTR support
* Gender-aware ride filtering for safety and comfort
* Social trust through organizer transparency

### Target Platform

* **Android first** (APK distribution via direct download)
* iOS later (no architectural blockers)

### MVP Scope

✅ **In Scope:**
* Ride creation and discovery
* Join / approval flows
* Profiles (lightweight, preference-based)
* Map-based location selection (Israel Hiking Map)
* Bilingual UI (Hebrew / English)
* Push notifications for ride events
* Gender-based ride filtering
* Organizer display with ride statistics
* Deep linking for ride sharing
* Self-service email/password sign-up

❌ **Out of Scope:**
* GPS ride tracking during rides
* Media uploads (photos/videos)
* Social feeds, likes, ratings
* Internal moderation tools
* In-app chat (WhatsApp used instead)
* Ride editing after creation
* User search / following
* Clickable user profiles (foundation exists)

### KPIs (Pilot)

* Time to first joined ride
* % of rides that actually happen
* Repeat rides with same participants
* Notification engagement rate
* Deep link conversion rate (shared → opened → joined)

---

## 2. Technology Stack

### Mobile

* **Framework:** React Native + Expo SDK 52 (TypeScript)
* **UI Library:** react-native-paper (Material Design 3)
* **Navigation:** React Navigation (native stack + bottom tabs)
* **Maps:** Mapbox GL + Israel Hiking Map tiles
* **Storage:** AsyncStorage (sessions, preferences)
* **Platform:** Android (APK distribution)

### Backend (Supabase)

* **Auth:** Phone OTP (future) + Email/Password (current)
* **Database:** PostgreSQL with Row Level Security (RLS)
* **Realtime:** PostgreSQL Change Data Capture
* **Notifications:** Database Webhooks → Edge Functions → Expo Push API
* **Functions:** Edge Functions for notification triggers

### Design System

* **Theme:** Dark mode primary (#121212 background)
* **Colors:**
  * Primary: #ff6b35 (orange) for selections and CTAs
  * Status badges: Orange (owner), Green (joined), Yellow (pending)
* **Spacing:** 6px chip gaps, 16px section gaps
* **Typography:** Material Design 3 variants
* **Motion:** Subtle (150-250ms transitions)

---

## 3. Architecture & Key Decisions

### Authentication

**Current (MVP):**
* Email/password sign-up with self-service registration
* No email verification (friction-free for trusted beta users)
* Display name uniqueness enforced via database constraint
* Case-insensitive name checking via Postgres SECURITY DEFINER function
* Profile completion during sign-up (display_name, ride_type[], gender)
* Sessions persist across app restarts

**Future:**
* Phone OTP primary (Israeli norm, high completion)
* Auto-refresh of push tokens on login

### Data Model

#### Core Tables

**profiles** - User profiles (separate from auth.users)
* Auto-created via DB trigger on user creation
* Fields: display_name, bio, ride_type[], skill, pace, birth_year, gender, expo_push_token
* Constraint: display_name must be unique (case-insensitive)

**rides** - Ride listings
* Fields: ride details, location, preferences, gender_preference
* Foreign key: owner_id → profiles.id (rides_owner_profile_id_fkey)
* Status: draft, published, cancelled, completed (future automation)

**ride_participants** - Join/approval tracking
* Status: joined, requested, rejected, left, kicked
* Foreign key: user_id → profiles.id

#### Database Functions

**check_display_name_available(name TEXT)** → boolean
* Uses SECURITY DEFINER to bypass RLS policies
* Allows unauthenticated users to check name availability during sign-up
* Case-insensitive comparison using LOWER()
* Called via RPC: `supabase.rpc('check_display_name_available', { name })`

### Privacy Decisions

* Phone numbers never exposed to other users
* Display name is the only visible identity
* Organizer name and stats visible for trust building
* Future contact via WhatsApp link only
* No public user profiles yet (foundation exists)

### Maps & Location

* **Provider:** Mapbox GL (native build required)
* **Tiles:** Israel Hiking Map with colored trail overlays
* **Features:**
  * Full-screen map picker for ride creation
  * Interactive map preview in ride details
  * Text description + GPS coordinates required
  * External navigation (Google Maps / Waze)
* **Design Decision:** No reverse geocoding (user provides text description)

### Notifications

* **Architecture:** Supabase Database Webhooks → Edge Function → Expo Push API
* Token stored in profiles table, auto-refreshed on app start
* Android notification channels for categorization
* **Events:**
  * Join requests (to owner)
  * Approval/rejection (to requester)
  * Ride cancellation (to all participants)

### Deep Linking

* **Prefixes:** `bishvil://`, `https://bishvil.app`, `https://bishvil-app.vercel.app`
* **Route Strategy:**
  * External shared links → FeedStack → RideDetails
  * MyRides internal navigation → MyRidesStack → RideDetails
  * Unique patterns prevent conflicts: `ride/:rideId` vs `my-rides/ride/:rideId`
* **Features:** Works in cold start (app closed) and warm start (app open)

### Real-Time Architecture

* **Technology:** Supabase Realtime (PostgreSQL Change Data Capture)
* **Implementation:**
  * MyRidesScreen: Subscribes to ride_participants and rides table changes
  * RideDetailsScreen: Subscribes to changes for specific ride
  * Feed: Uses useFocusEffect for manual refresh (sufficient for feed use case)
* **Benefits:** Instant updates across devices without polling

### Internationalization

* **Languages:** Hebrew (primary), English
* **Implementation:** react-i18next
* **RTL Handling:** Native I18nManager.forceRTL() with app restart requirement
* **Date/Time:** Localized using he-IL formatting

---

## 4. Current Features

### ✅ Authentication & Profiles

* **Self-Service Sign-Up:**
  * Email/password registration (minimum 6 characters)
  * Real-time display name availability checking (case-insensitive)
  * No email verification required (friction-free for beta users)
  * Profile completion during sign-up (display_name, ride_type[], gender)
  * Unique display name enforcement (database constraint)
  * Display name stored in both user_metadata and profiles table
* Email/password login for all users
* Profile auto-creation via DB trigger
* Profile fields: display_name, bio, ride_type[], skill, pace, birth_year, gender

### ✅ Ride Creation & Management

* **5-step wizard** (When/Where/Details/Group/Review):
  * Date/time picker with duration (1-8 hours)
  * Full-screen map location picker (Israel Hiking Map)
  * Ride type, skill level, pace selection
  * Distance and elevation (optional)
  * Max participants (2-6) with stepper UI (+/- buttons)
  * Join mode (Express/Approval)
  * Gender preference (All/Men/Women)
* Owner can cancel rides (notifies all participants)
* Participants can leave rides
* Real-time participant count updates
* **Auto-Add Ride Type Feature:**
  * **When creating a ride:** Ride type automatically added to profile if not already present
  * **When joining a ride:** Ride type automatically added to profile if not already present
  * Ensures users always see rides they create or join in their feed
  * Example: User with "Trail" joins "Gravel" ride via deep link → Profile updates to "Trail,Gravel"
  * Silent, non-intrusive - matches user mental model: "I ride what I join"

### ✅ Feed & Discovery

* **Smart filtering:**
  * User's preferred ride types (auto-loaded from profile)
  * User's gender (automatic gender-based visibility)
  * Skill level (optional)
  * Time range (Today, 3d, 7d, 14d, 30d)
  * **Persistent filters** - saved to AsyncStorage, restored on app start
* **Active rides only:** Feed shows only rides that haven't ended yet (not completed rides)
  * Clean discovery experience - users see what they can actually join
  * Completed rides moved to "My Rides → History" tab
* Empty states with helpful CTAs
* Pull-to-refresh
* **Organizer display** with ride statistics

### ✅ My Rides

* **Two tabs with visual status indicators:**
  * **Active Tab:** Shows all upcoming/active rides (organized + joined + requested)
    * Orange stripe + "OWNER" for organized rides
    * Green stripe + "JOINED" for joined rides
    * Yellow stripe + "REQUESTED" for pending requests
    * Only rides that haven't ended yet
    * Includes requested rides (actively pending)
    * Sorted by start time (ascending)
  * **History Tab:** Shows ALL completed rides (organized + joined)
    * Rides that have ended (no 48-hour gap)
    * Last 30 days of history
    * Sorted by start time (descending - most recent first)
    * Status badges: OWNER (orange) / JOINED (green)
* Empty states per tab
* **Real-time updates** - automatic refresh when participant status changes
* **Simple mental model:** Active = not ended, History = ended

### ✅ Ride Details

* Complete ride information display
* **Organizer name and statistics** at top of card
* Israel Hiking Map preview
* Participant list with owner indicator
* Pending requests section (owner only)
* Approve/reject buttons (owner only)
* Join/Leave actions
* External navigation (Google Maps/Waze)
* **WhatsApp share with deep links**
* Gender preference display
* **Real-time updates** for participants and ride changes

### ✅ Deep Linking System

* Full deep link support for ride sharing
* Works in cold start (app closed) and warm start (app running)
* WhatsApp integration for viral sharing
* Automatic navigation to correct ride details
* Conflict-free route patterns across navigation stacks

### ✅ Organizer Display & Trust Signals

* Organizer name visible on all ride cards (Feed, MyRides, RideDetails)
* **Ride statistics** displayed next to name:
  * Number of rides organized (completed, not cancelled)
  * Number of rides joined (as participant, completed, not cancelled)
* **Format:** `👤 David Cohen · 5 organized · 12 joined`
* **Purpose:** Build trust, help users identify known/experienced riders

### ✅ Notifications System

* **Backend:** Supabase webhooks → Edge Functions → Expo Push API
* **Mobile:** Auto-refreshing push tokens on app start/login
* **Events:** Join requests, approvals/rejections, ride cancellations
* **Android:** Custom notification channels with high priority
* **Verified:** All notification flows tested end-to-end

### ✅ Internationalization & Theming

* Hebrew and English fully supported
* RTL/LTR handling with native I18nManager
* App restart required for language/direction changes
* Light, Dark, and System theme modes
* Optimized for dark mode (primary UI)

---

## 5. Known Limitations

### Intentional MVP Decisions

* No ride editing after creation
* No in-app chat (WhatsApp used instead)
* No distance-based sorting (future)
* No GPS tracking during rides
* No media uploads
* No ratings or reviews
* No "I'm at the spot" button
* **No clickable profiles yet** (foundation exists, awaiting feedback)
* **Ride stats fetched on-demand** (N+1 queries, acceptable for MVP scale)

### Technical Debt (Documented)

#### TODO: Ride Statistics Performance Optimization

**Current Implementation:**
* Ride stats fetched on-demand using `getUserOrganizedRidesCount()` and `getUserJoinedRidesCount()`
* Feed with 50 rides, 30 unique owners = 60 COUNT queries (2 per owner)
* Acceptable for MVP (<100 active users)

**Future Optimization (When Needed):**
```sql
-- Add counter fields to profiles table
ALTER TABLE profiles
ADD COLUMN rides_organized_count INTEGER DEFAULT 0,
ADD COLUMN rides_joined_count INTEGER DEFAULT 0;
```

**Implementation Plan:**
1. Add counter columns to profiles table
2. Create Edge Function or scheduled job to update counters daily
3. Backfill existing counts with one-time script
4. Switch from on-demand to cached counts (instant, 1 query)

#### TODO: Automated Ride Status Management

**Current:**
* Rides remain `published` after end time
* Manual counting: `start_at < NOW() AND status != 'cancelled'`

**Future:**
* Scheduled job to update `status = 'completed'` after ride ends
* Enables better analytics and ride history features

---

## 6. TODO & Roadmap

### 🎯 Priority 1: Beta Testing (This Week)

- [ ] Build signed APK
- [ ] Share with 2-3 friends via WeTransfer
- [ ] Test full flow:
  - Self-service sign-up
  - Ride creation
  - Join/approval flows
  - Notifications
  - Deep link sharing
- [ ] Collect feedback on:
  - Sign-up experience
  - Organizer statistics value
  - Overall UX

### 🎯 Priority 2: Core Features (Next 2 Weeks)

#### Phone Number Collection (Required for WhatsApp Coordination)
- [ ] When user joins a ride, check if they have phone_number in profile
- [ ] If missing → Show modal: "Please add your phone number to coordinate with the group"
- [ ] Save to profiles.phone_number
- [ ] Files: Update join flow in RideDetailsScreen.tsx, create phone input modal

#### WhatsApp Integration
- [ ] Add optional WhatsApp group link field to ride creation
- [ ] Display WhatsApp group link in ride details for participants
- [ ] Update review step to show group link if provided
- [ ] Files: Add whatsapp_link to rides table, update CreateRideWizard, update RideDetailsScreen

#### Ride Editing (Owner Only)
- [ ] Edit button on RideDetails (owner only)
- [ ] Opens CreateRideWizard with existing data
- [ ] On save → notify all participants of changes
- [ ] Files: Create updateRide() in rides.ts, add edit button in RideDetailsScreen

### 🎯 Priority 3: User Profiles (Based on Feedback)

**Decision Point:** Implement only if beta testers ask "Who is this person?"

If yes, implement:
- [ ] Create UserProfileScreen component
- [ ] Make organizer name clickable in Feed and RideDetails
- [ ] Show basic profile:
  - Display name
  - Bio (if exists)
  - Ride preferences (types, skill, pace)
  - Statistics (organized/joined counts)
  - Home region (if provided)
- [ ] Add "View Profile" option in ride details

**Explicitly NOT included in Phase 1:**
* User search
* Following users
* Past ride history (just counts)
* Ratings or reviews

### 🎯 Priority 4: Analytics & Monitoring

- [ ] Set up basic analytics:
  - Sign-up conversion rate
  - Ride creation rate
  - Join/approval conversion rate
  - Deep link click-through rate
  - Notification open rate
- [ ] Error tracking (Sentry or similar)
- [ ] Performance monitoring

### Medium-Term (1-2 Months)

#### Performance Optimization
- [ ] Implement counter fields for ride statistics (if user base grows)
- [ ] Add automated ride status updates (completed/cancelled)
- [ ] Optimize database queries based on usage patterns

#### Enhanced Discovery
- [ ] Distance-based sorting (requires user location)
- [ ] Map view of nearby rides
- [ ] "Rides near me" filter option

#### User Experience Improvements
- [ ] Empty state illustrations
- [ ] Loading skeletons instead of spinners
- [ ] Improved ride card visual hierarchy
- [ ] Better date/time pickers

### Long-Term (3+ Months) - Based on Growth

#### Social Features (If Demand Exists)
- [ ] User search functionality
- [ ] Following system
- [ ] Activity feed (friends' rides)
- [ ] Ride history (past rides with details)
- [ ] Trust/reputation system (soft scoring)

#### Advanced Features
- [ ] Recurring rides (weekly group rides)
- [ ] Ride templates (save frequently used settings)
- [ ] Route planning integration
- [ ] Weather forecast integration
- [ ] Ride difficulty calculator

#### Platform Expansion
- [ ] iOS app (if Android version proves successful)
- [ ] Web dashboard for ride management
- [ ] Admin/moderation tools

### ❌ Postponed (Not Now)

* Internal chat (use WhatsApp)
* Photo uploads
* Ratings/reviews
* "I'm at the spot" button (nice-to-have)
* Picture uploads to profile
* Search community
* Following system
* Manage notifications preferences

---

## 7. Quick Reference

### Development Commands

**Create users (admin only):**
```bash
npx tsx --env-file=./scripts/.env.local scripts/createUsers.js
```

**Build and run:**
```bash
npx expo run:android
```

### Current Ride Types

1. Trail (merged from XC + Trail)
2. Enduro
3. Gravel
4. Road

### Gender Preference Logic

* **All:** Visible to everyone
* **Men:** Visible only to male users
* **Women:** Visible only to female users
* **Other/Null gender users:** See only "All" rides

### Status Badges

* **Orange (#FF6B35):** Owner/Organizing
* **Green (#4CAF50):** Joined
* **Yellow (#FFC107):** Requested/Pending

### Organizer Statistics

* **Organized Count:** Past rides where user was owner (start_at < NOW, status != 'cancelled')
* **Joined Count:** Past rides where user was participant (joined status, not owner, start_at < NOW, status != 'cancelled')
* **Display:** `👤 Name · X organized · Y joined`

### Deep Link Patterns

* **External shares:** `bishvil://ride/:rideId` → FeedStack → RideDetails
* **MyRides internal:** `my-rides/ride/:rideId` → MyRidesStack → RideDetails
* **Supported prefixes:** `bishvil://`, `https://bishvil.app`, `https://bishvil-app.vercel.app`

### Database Foreign Keys

* `rides.owner_id` → `profiles.id` (rides_owner_profile_id_fkey)
* `ride_participants.ride_id` → `rides.id`
* `ride_participants.user_id` → `profiles.id`
* `profiles.id` → `auth.users.id`

### Releasing a New Version (APK Update Workflow)

**Single Update Point:** Both the mobile app and landing page fetch the APK URL from the same `version.json` file hosted on Dropbox.

**Steps to release a new version:**

1. **Update version in `app.config.js`:**
   ```javascript
   version: "1.0.2",  // increment this
   ```

2. **Build new APK:**
   ```bash
   eas build --platform android --profile preview
   ```

3. **Upload APK to Dropbox:**
   * Upload the new APK file to Dropbox
   * Get shareable link
   * Change `dl=0` to `dl=1` in the URL for direct download

4. **Update `version.json` on Dropbox:**
   ```json
   {
     "version": "1.0.2",
     "downloadUrl": "https://www.dropbox.com/scl/fi/xxxxx/bishvil.apk?rlkey=xxx&dl=1"
   }
   ```
   * Version must match `app.config.js`
   * Update downloadUrl with new APK link

5. **Done!** Both app and landing page will automatically use the new URL.

**Important:** The version in `app.config.js` is baked into the APK at build time. The version in `version.json` is what users' apps fetch to check for updates. Both must match for the update prompt to stop showing.

**How it works:**

* **Mobile App:** On startup, `checkForUpdate()` in [versionCheck.ts](../src/lib/versionCheck.ts) fetches `version.json` and compares versions. If newer version exists, shows an alert with "Update Now" button.

* **Landing Page:** [public/index.html](../../public/index.html) fetches `version.json` on load and updates the download button URL dynamically.

**Version.json URL:**
```
https://www.dropbox.com/scl/fi/fba7ss1yst4lci71euyx9/version.json?rlkey=dy6av1bnsj1ed2zv4dd5qpkhy&dl=1
```

**Note:** The `dl=1` parameter makes Dropbox return raw file content instead of a preview page.

### Key File Locations

* **Auth:** `src/lib/supabase.ts`
* **Profiles:** `src/lib/profile.ts`
* **Rides:** `src/lib/rides.ts`
* **Notifications:** `src/lib/notifications.ts`
* **Navigation:** `src/app/navigation/AppNavigator.tsx`
* **Deep Linking:** `src/app/navigation/linking.ts`
* **Version Check:** `src/lib/versionCheck.ts`
* **i18n:** `src/app/i18n/`

---

## Recent Session History

### Session: January 21, 2026 - My Rides 2-Tab Simplification + Bug Fix

**Completed:**
* **Bug Fix:** Fixed History tab not showing recently completed rides
  * Problem: Completed rides less than 48 hours old didn't appear anywhere
  * Root cause: `getMyRideHistory()` filtered for rides ended MORE than 48 hours ago
  * Solution: Changed filter to show ALL completed rides (`endTime < now`)
* **Simplified to 2 tabs:** Active / History (removed "All" tab)
  * User decision: "All" tab not needed with simplified design
  * Cleaner, simpler mental model
* **Feed Cleanup:** Removed 48-hour window from Feed
  * Feed now shows only active rides (not yet ended)
  * Clean discovery experience - users see what they can actually join
  * Updated `listFilteredRides()` to filter: `endTime >= now`
* **Active Tab Changes:**
  * Now includes requested rides (makes sense - they're "actively" pending)
  * Updated `getActiveMyRides()` to fetch joined + requested
  * Status badges: OWNER (orange) / JOINED (green) / REQUESTED (yellow)
* **History Tab Changes:**
  * Now shows ALL completed rides immediately (no 48-hour gap)
  * Updated `getMyRideHistory()` to remove 48-hour cutoff
  * Simple rule: ride ended = history
* Removed `getAllMyRides()` function (not needed with 2-tab design)
* Updated [MyRidesScreen.tsx](../src/app/screens/MyRidesScreen.tsx):
  * Removed "all" tab from UI
  * Updated Section type: `"active" | "history"`
  * Reduced from 6 to 4 parallel queries (performance improvement)
  * Default tab now "active" instead of "all"

**Technical Implementation:**
* Updated `getActiveMyRides()` - include requested rides
* Fixed `getMyRideHistory()` - `endTime < now` instead of `endTime < now - 48h`
* Deleted `getAllMyRides()` function
* 4 parallel queries on screen load (2 per tab) - reduced from 6
* Client-side filtering for end time calculations
* Real-time subscriptions unchanged

**Problem Solved:**
* **Bug:** Gravel ride ended yesterday but didn't appear in History
* **User feedback:** "48-hour visibility messes up the Feed screen"
* **User decision:** "All tab not needed, simplify to 2 tabs"
* **Gap eliminated:** Completed rides now immediately visible in History

**User Benefits:**
* **Feed:** Clean discovery - only active rides shown
* **Active Tab:** Everything you need to plan (upcoming + pending requests)
* **History Tab:** ALL completed rides visible immediately (no gap!)
* **Simpler UX:** 2 tabs instead of 3 - easier to understand
* **Bug fixed:** No more missing completed rides
* **Performance:** Fewer queries (4 instead of 6)

### Session: January 20, 2026 - Auto-Add Ride Type When Joining Rides

**Completed:**
* Extended auto-add ride type feature to join flow
  * Previously: Only when creating rides
  * Now: Also when joining/requesting to join rides
  * Solves deep link UX issue: Users can now see joined rides in feed immediately
* Updated `joinOrRequestRide()` function in [rides.ts](../src/lib/rides.ts)
  * Fetches ride details to get ride_type
  * Checks user's current ride types
  * Appends new type if not already present
  * Updates profile via `updateMyProfile()`
* Added import for `fetchMyProfile` and `updateMyProfile`
* Graceful error handling - join succeeds even if profile update fails

**Technical Implementation:**
* Mirrors CreateRideWizard.tsx auto-add pattern
* Non-critical operation wrapped in try-catch
* Reuses existing ride fetch for both profile update and notifications
* Console logging for debugging

**Problem Solved:**
* User with "Trail" gets shared "Gravel" ride via deep link
* Clicks link → Joins ride → Gravel added to profile → Feed shows ride
* No manual profile updates needed
* Seamless deep link → join → view workflow

**User Benefit:**
* Eliminates confusing "I joined this ride but can't see it" moments
* Encourages trying new ride types
* Consistent behavior with ride creation
* Silent, helpful, non-intrusive

### Session: January 20, 2026 - Extended Ride Visibility

**Completed:**
* Implemented 48-hour post-ride visibility window
  * Rides now remain visible for 48 hours after they end
  * Configurable via `RIDE_VISIBILITY_HOURS_AFTER_END` constant in [rides.ts](../src/lib/rides.ts)
* Updated all ride fetching functions:
  * `listFilteredRides()` - Feed with filters
  * `getMyOrganizingRides()` - My organizing rides
  * `getMyJoinedRides()` - My joined rides
  * `getMyRequestedRides()` - My requested rides
* Added helper functions:
  * `getMinimumEndTime()` - Calculates cutoff timestamp
  * `calculateRideEndTime()` - Computes ride end time from start + duration
* Client-side filtering for ended rides (Postgres doesn't support computed columns in WHERE)
* Updated documentation with new feature

**Technical Implementation:**
* Removed `gte("start_at", nowIso)` from database queries
* Added client-side filtering: `endTime >= minEndTime`
* End time = start_at + duration_hours
* Visibility cutoff = now - 48 hours

**Why This Feature:**
* Allows users to review recent rides
* Coordinate post-ride (share photos, plan next ride)
* See who actually showed up
* Better UX - rides don't disappear instantly

### Session: January 20, 2026 - Documentation Consolidation

**Completed:**
* Consolidated 4 separate documentation files into single README.md:
  * BISHVIL_SPEC.md (product specification)
  * DECISIONS.md (architecture decisions)
  * STATUS.md (project status and features)
  * TODO-Plan.md (execution plan)
* Eliminated redundancy and outdated information
* Organized into 7 clear sections:
  1. Product Specification
  2. Technology Stack
  3. Architecture & Key Decisions
  4. Current Features
  5. Known Limitations
  6. TODO & Roadmap
  7. Quick Reference
* Maintained all critical technical details
* Preserved session history for continuity

### Session: January 19, 2026 - Self-Service Sign-Up Implementation

**Completed:**
* Full email/password sign-up flow with real-time name availability checking
* Database unique constraint + SECURITY DEFINER function for name validation
* Profile completion during sign-up (display_name, ride_type[], gender)
* Auto-add ride type feature (prevents feed filtering issues)
* Fixed RLS bypass issue for unauthenticated name checking
* Disabled email confirmation in Supabase for friction-free experience
* Added 13 new translation keys (Hebrew + English)
* Cleaned up temporary SQL scripts

**Key Technical Decisions:**
* No email verification (trusted user base)
* 6-character password minimum
* Case-insensitive display names
* RLS bypass via Postgres SECURITY DEFINER function (secure, long-term solution)

### Session: January 6-7, 2026 - Organizer Display & Statistics

**Completed:**
* Deep link functionality (fixed warm start freeze, route pattern conflicts)
* Gender preference display across all screens
* Persistent feed filters (AsyncStorage-based)
* Real-time updates (Supabase subscriptions)
* Organizer display with ride statistics (organized/joined counts)
* Foreign key: rides.owner_id → profiles.id

**Technical Decisions:**
* On-demand stat fetching (acceptable for MVP <100 users)
* Marked performance optimization as future TODO
* Deep link strategy: External → FeedStack, internal maintains context
* No clickable profiles yet (testing demand first)

### Session: January 5, 2026 - UI/UX Polish

**Completed:**
* ProfileScreen polish (removed duplicate heading, merged XC+Trail, RTL support)
* Unified chip styling across all screens (6px gaps, consistent spacing)
* Dark theme implementation (#121212 headers and tab bar)
* Gender preference chips in ride creation
* Consistent design system across all screens

---

**Last Updated:** January 20, 2026
**Stage:** Production-ready MVP with self-service sign-up
**Next Milestone:** Beta testing with self-registering users
