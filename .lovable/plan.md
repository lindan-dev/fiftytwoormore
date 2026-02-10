

# Year in Review - Visibility Logic Update

## Current Issues

1. **No data check**: The Year in Review cards show even if the user has zero activities for the previous year
2. **No Jan 1st availability logic**: The feature doesn't gate on the calendar year turning over
3. **Top panel never disappears**: The prominent Index.tsx card stays visible all year instead of just the first 2 weeks
4. **StatsView card visibility**: Should remain available all year (this already works, just needs the data check)

## Proposed Changes

### 1. Add a helper to check for previous-year data

Create a small helper (or inline logic) that checks whether the user has any activities from the previous calendar year. This determines whether Year in Review is shown at all.

### 2. Index.tsx - Top Panel (prominent card)

- Only show if the user has activities from the previous year
- Only show during the first 2 weeks of the new year (January 1-14)
- After January 14, the card disappears from the Index page
- Available immediately on January 1st

### 3. StatsView - Bottom CTA card

- Only show if the user has activities from the previous year
- Stays visible throughout the entire year (no time limit)
- This is the persistent entry point after the top panel disappears

### 4. YearInReview page itself

- No changes needed to the page. It already accepts a `?year=` param and filters data accordingly. If someone navigates to it with no data, it shows a loading/empty state.

---

## Technical Details

### Index.tsx changes (top panel)

Add two conditions to the Year in Review card:

```text
const now = new Date();
const previousYear = now.getFullYear() - 1;
const isWithinFirstTwoWeeks = now.getMonth() === 0 && now.getDate() <= 14;
const hasPreviousYearData = activities.some(a => 
  new Date(a.activity_date).getFullYear() === previousYear
);
```

Wrap the card with: `{hasPreviousYearData && isWithinFirstTwoWeeks && ( ... )}`

### StatsView.tsx changes (bottom CTA)

Replace the current `activities.length > 0` condition:

```text
const previousYear = new Date().getFullYear() - 1;
const hasPreviousYearData = activities.some(a => 
  new Date(a.activity_date).getFullYear() === previousYear
);
```

Wrap the card with: `{hasPreviousYearData && ( ... )}`

### Files to modify
- `src/pages/Index.tsx` - Add date + data gating to the top Year in Review card
- `src/components/StatsView.tsx` - Add data gating to the bottom Year in Review CTA

