# Bishvil – Project Documentation

*Last updated: 2026-01-20*

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
  * Max participants (1-6, recommendation for 4)
  * Join mode (Express/Approval)
  * Gender preference (All/Men/Women)
* Owner can cancel rides (notifies all participants)
* Participants can leave rides
* Real-time participant count updates
* **Auto-Add Ride Type Feature:**
  * When creating a ride, the ride type is automatically added to user's profile if not already present
  * Ensures users always see their own rides in feed
  * Example: User with "Trail" creates "Gravel" ride → Profile updates to "Trail,Gravel"

### ✅ Feed & Discovery

* **Smart filtering:**
  * User's preferred ride types (auto-loaded from profile)
  * User's gender (automatic gender-based visibility)
  * Skill level (optional)
  * Time range (Today, 3d, 7d, 14d, 30d)
  * **Persistent filters** - saved to AsyncStorage, restored on app start
* Empty states with helpful CTAs
* Pull-to-refresh
* **Organizer display** with ride statistics

### ✅ My Rides

* **Three sections** with visual status indicators:
  * Organizing (orange badge + OWNER)
  * Joined (green badge + JOINED)
  * Requested (yellow badge + REQUESTED)
* Empty states per section
* **Real-time updates** - automatic refresh when participant status changes

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

### Key File Locations

* **Auth:** `src/lib/supabase.ts`
* **Profiles:** `src/lib/profile.ts`
* **Rides:** `src/lib/rides.ts`
* **Notifications:** `src/lib/notifications.ts`
* **Navigation:** `src/app/navigation/AppNavigator.tsx`
* **Deep Linking:** `src/app/navigation/linking.ts`
* **i18n:** `src/app/i18n/`

---

## Recent Session History

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
