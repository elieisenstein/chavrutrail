# Chavrutrail – Project Status

**Last Updated:** December 26, 2024

---

## Environment
- **OS:** Windows
- **Dev Tool:** VS Code
- **Mobile:** Expo Go (Android device) + Production APK builds via EAS
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Auth:** Twilio Phone OTP (verified numbers for testing)

---

## Current Status: M1 Complete (Ready for Pilot Testing) 🎉

### Phase: M1 – Core MVP ✅

**Completion:** 100%

All core functionality implemented and tested. App is ready for initial pilot testing with family/friends.

---

## M1 Completed Features

### ✅ Authentication & User Management
- Phone OTP via Twilio (verified numbers for testing)
- Supabase Auth integration
- Profile auto-creation on signup
- DEV auth bypass for testing (email/password via .env)
- Multi-user testing setup (Eli, Alice, Bob)

### ✅ Core Ride Management
**Create Ride Wizard:**
- When: DateTime picker (blocks past dates/times, timezone-aware)
- Where: Text-based meeting point + optional route description (no map/GPS for MVP)
- Details: Ride type, skill level, pace, distance, elevation
- Group: Express (instant join) vs Approval (owner approves), max participants
- Review: Summary before publishing

**Ride Features:**
- Published rides appear in Feed
- Ride Details screen with full info
- Participants list with owner badges
- Real-time participant counts
- Owner cancel functionality

### ✅ Join & Approval System
**Express Mode:**
- Instant join, no approval needed
- Real-time participant updates

**Approval Mode:**
- "Ask to join" button for participants
- Pending requests section (owner only)
- Approve/reject buttons with loading states
- Approved users move to participants list
- Rejected users removed from pending

**Leave/Cancel:**
- Non-owners can leave rides
- Owners must cancel entire ride (prevents orphaned rides)
- Cancelled rides hidden from feed

### ✅ Feed & Filtering
**Feed Display:**
- Lists upcoming published rides
- Shows: type, skill, when, where, route description, group size
- Tap card → Ride Details
- Empty state with bike icon and "Adjust Filters" button

**Smart Filters:**
- Ride types (XC, Trail, Enduro, Gravel) - multi-select
- Skill level (Beginner, Intermediate, Advanced) - single-select
- Time range (Today, 3 days, 7 days, 2 weeks, 30 days) - single-select
- Filter summary: "Filters: Trail • Intermediate • 7 days [Edit]"
- Bottom sheet modal for editing
- Reset to defaults button

### ✅ User Profiles
**Profile Fields:**
- Display name (required)
- Ride types (multi-select chips)
- Skill level (single-select)
- Pace preference (Slow, Moderate, Fast)
- Birth year
- Gender (optional, with "Skip")

**Profile Features:**
- Null-safe loading (handles missing profiles)
- Upsert pattern (creates profile if doesn't exist)
- Settings button (theme, language)
- Sign out

### ✅ Internationalization (i18n)
- Hebrew and English support
- RTL (right-to-left) for Hebrew
- LTR (left-to-right) for English
- Translations for all UI elements
- Language switcher in Settings
- Navigation elements stay in consistent positions regardless of RTL

### ✅ UI Polish
**Navigation:**
- Bottom tabs with icons: 🚴 Feed, ➕ Create, 👤 Profile
- Orange active tab, gray inactive
- Consistent tab order regardless of RTL

**Theme System:**
- Light, Dark, System modes
- Orange primary color
- Consistent button styling

**Empty States:**
- Feed: Helpful message + icon when no rides
- Participants: Contextual messages for owners vs non-owners

**Error Prevention:**
- Block creating rides in past
- Validate required fields
- Loading states on buttons
- Disabled states for invalid actions

---

## Technical Architecture

### Database (Supabase)
**Tables:**
- `profiles` (id, display_name, ride_type, skill, pace, birth_year, gender)
- `rides` (id, owner_id, status, start_at, start_lat, start_lng, start_name, ride_type, skill_level, pace, distance_km, elevation_m, join_mode, max_participants, notes)
- `ride_participants` (ride_id, user_id, role, status)

**RLS Policies:**
- Profiles: Users can read all, update only own
- Rides: Users can read published rides, create/update/cancel own
- Participants: Users can view participants of published rides, join/leave rides

**Key Design Decisions:**
- Dummy coordinates (0,0) stored for rides (text description used instead)
- UTC timestamps in DB, Israel timezone for display
- Upsert pattern for profile saves (handles missing rows)

### React Native App Structure
```
mobile/
├── src/
│   ├── app/
│   │   ├── navigation/   (AuthGate, AppNavigator, tab stacks)
│   │   └── state/        (AppSettingsContext)
│   ├── screens/
│   │   ├── FeedScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── RideDetailsScreen.tsx
│   │   └── createRide/   (wizard steps)
│   ├── lib/
│   │   ├── supabase.ts   (client config)
│   │   ├── rides.ts      (CRUD + filters)
│   │   ├── profile.ts    (CRUD)
│   │   └── datetime.ts   (timezone handling)
│   └── i18n/
│       ├── index.ts      (i18n + RTL config)
│       ├── en.json
│       └── he.json
```

---

## Testing Status

### ✅ Multi-User Testing Complete
- 3 test users (Eli, Alice, Bob)
- Express rides tested: instant join, real-time updates
- Approval rides tested: request → approve/reject flow
- Leave/cancel tested: participants can leave, owners cancel
- Filter combinations tested: types, skills, time ranges

### ✅ Production Build Tested
- APK built via EAS (Expo Application Services)
- Installed on physical Android device
- Real Twilio phone OTP tested with verified number
- All core flows validated

---

## Known Limitations & Deferred Features

### Post-MVP (To Address Later):
**Location Features:**
- No GPS/map picker (text description only for now)
- No distance-based filtering ("near me")
- No location permission handling

**Profile Enhancements:**
- Home region field (deferred until needed for notifications)
- Profile-based smart filter defaults

**User Experience:**
- No cooldown for rejected join requests (can re-request immediately)
- No push notifications when ride cancelled
- No error toast messages (console.log only)
- Settings as separate tab (currently nested in Profile)

**Content:**
- Most UI still needs Hebrew translations
- Limited empty states/error messages

---

## TODO: End of M1 Polish (Optional)

### Priority 1: User-Facing Issues
- [ ] Complete Hebrew translations for all screens
- [ ] Add toast/snackbar for errors (instead of console.log)
- [ ] Dark mode color validation
- [ ] Add "no internet" error handling

### Priority 2: UX Improvements
- [ ] Better loading indicators (skeleton screens?)
- [ ] Confirmation dialogs (cancel ride, leave ride)
- [ ] Ride edit functionality (owner can edit before ride starts)
- [ ] Ride deletion (owner can delete draft rides)

### Priority 3: Polish
- [ ] Icon consistency pass
- [ ] Spacing/padding consistency
- [ ] Add app icon and splash screen
- [ ] Add "About" screen with version info

---

## M2 Planning: Social & Safety Features

### M2 Goals (Next Phase)
**Timeline:** 2-3 weeks  
**Focus:** Make the app safe and engaging for real-world use

### M2.1: In-App Chat (Critical for Safety)
**Why:** Participants need to communicate about ride logistics, changes, emergencies

**Features:**
- [ ] Per-ride chat room (all joined participants + owner)
- [ ] Real-time messaging via Supabase Realtime
- [ ] Message notifications (when app is open)
- [ ] Chat shows: participant name, timestamp
- [ ] Owner can send announcements (highlighted messages)
- [ ] Chat disabled after ride ends (read-only archive)

**Technical:**
- New table: `ride_messages` (ride_id, user_id, message, created_at)
- RLS: Only joined participants can read/write
- Supabase Realtime subscription per ride
- Simple text messages only (no media/emojis for MVP)

### M2.2: Push Notifications (Transactional)
**Why:** Users need to know about ride updates when app is closed

**Critical Notifications:**
- [ ] Join request received (owner, approval mode)
- [ ] Join request approved/rejected (participant)
- [ ] Ride cancelled by owner (all participants)
- [ ] New chat message in your rides (all participants)
- [ ] Ride starts in 1 hour (reminder to all participants)

**Technical:**
- Expo Push Notifications
- New table: `notification_preferences` (user_id, enabled, channels)
- Background jobs via Supabase Edge Functions or cron
- Send only transactional notifications (not marketing)

### M2.3: Advanced Filters
**Why:** Users need to find rides that match their preferences

**Features:**
- [ ] Location/distance filter ("within 25km of me")
- [ ] Use profile preferences as smart defaults
- [ ] Save filter presets
- [ ] "My rides" filter (rides I've joined or created)

**Technical:**
- Request location permission
- PostGIS extension in Supabase for geo queries
- Store last known location in AsyncStorage
- Fallback to home region if location denied

### M2.4: Report & Block
**Why:** Safety and community trust are essential

**Features:**
- [ ] Report ride (spam, inappropriate, dangerous)
- [ ] Report user (harassment, no-show, unsafe behavior)
- [ ] Block user (prevents seeing their rides, joining same rides)
- [ ] Admin review dashboard (Supabase Dashboard or custom)

**Technical:**
- New tables: `reports` (reporter_id, reported_id, reason, status)
- New table: `blocks` (blocker_id, blocked_id)
- RLS: Users can't see rides created by blocked users
- Email notification to admin on report

### M2.5: Ride Lifecycle
**Why:** Complete the ride experience

**Features:**
- [ ] Ride status: draft → published → in-progress → completed
- [ ] Mark ride as "in progress" (manual or auto at start time)
- [ ] Mark ride as "completed" (owner or auto after end time)
- [ ] Rate ride experience (star rating, optional comment)
- [ ] Ride history (past rides you've joined)

**Technical:**
- Update ride status enum
- Add `end_at` timestamp (calculated from start + estimated duration)
- New table: `ride_ratings` (ride_id, user_id, rating, comment)
- Past rides feed (filter by status=completed)

---

## M3+ Future Enhancements (Post-Pilot)

### Social Features
- User profiles with stats (rides completed, rating, bio)
- Follow/friend system
- Activity feed (friend joined a ride, completed a ride)
- Ride photos/gallery
- Route sharing (GPX export/import)

### Discovery
- Recommended rides based on profile/history
- Recurring rides (weekly Saturday morning ride)
- Ride series/challenges (complete 10 rides this month)
- Popular routes (most-ridden trails)

### Safety & Trust
- Verified riders (phone verified, ID verified)
- Ride insurance integration
- Emergency contacts
- Live location sharing during ride
- SOS button

### Advanced Features
- Integration with Strava/Komoot
- Bike gear recommendations
- Weather alerts
- Trail conditions reports
- Ride skills/coaching system

---

## Development Workflow

### Local Development
```bash
cd mobile
npx expo start -c        # Clear cache and start
```

**Testing Users (via .env):**
```env
EXPO_PUBLIC_DEV_AUTH_BYPASS=true  # Enable dev bypass
EXPO_PUBLIC_DEV_USER=1            # Switch between 1/2/3
```

### Building APK
```bash
cd mobile
eas build --platform android --profile preview
```

**Build time:** 10-20 minutes  
**Download:** From Expo dashboard or terminal link  
**Install:** Transfer APK to phone, enable "Install unknown apps", install

### Database Management
- **Dashboard:** https://supabase.com
- **SQL Editor:** For schema changes, RLS policies
- **Table Editor:** For manual data inspection
- **Auth:** For user management

---

## Critical Files Reference

**Config:**
- `mobile/.env` - Environment variables (Supabase, dev bypass)
- `mobile/app.json` - Expo config
- `mobile/eas.json` - EAS build config

**Auth:**
- `src/app/navigation/AuthGate.tsx` - Auth check + dev bypass

**Rides:**
- `src/lib/rides.ts` - All ride CRUD + filters
- `src/screens/FeedScreen.tsx` - Main feed with filters
- `src/screens/RideDetailsScreen.tsx` - Ride details + join/approve
- `src/screens/createRide/CreateRideWizard.tsx` - Multi-step wizard

**Profiles:**
- `src/lib/profile.ts` - Profile CRUD
- `src/screens/ProfileScreen.tsx` - Profile form with chips

**i18n:**
- `src/i18n/index.ts` - i18n + RTL config
- `src/i18n/en.json` - English translations
- `src/i18n/he.json` - Hebrew translations

---

## Success Metrics (Pilot Phase Goals)

**Week 1-2:**
- [ ] 5-10 active testers (family/friends)
- [ ] 10+ rides created
- [ ] 20+ ride joins
- [ ] Zero critical bugs reported
- [ ] Average 2+ participants per ride

**Week 3-4:**
- [ ] User feedback collected via survey
- [ ] Iterate on pain points
- [ ] Add 2-3 most-requested features
- [ ] Prepare for wider beta (M2 features)

**Success Indicators:**
- Users create rides without help
- Users successfully find and join rides
- Repeat usage (same user creates/joins multiple rides)
- Positive feedback on core UX

---

## Contact & Resources

**Developer:** Eli Eisenstein  
**Project:** Chavrutrail MVP  
**Repository:** (Add GitHub link when ready)  
**Supabase Project:** chavrutrail  
**Twilio Account:** Trial (verified numbers only)

---

**Status:** Ready for pilot testing! 🚀  
**Next Step:** Deploy APK to 5-10 testers and gather feedback.

Build:
cd mobile
npx expo run:android --variant release

Minor Issue (Cosmetic) ⚠️

Icons reverse in Hebrew (Profile left instead of right)
Everything else works fine
This is a known React Navigation + RTL limitation