# Chavrutrail – Decisions Log

## Stack
- React Native + Expo chosen over Flutter
  - Reason: faster MVP, sufficient UI control, existing familiarity
- Native look (Strava-like) achieved via design system, not framework choice

## Auth
- Phone OTP only
  - Israeli standard
  - Better completion rate than email
- Twilio Verify via Supabase
- No email auth in MVP

## Profiles
- profiles table separate from auth.users
- profiles auto-created via DB trigger
- Raw phone number NOT stored in profiles
  - Avoid duplication
  - Reduce exposure of sensitive data

## Privacy
- Phone numbers never shown to other users
- Identity = display_name only
- Future: optional masked phone or contact via in-app chat only

## UI
- Material Design 3 via react-native-paper
- Centralized theme (light/dark)
- Design tokens (colors, typography, spacing)

## Backend
- No custom backend in MVP critical path
- FastAPI reserved for:
  - moderation
  - trust scoring
  - scheduled jobs
  - integrations (Strava, WhatsApp)
