🎯 Priority 1: Core Notification Flow (Today)
We've built the infrastructure - now let's test it end-to-end:
Task 1.1: Test Full Approval Flow
What: Create a second test account and test:

User B requests to join User A's ride (approval mode)
User A gets notification → approves
User B gets approval notification
User A cancels ride → everyone gets notified

Why: Validates our entire notification system works

Task 1.2: Phone Number Collection Flow
What: When user joins a ride, check if they have phone_number in profile:

If missing → Show modal: "Please add your phone number to coordinate with the group"
Save to profiles.phone_number

Why: Required for WhatsApp coordination
Files to modify:

Add phone field to profiles table (already done)
Update join flow in RideDetailsScreen.tsx
Create phone input modal component


🎯 Priority 2: WhatsApp Integration (Today)
Task 2.1: WhatsApp Group Link
What: Add WhatsApp link field when creating/editing ride:

Owner adds WhatsApp group invite link
Approved participants see "Join WhatsApp Group" button

Files:

Add whatsapp_link to rides table
Update CreateRideWizard
Update RideDetailsScreen to show button


Task 2.2: Edit Ride + Notify Participants
What: Allow owner to edit ride details:

Edit button on RideDetails (owner only)
Opens CreateRideWizard with existing data
On save → notify all participants of changes

Files:

Create updateRide() in rides.ts
Add edit button in RideDetailsScreen
Use notifyParticipantsOfRideUpdate() we already built


🎯 Priority 3: Feed Improvements (Tomorrow)
Task 3.1: Auto-Hide Past Rides
Already implemented! Your query has .gte("start_at", nowIso)
Task 3.2: Personalized Feed
What: Filter feed by user's preferred ride types from profile
Files:

Fetch user's ride_type preferences from profile
Pass to listFilteredRides() as default filters


🎯 Priority 4: Sharing & Growth (This Week)
Task 4.1: Share Ride Link
Already implemented! ShareRideButton.tsx exists with deep linking
Task 4.2: Onboarding Flow
What: First-time users must set:

Display name
Home region (new field)
Preferred ride types


❌ Postponed (Not Now)

❌ Internal chat (use WhatsApp)
❌ Photo uploads
❌ Ratings/reviews
❌ "I'm at the spot" button (nice-to-have)


Add picture to profile
link on participants to their profile page
Feed - make shorted, Location, type, skill, rate - in one line or max 2 lines
search community
list of followwing / followed by
manage notifications e.g. events created / joine by following