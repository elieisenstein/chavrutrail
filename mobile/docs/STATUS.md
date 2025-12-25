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

Note, we made a bypass with twillio as they block me due to sending too many sms to myself.
We added 3 users Eli, Bob and Alice using emails. Changed the code so that switching between users is done on 
.env file (1 / 2 / 3)

Test 1 Complete ✅
What we achieved:
We verified that Express Rides work correctly - users can join instantly without approval, all participants appear in the list with proper owner badges, participant counts update in real-time, and the join/joined button states work as expected.
Technical fixes applied:

Added missing foreign key constraint from ride_participants.user_id to profiles.id (was pointing to auth.users)
Fixed RLS policy on ride_participants to allow viewing participants of published rides (was too restrictive)
Added missing rides_select_owner RLS policy to allow owners to view their own rides

Test 2 Complete ✅
What we achieved:
We verified that Approval Rides work correctly - users must request to join and wait for owner approval, the owner sees a "Pending Requests" section with Approve/Reject buttons for each requester, approved users move to the Participants list and their status changes to "Joined", rejected users disappear from pending requests and do NOT appear in the Participants list, and the participant count only increases when users are approved (not when they request).
Key features validated:

"Ask to join" button for Approval mode (vs "Join" for Express)
Pending requests visible only to ride owner
Approve button moves user from pending to joined
Reject button removes user from pending without adding to participants
Real-time UI updates with loading states on approve/reject buttons
Participant counts accurately reflect only joined users (not requested)

Minor issue noted for later:

Rejected users can immediately request again (button shows "Ask to join") - may want to add cooldown or prevent re-requests

Test 3 Complete ✅
What we achieved:
We verified that Leave and Cancel functionality works correctly - non-owner participants can leave rides and are removed from the participants list with accurate count updates, owners cannot leave their own rides (button hidden), owners have a "Cancel Ride" button that changes ride status to 'cancelled', and cancelled rides disappear from the feed automatically (filtered by status = 'published').
Implementation decisions:

Owners cannot leave: Must cancel the entire ride instead (prevents orphaned rides)
No ownership transfer: Keeps MVP simple, avoids complex edge cases
Cancelled rides hidden: Feed only shows published rides, so cancelled rides automatically disappear
No cancellation notifications: Joined participants are not notified when owner cancels (deferred to post-MVP)

Minor items deferred to post-MVP:

Notify participants when ride is cancelled
Rejected users can immediately re-request (no cooldown/blocking)
Ownership transfer if needed in future


🎉 M1 Tasks #1 & #2 COMPLETE!
You've successfully completed:

✅ M1 Task #1: Participants list (read-only) with display names and owner badges
✅ M1 Task #2: Owner approval UI with approve/reject buttons and proper state management
✅ Bonus: Owner cancel functionality (prevents orphaned rides)

Technical fixes completed:

Added foreign key ride_participants.user_id → profiles.id
Fixed RLS policies on ride_participants and rides
Added getRideParticipants(), approveJoinRequest(), rejectJoinRequest(), cancelRide() functions
Implemented real-time UI updates with loading states

Added datatime picker

M1 Task #3: Quick Filter Toggles - COMPLETE ✅
What we implemented:
Filter System Architecture:

Added RideFilters type to define filter structure (ride types, skill levels, time range, optional location)
Created listFilteredRides() function in rides.ts that applies filters server-side (types, skills, dates) and includes client-side distance calculation helper (Haversine formula) for future location filtering
Filters are stored in component state and passed to query function

UI Components:

Filter summary bar at top of Feed: Displays current active filters in compact format (e.g., "Filters: All types • Intermediate • 7 days [Edit]")
Edit button opens modal with all filter options
Filter modal contains:

Ride Types: Multi-select checkboxes (Trail, XC, Enduro, Gravel)
Skill Level: Single-select radio behavior (Beginner, Intermediate, Advanced)
Time Range: Single-select radio behavior (Today, 3 days, 7 days, 2 weeks, 30 days)
Reset button (clears to defaults)
Apply button (closes modal and updates feed)



Default Filters (Hardcoded for MVP):

Ride Types: All types (empty = no filter)
Skill Levels: All skills (empty = no filter)
Time Range: Next 7 days ✅ (sensible default for everyone)
Location: Not implemented yet (deferred to post-MVP)

Dynamic Behavior:

Filter summary text updates based on selections (e.g., "Trail, XC • Advanced • Today")
Empty selections display as "All types" / "All skills"
Feed auto-reloads when Apply is pressed
Filters persist during app session

Design decisions:

Single-select for skill (like time range) - prevents showing "Beginner, Advanced" which doesn't make sense
Multi-select for ride types - users often ride multiple types (XC + Trail)
Omitted location from summary since it's not implemented yet
Used checkboxes for familiarity (even though some are single-select behavior)

Deferred to post-MVP:

Location/distance filtering (requires permission handling, GPS)
Profile-based smart defaults (requires Task #4: Profile Fields)
Saved filter preferences

M1 Status Summary
Completed:

✅ Task #1: Participants list with names and owner badges
✅ Task #2: Owner approval UI (approve/reject buttons)
✅ Task #3: Quick filter toggles (ride types, skill, time range)
✅ Bonus: Owner cancel functionality
✅ Bonus: DateTime picker for ride creation

Remaining M1:

⚠️ Task #4: Profile onboarding fields (ride types, skill, pace, birth year, gender)
⚠️ Task #5: UI polish (icons, spacing, dark mode, error states)

Home Region:
Remove from MVP:

❌ Home region - defer until you have a feature that uses it

M1 Task #4: Profile Onboarding Fields - COMPLETE ✅
What we implemented:
Database Schema:

Added birth_year (integer) and gender (text) columns to profiles table
Existing columns utilized: display_name, ride_type, skill, pace
home_region omitted from MVP (deferred until features like notifications/events need it)

profile.ts Updates:

Updated Profile type to include all new fields (ride_type, skill, pace, birth_year, gender)
Created ProfileUpdateInput type for partial updates
Replaced updateMyDisplayName() with general updateMyProfile() function
Critical fixes for robustness:

Changed fetchMyProfile() to return Profile | null (handles missing profile gracefully)
Changed .single() to .maybeSingle() (no crash when profile row doesn't exist)
Changed update() to upsert() (creates profile row if missing)
Added rideTypesToString() and stringToRideTypes() helpers for array conversion
Added .trim() to string parsing to prevent whitespace bugs



ProfileScreen.tsx Features:

Display Name: Text input (required for save)
Ride Types: Multi-select chips (XC, Trail, Enduro, Gravel) - can select multiple
Skill Level: Single-select chips (Beginner, Intermediate, Advanced)
Pace Preference: Single-select chips (Slow, Moderate, Fast)
Birth Year: Number input (4 digits)
Gender: Single-select chips (Male, Female, Skip) - optional, null if skipped
Clean scrollable layout with dividers between sections
Loading and saving states with error handling
Null-safe: handles both new users (no profile) and existing users seamlessly

UI Polish:

Chips use primary color (orange) when selected - matches app theme
showSelectedCheck={false} - no checkmarks, no layout shift
White text on selected chips for readability
Consistent visual language with buttons throughout app
All selections persist correctly to database

Design Decisions:

No home region for MVP - reduces onboarding friction, GPS better for location
Multi-select ride types - users often ride multiple types
Single-select skill/pace - prevents nonsensical combinations
Optional gender - "Skip" option respects privacy
Upsert pattern - robust across environments, handles missing rows gracefully

Testing Validated:

Profile saves and persists across sessions
Multiple users have independent profiles
Empty profile loads without crashing
Multi-select and single-select work correctly
Database updates reflect UI changes accurately


M1 Status - Nearly Complete! 🎉
Completed Tasks:

✅ Task #1: Participants list with names and owner badges
✅ Task #2: Owner approval UI (approve/reject buttons)
✅ Task #3: Quick filter toggles (ride types, skill, time range)
✅ Task #4: Profile onboarding fields
✅ Bonus: Owner cancel functionality
✅ Bonus: DateTime picker for ride creation


## How to Run
```bash
cd mobile
npx expo start -c

