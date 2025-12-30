# Auth System

## Current Setup (Password-based)
- Users log in with email/password
- No email verification needed (accounts created via admin script)
- Password reset available (rate limited: 2 emails/hour)

## Files
- `AuthScreen.tsx` - Main auth coordinator
- `LoginScreen.tsx` - Password login form
- `ForgotPasswordScreen.tsx` - Password reset flow

## Future: OTP Flow (Currently Disabled)
- `RequestOtp.tsx` - Request OTP via email/SMS
- `VerifyOtp.tsx` - Verify OTP code

### Why OTP is disabled:
- Supabase free tier: 2 emails/hour rate limit
- SMS via Twilio requires paid account + setup
- For MVP, manual user creation is more practical

### To enable OTP in future:
1. Upgrade Supabase plan or configure custom SMTP
2. Update `AuthScreen.tsx` to show `RequestOtp` instead of `LoginScreen`
3. Enable email auth in Supabase dashboard (currently disabled)
4. For SMS: Configure Twilio credentials in Supabase

## Admin Scripts
See `/scripts/createUsers.js` for creating beta users