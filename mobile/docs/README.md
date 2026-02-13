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
* Media uploads (photos/videos)
* Social feeds, likes, ratings
* Internal moderation tools
* In-app chat (WhatsApp used instead)
* Ride editing after creation

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

### ✅ GPS Navigation System

* **Native Android Module:**
  * Ultra-low-power GPS tracking via FusedLocationProvider
  * Accelerometer-based motion detection (MOVING/STATIONARY states)
  * Event-driven architecture with sparse NavCommitEvents
  * Haversine distance calculation and median heading smoothing
  * Battery-optimized: ~140-215 mAh/hour consumption

* **Velocity-Based Adaptive Sampling:**
  * Linear formulas for smooth speed-based threshold adjustments
  * Walking: ~4s updates, 9.5m distance
  * Cycling: ~1.2s updates, 20m distance
  * Stopped: 5s updates, 5m distance

* **Two Map Modes:**
  * North-Up: Static map (bearing=0), compass visible
  * Heading-Up: Rotating map, 45° pitch, compass hidden
  * Bottom-third camera positioning for optimal forward view

* **Integration:**
  * 5th bottom tab "Navigation" for standalone GPS tracking
  * "Navigate Route" button in RideDetails for GPX route navigation
  * Stats display: speed, accuracy, distance, elapsed time
  * GPX route overlay on navigation map (purple line)
  * Works with Israel Hiking Map tiles

* **Entry Points:**
  * Navigation tab → standalone tracking
  * Ride details → GPX route navigation
  * GPX file intent → open .gpx files with Bishvil

### ✅ Route Preview with Start/End Markers

* **Visual Route Markers:**
  * Orange circle for start point (symbolizes energy)
  * Red circle for end point (indicates finish)
  * Markers visible on both GPX route preview and ride detail maps
* **Smart Overlap Handling:**
  * Detects when start/end points are within 30 pixels on screen
  * For circular routes (start = end), shows split marker with both colors
  * Uses pixel-based offset (circleTranslate) to show orange left, red right
  * Works consistently across all zoom levels
* **Implementation:**
  * Screen pixel distance calculation using MapView projection API
  * Conditional rendering based on overlap detection
  * White stroke border for visibility against map tiles
  * Calculated on map load for optimal performance

### ✅ Internationalization & Theming

* Hebrew and English fully supported
* RTL/LTR handling with native I18nManager
* App restart required for language/direction changes
* Light, Dark, and System theme modes
* Optimized for dark mode (primary UI)

### ✅ Offline Data Caching (Phase 1)

Enables app usage in areas with poor/no connectivity by caching data locally.

* **Cache Service:** Generic caching with timestamps for offline support
  * Cache keys: `feed`, `my_rides_active`, `my_rides_history`, `profile`
  * Cache version for migrations
  * Staleness levels: fresh (<5 min), stale (<30 min), very-stale (<60 min), expired (>60 min)

* **Network Detection:** Uses `expo-network` to detect online/offline status
  * `isOnline()` function checks internet reachability
  * `useNetworkState()` hook for reactive network state

* **Cached Data Functions:**
  * `listFilteredRidesWithCache()` - Feed rides with cache fallback
  * `getActiveMyRidesWithCache()` - Active rides with cache fallback
  * `getMyRideHistoryWithCache()` - Ride history with cache fallback
  * `fetchMyProfileWithCache()` - User profile with cache fallback

* **Staleness Indicator Component:**
  * Shows "Offline Mode - Last updated X min ago" banner
  * Color-coded by staleness level (green → yellow → orange → red)
  * Tap to refresh when back online
  * Displayed on FeedScreen and MyRidesScreen

* **Cache Strategy:**
  * Network first: Try to fetch fresh data
  * On success: Update cache and show fresh data
  * On failure/offline: Load from cache with staleness indicator

* **Files:**
  * `src/lib/cacheService.ts` - Generic cache with timestamps
  * `src/lib/network.ts` - Network state detection
  * `src/components/StalenessIndicator.tsx` - Offline indicator component
  * Modified: `rides.ts`, `profile.ts`, `FeedScreen.tsx`, `MyRidesScreen.tsx`

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

#### GPS Navigation System ✅ DONE
- [x] Native Android module (Kotlin) for ultra-low-power GPS tracking
- [x] FusedLocationProvider integration with HIGH_ACCURACY mode
- [x] Accelerometer-based motion detection (MOVING/STATIONARY states)
- [x] Event-driven rendering with dr/dθ/dt commit thresholds
- [x] Velocity-based adaptive sampling using linear formulas
- [x] Two map modes: North-Up (static) and Heading-Up (rotating map with 45° pitch)
- [x] Bottom-third camera positioning for optimal forward view
- [x] NavigationScreen with full-screen map and stats display
- [x] Navigation tab (5th bottom tab) for standalone GPS tracking
- [x] "Navigate Route" button in RideDetails for GPX route navigation
- [x] GPS heading smoothing using median of last 5 samples
- [x] Haversine formula for accurate distance calculation
- [x] Battery-optimized: ~140-215 mAh/hour expected consumption
- [x] Files: BishvilNavigationModule.kt, BishvilNavigationPackage.kt, navigationService.ts, NavigationContext.tsx, NavigationMapView.tsx, NavigationScreen.tsx, updated AppNavigator.tsx, i18n translations

#### Phone Number Collection (Required for WhatsApp Coordination) ✅ DONE
- [x] When user joins a ride, check if they have phone_number in profile
- [x] If missing → Show modal: "Please add your phone number to coordinate with the group" (required, no skip)
- [x] When user publishes a ride, also require phone (required, no skip)
- [x] Save to profiles.phone_number (normalized +972 format)
- [x] Phone field added to Profile screen with validation
- [x] Accepts 05XXXXXXXX (local) and +9725XXXXXXXX (international) formats
- [x] Profile screen silently reloads on focus (reflects phone saved from other screens)
- [x] My Rides / Feed tabs reset stack on tab press (fixes stale "Ride not found" after cancellation)
- [x] Files: PhoneInputModal.tsx, RideDetailsScreen.tsx, CreateRideWizard.tsx, ProfileScreen.tsx, AppNavigator.tsx, profile.ts, en.json, he.json

#### WhatsApp Integration ✅ DONE
- [x] Add optional WhatsApp group link field to ride creation (review step)
- [x] Display WhatsApp group link in ride details for joined participants only
- [x] Update review step to show group link input if provided
- [x] Owner can add/edit WhatsApp link anytime from ride details (before ride ends)
- [x] Files: Add whatsapp_link to rides table, update CreateRideWizard, StepReview, RideDetailsScreen, createRideTypes.ts, rides.ts, en.json, he.json

#### App Version Display ✅ DONE
- [x] Show app version number (from app.config.js) at the bottom of the Settings screen
- [x] Files: SettingsScreen.tsx

#### GPX Route Support ✅ DONE
- [x] Optional GPX file upload on "Where" step (with file validation: size < 2MB, valid GPX content)
- [x] Parse GPX coordinates on upload (regex-based, no XML library) and store in DB alongside raw file URL
- [x] Full-screen route preview map (Israel Hiking Map + GPX polyline overlay, magenta-purple #7B2CBF)
- [x] "Preview Route" button in ride details (visible to all users if GPX exists)
- [x] GPX file download for owner + joined participants only
- [x] Camera auto-fits to route bounding box
- [x] Supabase Storage bucket `gpx-files` for raw GPX files
- [x] DB: `gpx_url TEXT`, `gpx_coordinates JSONB` columns on rides table
- [x] Files: gpx.ts (NEW), RoutePreviewScreen.tsx (NEW), StepWhere.tsx, StepReview.tsx, CreateRideWizard.tsx, RideDetailsScreen.tsx, AppNavigator.tsx, createRideTypes.ts, rides.ts, en.json, he.json, app.config.js

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

### 🗺️ GPX Route Support ✅ DONE
- [x] Use Supabase Storage for GPX files (bucket: `gpx-files`)
- [x] Save public URL in rides table (`gpx_url` column) + parsed coordinates (`gpx_coordinates`)
- [x] Allow organizer to upload GPX when creating a ride (Where step)
- [x] Render GPX as GeoJSON LineLayer on Mapbox (Israel Hiking Map) in RoutePreviewScreen
- [x] Show route preview button in ride details, download for joined participants

### 🤖 AI Features (After GPX)
- [ ] Automatic difficulty grading from GPX (elevation gain vs. distance analysis)
- [ ] Smart ride description generation (Hebrew) from GPX data
- [ ] Compatibility check: warn users if ride difficulty doesn't match their profile

### 💳 Payment (Not Yet)
- **When:** After 100–200 active users or clear "Power Organizers" using the app weekly
- **Why wait:** Liquidity (enough rides on the map) is more important than revenue at this stage
- **How:** Use RevenueCat (integrates with React Native + Supabase, handles Pro logic without custom billing backend)

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

### GPS Navigation Configuration

**Default Parameters (optimized for cycling on trails):**
```typescript
{
  minDistanceMeters: 15,         // Base distance threshold
  minHeadingDegrees: 10,         // Heading change threshold (degrees)
  minTimeMs: 1000,               // Base time threshold (milliseconds)
  motionVarianceThreshold: 0.15, // Accelerometer sensitivity
  motionWindowMs: 800            // Motion detection window
}
```

**Adaptive Sampling Formulas:**
* Time threshold: `max(500, 5000 - speed * 750)` ms
* Distance threshold: `max(5.0, min(25.0, 5.0 + speed * 3.0))` meters
* Stationary override: 5x base time (5 seconds)

**Expected Performance:**
* Walking (1.5 m/s): ~4s updates, 9.5m distance → 30% battery savings
* Cycling (5 m/s): ~1.2s updates, 20m distance → optimal responsiveness
* Stopped: 5s updates, 5m distance → 80% battery savings

### Key File Locations

* **Auth:** `src/lib/supabase.ts`
* **Profiles:** `src/lib/profile.ts`
* **Rides:** `src/lib/rides.ts`
* **Notifications:** `src/lib/notifications.ts`
* **GPS Navigation (Native):** `android/app/src/main/java/com/elieisenstein/bishvil/navigation/BishvilNavigationModule.kt`
* **GPS Navigation (JS):** `src/lib/navigationService.ts`, `src/app/state/NavigationContext.tsx`
* **Navigation:** `src/app/navigation/AppNavigator.tsx`
* **Deep Linking:** `src/app/navigation/linking.ts`
* **Version Check:** `src/lib/versionCheck.ts`
* **i18n:** `src/app/i18n/`

---

## Recent Session History

### Session: January 29, 2026 - Ultra-Low-Power GPS Navigation System

**Completed:**
* **Native Android Module (Kotlin):**
  * Created BishvilNavigationModule.kt with FusedLocationProvider integration
  * HIGH_ACCURACY GPS mode with adaptive sampling based on motion state
  * Accelerometer-based motion detection using variance calculation
  * Motion states: MOVING (normal updates) vs STATIONARY (reduced frequency)
  * Event-driven architecture - emits sparse NavCommitEvents to JavaScript
  * Haversine formula for accurate distance calculation between GPS points
  * Heading smoothing using median of last 5 samples (reduces GPS jitter)
  * dr/dθ/dt commit logic: triggers updates based on distance, heading change, or time

* **Velocity-Based Adaptive Sampling (Linear Formulas):**
  * Uses GPS speed directly (not accelerometer integration - avoids drift)
  * Linear time threshold: `max(500, 5000 - speed * 750)` ms
    - Walking (1.5 m/s) → ~4s updates
    - Cycling (5 m/s) → ~1.2s updates
    - Stopped (STATIONARY) → 5s updates
  * Linear distance threshold: `max(5.0, min(25.0, 5.0 + speed * 3.0))` meters
    - Walking → ~9.5m
    - Cycling → 20m
    - Stopped → 5m
  * Smooth transitions without branching logic jumps
  * Expected battery impact: 30% less GPS reads when walking, 80% less when stopped

* **Two Map Modes:**
  * North-Up mode: Static map (bearing=0), compass visible, traditional view
  * Heading-Up mode: Rotating map (bearing=user heading), 45° pitch, compass hidden
  * Mode toggle button on map (top-right corner)
  * Bottom-third camera positioning via followPadding (optimal forward trail view)

* **React Native Integration:**
  * navigationService.ts - TypeScript wrapper for native module
  * NavigationContext.tsx - Global state management with AsyncStorage persistence
  * NavigationMapView.tsx - Two-mode map component with Israel Hiking tiles
  * NavigationScreen.tsx - Full-screen navigation with start/stop controls
  * Stats overlay: speed (km/h), accuracy (±meters), distance traveled, elapsed time

* **App Integration:**
  * Added 5th bottom tab "Navigation" to AppNavigator
  * "Navigate Route" button in RideDetailsScreen for joined participants
  * GPX route overlay rendering on navigation map (purple #7B2CBF line)
  * Deep link support for GPX file intents (open .gpx files with Bishvil)
  * Localization: Hebrew and English translations for all navigation strings

* **Battery Optimization Techniques:**
  * Motion gating via accelerometer (cheap, always-on sensor)
  * Native commit logic reduces JavaScript bridge crossings
  * Event-driven rendering (not 60fps continuous loop)
  * Distance-based updates (not time-based polling)
  * Heading from GPS bearing (not magnetometer - saves power)
  * Combined strategy: Accelerometer gate + GPS speed for adaptive rates

**Files Created:**
* `mobile/android/app/src/main/java/com/elieisenstein/bishvil/navigation/BishvilNavigationModule.kt` (400+ lines)
* `mobile/android/app/src/main/java/com/elieisenstein/bishvil/navigation/BishvilNavigationPackage.kt`
* `mobile/src/lib/navigationService.ts`
* `mobile/src/app/state/NavigationContext.tsx`
* `mobile/src/components/NavigationMapView.tsx`
* `mobile/src/app/screens/NavigationScreen.tsx`

**Files Modified:**
* `mobile/android/app/src/main/java/com/elieisenstein/bishvil/MainApplication.kt` - Registered navigation package
* `mobile/android/app/build.gradle` - Added Google Play Services Location dependency
* `mobile/android/app/src/main/AndroidManifest.xml` - Added GPX intent filter
* `mobile/App.tsx` - Wrapped app with NavigationProvider
* `mobile/src/app/navigation/AppNavigator.tsx` - Added NavigationStack (5th tab)
* `mobile/src/app/screens/RideDetailsScreen.tsx` - Added "Navigate Route" button
* `mobile/src/i18n/en.json` - 13 navigation translations
* `mobile/src/i18n/he.json` - 13 Hebrew navigation translations

**Technical Decisions:**
* **Native from day 1:** Kotlin module for maximum battery efficiency (vs pure JavaScript solution)
* **FusedLocationProvider:** Google's best-practice location API (fuses GPS/WiFi/cell)
* **Linear formulas over branching:** Simpler code, smoother transitions, easier tuning
* **GPS speed over accelerometer velocity:** Avoids integration drift, more accurate
* **Event-driven vs 60fps:** Only render when meaningful position change occurs
* **Foreground-only:** No background service for MVP (simpler permissions, lower complexity)
* **Haversine distance:** Standard great-circle distance calculation for GPS coordinates
* **Median heading smoothing:** More stable than mean, filters outliers effectively
* **Kalman filter rejected:** Overkill for trail navigation, FusedLocationProvider already does fusion

**Problem Solved:**
* Users can now navigate GPX routes during rides with turn-by-turn visual guidance
* Battery-efficient implementation suitable for 2+ hour rides
* Works standalone (Navigation tab) or with ride GPX routes (Navigate button)
* Two map modes accommodate different riding preferences (traditional vs rotation)
* Adaptive sampling reduces battery drain when walking/stopped, increases responsiveness when cycling fast

**Configuration Parameters (Tunable):**
```typescript
{
  minDistanceMeters: 15,        // Base distance threshold
  minHeadingDegrees: 10,        // Heading change threshold
  minTimeMs: 1000,              // Base time threshold
  motionVarianceThreshold: 0.15, // Accelerometer sensitivity
  motionWindowMs: 800           // Motion detection window
}
```

**Expected Battery Consumption:**
- GPS (FusedLocationProvider): ~120-180 mAh/hour
- Accelerometer: ~3-5 mAh/hour
- Native processing: ~2-5 mAh/hour
- Map rendering (event-driven): ~15-25 mAh/hour
- **Total: ~140-215 mAh/hour** (2-3 hours on 3000mAh battery)

**Lightweight Alternatives Considered (Not Implemented Yet):**
* EMA smoothing for speed display (if jitter issues appear during testing)
* GPS accuracy gating (reject positions with accuracy > 50m)
* Simple dead reckoning for brief GPS dropouts (2-3 seconds max)
* Full Kalman filter explicitly rejected as overkill for this use case

**Next Steps:**
* Field testing on real rides (walking and cycling)
* Battery profiling to validate 140-215 mAh/hour estimate
* Parameter tuning based on field feedback
* Consider EMA smoothing if speed display shows jitter

### Session: January 29, 2026 - Route Start/End Point Markers

**Completed:**
* **Visual Route Markers Implementation:**
  * Added orange circle for start point (#FF8C00 - symbolizes energy)
  * Added red circle for end point (#DC143C - crimson red, indicates finish)
  * 8px radius circles for normal markers, 10px for overlapping markers
  * 2px white stroke border for visibility against Israel Hiking tiles
* **Smart Overlap Detection:**
  * Detects when start/end points are within 30 pixels on screen (circular routes)
  * Uses screen pixel distance calculation via `mapRef.getPointInView()`
  * Calculates Euclidean distance between start/end markers
  * Threshold: MIN_PIXEL_DIST = 30 pixels (accounts for marker size + stroke + visual gap)
* **Split Marker for Circular Routes:**
  * When overlap detected, shows two offset circles creating side-by-side appearance
  * Start circle: offset left by 4 pixels using `circleTranslate: [-4, 0]`
  * End circle: offset right by 4 pixels using `circleTranslate: [4, 0]`
  * Creates clear visual distinction: orange on left, red on right
* **Technical Implementation:**
  * Added `mapRef` and `markersOverlap` state to RoutePreviewScreen
  * Created `checkMarkersOverlap()` function for pixel distance calculation
  * Conditional rendering: separate markers vs. offset markers based on overlap
  * Works consistently across all zoom levels (pixel-based offset)
  * Graceful fallback: shows separate markers if projection API fails

**Files Modified:**
* `src/app/screens/RoutePreviewScreen.tsx` - Added markers, overlap detection, conditional rendering
* `mobile/docs/README.md` - Documented new feature

**Technical Decisions:**
* **Screen pixels vs geographic distance:** Using screen pixels ensures correct behavior at all zoom levels
* **Pixel-based offset approach:** CircleLayer with `circleTranslate` property (simpler than FillLayer polygons)
* **Static detection:** Checks overlap once on map load (not dynamic on zoom)
* **No external dependencies:** Uses native Mapbox projection API
* **Rejected approaches:** FillLayer semi-circle polygons (rendering issues), overlapping semi-transparent circles (not visible)

**Problem Solved:**
* Users can now quickly identify route direction and type (loop vs. one-way)
* Circular routes clearly indicated with split-color marker
* Markers remain visible and consistent across map zoom levels
* Works with all GPX routes regardless of length or complexity

### Session: January 28, 2026 - GPX Fixes & Where Step UI Polish

**Completed:**
* **StepWhere UI Refinements:**
  * "Current Location" and "Choose on Map" buttons now side-by-side in one row (`flexDirection: "row"`)
  * Shortened "Use Current Location" → "Current Location" (EN) / "מיקום נוכחי" (HE)
  * Shortened location instruction to fit one line: "Drop a pin on the map so riders can find this ride"
  * Reduced margin above "Meeting Point" section title (marginTop 16 → 8)
* **GPX Upload Fix:** Replaced `response.blob()` with `response.text()` + `new TextEncoder().encode()` for React Native compatibility (blob() is unreliable with local file URIs in RN)
* **GPX Filename Fix:** Switched to opaque storage keys (`rides/{timestamp}_{randomId}.gpx`) instead of original filename — avoids Supabase Storage errors with Hebrew/Unicode characters and spaces
* **GPX Route Line Color:** Changed from orange (#ff6b35) to magenta-purple (#7B2CBF) for better visibility on map

**Files Modified:**
* `src/app/screens/createRide/steps/StepWhere.tsx` — Row layout for location buttons, reduced spacing
* `src/app/screens/createRide/CreateRideWizard.tsx` — Fixed GPX upload (text+encode), opaque storage key
* `src/app/screens/RoutePreviewScreen.tsx` — Line color #7B2CBF
* `src/i18n/en.json` — Shortened button label + instruction text
* `src/i18n/he.json` — Shortened button label + instruction text

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

### Session: January 22, 2026 - Clickable Profiles & Follow System

**Completed:**
* **Clickable Profiles:** Tap any user name to view their profile
  - Created UserProfileScreen (read-only view with display_name, bio, ride types, skill/pace, stats)
  - Added UserProfile route to FeedStack and MyRidesStack
  - Made names clickable in RideDetailsScreen (owner, participants, pending requests)
  - Made owner name clickable in FeedScreen ride cards
  - Added fetchUserProfile() to profile.ts library

* **Follow System:**
  - Created follows.ts library (followUser, unfollowUser, isFollowing, getFollowingList, getFollowersCount)
  - Follow/Following toggle button on UserProfileScreen (hidden for own profile)
  - FollowingScreen to manage followed users (accessible from Profile tab)
  - Unfollow navigates back to Profile screen

* **Follower Notifications:**
  - Edge function notifies followers when user creates new ride
  - Added CASE 3 to process-ride-event for rides INSERT
  - Removed notification_preferences check from send-notification (OS handles filtering)

* **Database:** Created `follows` table with RLS policies (manual setup in Supabase)

**Files Created:**
* mobile/src/lib/follows.ts
* mobile/src/app/screens/UserProfileScreen.tsx
* mobile/src/app/screens/FollowingScreen.tsx

**Files Modified:**
* mobile/src/lib/profile.ts (added fetchUserProfile)
* mobile/src/app/navigation/AppNavigator.tsx (added UserProfile and Following routes)
* mobile/src/app/screens/RideDetailsScreen.tsx (clickable names)
* mobile/src/app/screens/FeedScreen.tsx (clickable owner)
* mobile/src/app/screens/ProfileScreen.tsx (added Following button)
* mobile/supabase/functions/process-ride-event/index.ts (notify followers)
* mobile/supabase/functions/send-notification/index.ts (simplified, OS handles prefs)
* mobile/src/i18n/en.json & he.json (follow translations)

**Technical Decisions:**
* OS notification channels handle user preferences (removed in-app notification_preferences check)
* Cross-stack navigation for viewing profiles from Following screen
* Deploy commands: `npx supabase functions deploy process-ride-event --no-verify-jwt`

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
* Clickable profiles: organizer names in orange with underline, stats in muted gray

### Session: January 5, 2026 - UI/UX Polish

**Completed:**
* ProfileScreen polish (removed duplicate heading, merged XC+Trail, RTL support)
* Unified chip styling across all screens (6px gaps, consistent spacing)
* Dark theme implementation (#121212 headers and tab bar)
* Gender preference chips in ride creation
* Consistent design system across all screens

---

**Last Updated:** February 13, 2026
**Stage:** Production-ready MVP with self-service sign-up
**Next Milestone:** Beta testing with self-registering users

next TODO list:

~~Clickable profiles~~ (Done - Jan 22, 2026)

~~Follow + notifications~~ (Done - Jan 22, 2026)

~~Phone number collection for WhatsApp~~ (Done - Jan 23, 2026)

~~WhatsApp group link~~ (Done - Jan 27, 2026)

~~Version display in Settings~~ (Done - Jan 27, 2026)

~~GPX route support~~ (Done - Jan 27, 2026)

~~Offline data caching~~ (Done - Feb 13, 2026)

Ride happened confirmation

### Session: February 13, 2026 - Offline Data Caching (Phase 1)

**Completed:**
* **Cache Service (`cacheService.ts`):**
  * Generic cache with timestamps for offline support
  * Cache versioning for future migrations
  * Staleness levels: fresh (<5 min), stale (<30 min), very-stale (<60 min), expired (>60 min)
  * Functions: `setCache()`, `getCache()`, `getCacheAge()`, `formatCacheAge()`, `getStalenessLevel()`

* **Network Detection (`network.ts`):**
  * Uses `expo-network` for connectivity detection
  * `isOnline()` async function checks internet reachability
  * `useNetworkState()` hook for reactive network state

* **Cached Data Functions:**
  * `listFilteredRidesWithCache()` in rides.ts - Feed with cache fallback
  * `getActiveMyRidesWithCache()` in rides.ts - Active rides with cache
  * `getMyRideHistoryWithCache()` in rides.ts - History with cache
  * `fetchMyProfileWithCache()` in profile.ts - Profile with cache

* **Staleness Indicator Component:**
  * Visual banner showing offline status and cache age
  * Color-coded: green (<5 min), yellow (<30 min), orange (<60 min), red (>60 min)
  * Tap to refresh when back online
  * Used in FeedScreen and MyRidesScreen

* **Screen Updates:**
  * FeedScreen: Uses cached functions, shows staleness indicator
  * MyRidesScreen: Uses cached functions, shows staleness indicator

**Files Created:**
* `mobile/src/lib/cacheService.ts`
* `mobile/src/lib/network.ts`
* `mobile/src/components/StalenessIndicator.tsx`

**Files Modified:**
* `mobile/src/lib/rides.ts` - Added cached variants
* `mobile/src/lib/profile.ts` - Added `fetchMyProfileWithCache()`
* `mobile/src/app/screens/FeedScreen.tsx` - Use cached data, show indicator
* `mobile/src/app/screens/MyRidesScreen.tsx` - Use cached data, show indicator
* `mobile/src/i18n/en.json` - Added offline translations
* `mobile/src/i18n/he.json` - Added offline translations
* `mobile/package.json` - Added `expo-network` dependency

**Problem Solved:**
* App stuck spinning in areas with poor connectivity
* Users can now view cached feed, profile, and rides when offline
* Clear visual indicator shows data freshness