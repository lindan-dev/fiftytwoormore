# Add Location to Activity Logging

## Goal
Capture an optional location (auto via browser GPS) when logging a moment, with smart default from the last used location. Surface the location in the activity log, stats, and emails.

## User Experience

**In the log dialog:**
- New "Location" row with a 📍 button labeled "Use my location"
- On click → request browser geolocation → reverse-geocode to "City, Country" (e.g. "Stockholm, Sweden")
- Once captured, shows as a chip: `📍 Stockholm, Sweden ✕` (clearable)
- Smart default: pre-fills with the user's most recent activity's location (if any), so frequent loggers don't need to re-tap
- A small "Edit" link lets them tweak the text manually
- Fully optional — they can leave it blank and log as before

**In the activity log:**
- Location chip shown beneath the note (if present)

**In stats:**
- New "Top locations" mini-card in the extended stats (rank by count, show top 5 with flag emoji when available)
- "On this day" copy mentions the location when present ("…in Stockholm")

**In emails (weekly digest, mid-week nudge, on-this-day, year-in-review):**
- When a featured moment has a location, include it inline ("Monday's moment in Stockholm 🇸🇪")
- Year in Review gets a new "Places" line: "You logged moments in 3 places this year"

## Technical Details

### Database
- Migration: add `location_label TEXT`, `location_lat NUMERIC`, `location_lng NUMERIC`, `location_country TEXT` to `public.activities` (all nullable)
- No new RLS needed — inherits existing activity policies

### Geocoding
- Use the existing Google Maps Platform connector (already in the project) via the gateway
- Reverse geocoding endpoint: `GET /maps/api/geocode/json?latlng={lat},{lng}` through `connector-gateway.lovable.dev/google_maps/...`
- New edge function `reverse-geocode` that takes `{lat, lng}` and returns `{ label, country }` — keeps API key server-side
- Parse `address_components` for `locality` (city) and `country` (long name + short code → flag emoji)

### Frontend
- `src/components/LocationPicker.tsx` — small component used inside the log dialog
  - Reads `navigator.geolocation.getCurrentPosition`
  - Calls `supabase.functions.invoke('reverse-geocode', { body: { lat, lng } })`
  - Emits `{ label, country, lat, lng }` upward
- Update `Index.tsx` logging flow to pass location fields to insert
- Update `ActivityLog.tsx` to render the location chip
- Smart default: query the user's latest activity with non-null `location_label` on dialog open and pre-fill
- Update `StatsView.tsx` with a "Top locations" card
- Update `OnThisDay.tsx` copy when location is present

### Edge functions
- `send-weekly-digest`, `send-midweek-nudge`, `send-yearly-review`: include location in the featured-moment lines and aggregate `locationsCount` for the year-in-review

### Country → flag emoji
- Tiny helper in `src/lib/countryFlag.ts`: ISO-2 code → flag emoji (regional indicator math). Mirror in `supabase/functions/_shared/countryFlag.ts` for emails.

### Files to add
- `supabase/functions/reverse-geocode/index.ts`
- `src/components/LocationPicker.tsx`
- `src/lib/countryFlag.ts`
- `supabase/functions/_shared/countryFlag.ts`
- Migration adding the four new columns

### Files to modify
- `src/components/ActivityLog.tsx` — show chip
- `src/pages/Index.tsx` — wire LocationPicker into log dialog + insert payload + smart default
- `src/components/StatsView.tsx` — Top Locations card
- `src/components/OnThisDay.tsx` — include location in copy
- `supabase/functions/send-weekly-digest/index.ts`
- `supabase/functions/send-midweek-nudge/index.ts`
- `supabase/functions/send-yearly-review/index.ts`

## Out of scope
- Map view of locations (could be a follow-up)
- Per-user privacy settings to hide locations (current model: only the couple sees their own data)
- Editing historical activities to add a location retroactively (only new logs get the picker; the edit dialog can be extended later if you want)
