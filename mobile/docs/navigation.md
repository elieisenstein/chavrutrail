# Navigation Feature Documentation

## Overview

The Bishvil navigation feature provides real-time GPS tracking with ultra-low power consumption for cycling and hiking activities. It features two map modes (North-Up and Heading-Up), live position tracking, and intelligent battery optimization.

## Architecture

### Three-Layer GPS System

The navigation system uses a sophisticated three-layer architecture to optimize battery life while maintaining responsive tracking:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: GPS Hardware → Android FusedLocationProvider        │
│ - Adaptive GPS Priority (HIGH_ACCURACY / BALANCED_POWER)     │
│ - Dynamic Intervals (1s / 2s / 3s based on speed/motion)     │
│ - Hardware-level filtering (minDistanceMeters, minTimeMs)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Android → Native Module (BishvilNavigationModule)   │
│ - Receives GPS updates from FusedLocationProvider            │
│ - Motion detection via accelerometer (MOVING/STATIONARY)     │
│ - Restarts GPS with new settings on motion state change      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Native Module → JavaScript (React Native)           │
│ - Adaptive commit logic (dr/dθ/dt thresholds)                │
│ - Smart filtering based on distance, heading, and time       │
│ - Linear velocity-based adaptive sampling                    │
│ - Emits NavCommitEvent only when thresholds are met          │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: GPS Hardware Optimization

**Adaptive GPS Priority:**
- **MOVING**: Uses `PRIORITY_HIGH_ACCURACY` (full GPS, 5-10m accuracy)
- **STATIONARY**: Switches to `PRIORITY_BALANCED_POWER_ACCURACY` (GPS+WiFi/Cell, 20-50m accuracy)

**Dynamic Intervals:**
- **Fast moving** (speed ≥ 1.5 m/s): 1 second interval (`minTimeMs`)
- **Slow moving** (speed < 1.5 m/s): 2 second interval (`minTimeMs * 2`)
- **Stationary**: 3 second interval (`minTimeMs * 3`)

**Auto-Restart:**
- Monitors motion state changes
- Automatically restarts GPS with new priority/interval settings
- Prevents stale GPS configuration

**Battery Impact:**
- HIGH_ACCURACY: ~180 mAh/hour
- BALANCED_POWER_ACCURACY: ~60 mAh/hour
- Average savings: ~28% across typical ride

### Layer 2: Motion Detection

**Accelerometer-Based Motion Gating:**
- Samples accelerometer every 500ms
- Calculates magnitude: `sqrt(x² + y² + z²)`
- Maintains rolling window of samples (800ms)
- Computes variance of magnitudes
- **STATIONARY** if variance < threshold (0.15)
- **MOVING** if variance ≥ threshold

**Purpose:**
- Fast gate to detect device movement
- Reduces GPS reads when stationary
- Triggers Layer 1 GPS settings changes

### Layer 3: Adaptive Commit Logic

**Linear Velocity-Based Sampling:**

The system adjusts update frequency based on GPS speed using linear formulas:

**Time Threshold (adaptiveMinTimeMs):**
```kotlin
max(300, 3000 - speed * 600)
```
- At 0 m/s → 3000ms (3 seconds)
- At 1.5 m/s → 2100ms
- At 4.5+ m/s → 300ms (clamped)
- Slope: -600ms per m/s

**Distance Threshold (adaptiveMinDistance):**
```kotlin
max(3.0, min(20.0, 3.0 + speed * 2.5))
```
- At 0 m/s → 3m
- At 3 m/s → 10.5m
- At 6.8+ m/s → 20m (clamped)
- Slope: +2.5 meters per m/s

**Commit Decision:**

A position update is committed (sent to JavaScript) when ANY of these conditions are met:

1. **DR (Distance)**: Movement ≥ adaptiveMinDistance
2. **DTHETA (Heading)**: Heading change ≥ 10° (configurable)
3. **DT (Time)**: Time elapsed ≥ adaptiveMinTimeMs

**NavCommitEvent Structure:**
```typescript
{
  timestamp: number,
  latitude: number,
  longitude: number,
  heading: number,       // 0-360 degrees
  speed: number,         // m/s
  accuracy: number,      // meters
  drMeters: number,      // distance since last commit
  dThetaDeg: number,     // heading change since last commit
  dtMs: number,          // time since last commit
  reason: "DR" | "DTHETA" | "DT" | "INIT",
  motionState: "MOVING" | "STATIONARY"
}
```

## Configuration Parameters

### Default Settings
```typescript
{
  minDistanceMeters: 15,        // GPS coarse filter (Layer 1)
  minHeadingDegrees: 10,        // Heading change threshold
  minTimeMs: 1000,              // Base time threshold, GPS intervals, STATIONARY timeout
  motionVarianceThreshold: 0.15, // Accelerometer sensitivity
  motionWindowMs: 800           // Accelerometer sampling window
}
```

### Parameter Usage

**minDistanceMeters (15m):**
- Used in Layer 1 GPS hardware filtering
- Android `setMinUpdateDistanceMeters(minDistanceMeters / 2)`
- Prevents GPS spam at hardware level

**minHeadingDegrees (10°):**
- Used in Layer 3 commit logic
- Triggers update on significant turns
- Ideal for trail navigation

**minTimeMs (1000ms):**
- **Layer 1**: Base GPS interval when moving fast
- **Layer 2**: Multiplied for slow/stationary intervals (2s, 3s)
- **Layer 3**: Multiplied by 5 for STATIONARY override (5s)

**motionVarianceThreshold (0.15):**
- Accelerometer sensitivity for motion detection
- Lower = more sensitive to small movements
- Higher = only detects larger movements

**motionWindowMs (800ms):**
- Rolling window for accelerometer samples
- Smooths out momentary vibrations
- Balances responsiveness vs noise

## UI Components

### NavigationMapView

**Map Initialization Pattern:**
- Mimics `MapPickerModal.tsx` to prevent zoom-out flash
- Uses expo-location to get initial position BEFORE rendering map
- State: `mapCenter` and `mapZoom` start as **null**
- Map only renders when both are set: `{mapCenter && mapZoom !== null ? (`

**Camera Configuration:**
```typescript
<MapboxGL.Camera
  zoomLevel={mapZoom}
  centerCoordinate={currentPosition && !isUserInteracting ? undefined : mapCenter}
  pitch={cameraPitch}
  heading={cameraBearing}
  animationDuration={currentPosition && !isUserInteracting ? 300 : 0}
  followUserLocation={!!currentPosition && !isUserInteracting}
  followUserMode={mode === 'heading-up' ? FollowWithCourse : Follow}
  followPadding={{
    paddingTop: 400,     // User at bottom 1/3
    paddingBottom: 100,
    paddingLeft: 50,     // Centered horizontally
    paddingRight: 50,
  }}
/>
```

**Key Principles:**
- Uses `followUserLocation` with `followPadding` to position user at bottom 1/3
- Conditional `centerCoordinate` - only set initially, then undefined to let followUserLocation take over
- Manual map interaction pauses auto-tracking for 5 seconds
- Auto-recenters after 5 seconds of inactivity

**Auto-Recenter Feature:**
- Detects user map interaction via `onTouchStart`
- Sets 5-second timeout to restore automatic tracking
- During manual interaction:
  - Disables `followUserLocation`
  - Disables heading rotation and pitch
  - User has full manual control
- After timeout expires:
  - Re-enables automatic tracking
  - Restores navigation mode (North-Up or Heading-Up)
  - Camera recenters on user position

**Map Modes:**

1. **North-Up Mode:**
   - Map orientation: North always up (bearing = 0, pitch = 0)
   - Icon: Red compass needle pointing upward
   - User perspective: Traditional map view
   - Best for: Understanding cardinal directions, general navigation

2. **Heading-Up Mode:**
   - Map orientation: Rotates with user heading
   - Icon: Orange ship wheel
   - Camera pitch: 45° for 3D perspective
   - User perspective: Forward-facing view (what's ahead is up)
   - Best for: Turn-by-turn navigation, following trails

**Mode Toggle:**
- Icon-only button at top-right (where traditional compass appears)
- Fully transparent background, no circle
- North-Up: Red compass icon (`navigation`) - pointing up
- Heading-Up: Orange ship wheel icon (`ship-wheel`)
- Position: `top: 56, right: 16`
- Mapbox built-in compass disabled (`compassEnabled={false}`)
- **North-Up explicitly resets heading**: Uses `cameraRef.setCamera({ heading: 0, pitch: 0 })` to ensure map faces north

### Route Navigation Features

**Route Preview Mode:**
When a route is loaded (from GPX file picker or ride details), the map enters "preview mode":
- Camera animates to fit route bounds (shows entire route)
- `followUserLocation = false` - camera doesn't follow user
- `isUserInteracting = true` - prevents auto-recenter
- Shows recenter button (blue crosshairs)
- Shows distance-to-start metrics: "Route loaded • X.X km to start"

**Recenter Button:**
- Blue crosshairs icon (`crosshairs-gps`)
- Position: `bottom: 88, right: 16` (above route action button)
- **Shows when**: `!shouldFollow` (user panned away OR route just loaded)
- **Preserves zoom level**: Tracks current zoom via `onRegionDidChange`, uses it when recentering
- **Two behaviors**:
  - Route preview mode: Explicit recenter required (no auto-return)
  - Manual pan/zoom: Auto-returns after 5 seconds of inactivity

**Distance Gating (Performance Optimization):**
Expensive route calculations are only performed when user is near the route:
- **Far from route** (outside bbox + 2km margin):
  - Cheap computation: distance to start point only
  - Display: `"Route loaded • X.X km to start"`
- **Near route** (inside bbox + 2km margin):
  - Full computation: progress, remaining distance, ascent, ETA
  - Display: `"X.X km • +XXX m • ~XX min"`

**Route Metrics Display:**
- Position: Top-center pill (below status bar)
- Always shows all three metrics or none (consistent display)
- Format: `"X.X km • +XXX m • ~XX min"`
- ETA shows `"-- min"` when speed is too low to calculate

### GPX Loading

**Load GPX from Navigation Tab:**
- Green folder icon button (`folder-open`) at bottom-right
- Uses `expo-document-picker` to select GPX file
- Validates:
  - File size < 5MB (`MAX_GPX_FILE_SIZE`)
  - Valid GPX XML format
  - At least 2 coordinate points
- **Ephemeral loading**: Route is not saved to database
- Clear with red X button (`close-circle`) - same position

**Route Sources Priority:**
1. **Params from ride details** (highest) - `route.params?.route`
2. **Local GPX upload** - `localRoute?.coords`
3. **Free navigation** (no route)

**Route Action Button:**
- Position: `bottom: 24, right: 16`
- Green folder when no route (load GPX)
- Red X when route loaded (clear route)

**Speed Display Filter:**
```typescript
// Show 0 if: speed < 0.5 m/s (1.8 km/h) OR accuracy > 20m
const speedKmh = currentPosition &&
                  currentPosition.speed >= 0.5 &&
                  currentPosition.accuracy <= 20
  ? rawSpeedKmh
  : 0;
```
- Filters out GPS drift when stationary
- Prevents false speed readings indoors
- Only shows speed when moving with good GPS signal

**Stats Overlay (Top Bar):**
- Position: `top: 48` (below Android status bar)
- Background: `rgba(0, 0, 0, 0.85)` with rounded corners
- Displays 4 metrics in one compact row:
  1. **Distance**: Formatted as "X.XX km" or "X m"
  2. **Time**: Formatted as "Xh Ym" or "Xm" or "Xs"
  3. **Speed**: Filtered speed in km/h (1 decimal)
  4. **Accuracy**: GPS accuracy in meters (±Xm)
- Font sizes: 13px values, 9px labels (uppercase)
- Dividers between stats for clarity
- Auto-hides when no position available

### NavigationScreen

**Features:**
- **Full-screen map** - no header, map fills entire screen
- **Icon-only floating controls** - minimal UI overlaid on map
- **Compact stats bar** - all 4 metrics at top
- Permission handling
- Lifecycle management (stops on unmount)

**Tab Press Reset:**
- Pressing Navigation tab while already on screen resets to free navigation
- Clears any loaded route (from params or GPX)
- Listens to `tabPress` event via `navigation.addListener`
- Sets `forceFreeNavigation = true` and `localRoute = null`

**UI Layout:**
```
┌─────────────────────────────────┐
│ [Android Status Bar]            │  ← System UI
├─────────────────────────────────┤
│   [Route Metrics Pill]          │  ← "X.X km • +XXX m • ~XX min" (top-center)
│                [Mode Toggle]    │  ← Mode toggle (top: 56, right: 16)
│                                  │
│                                  │
│        [Full Map View]           │
│                                  │
│                                  │
│                    [Recenter]   │  ← Blue crosshairs (bottom: 88, right: 16)
│ [Speed Pill]      [Route Action]│  ← Speed (bottom-left), GPX button (bottom: 24, right: 16)
└─────────────────────────────────┘
```

**Button Stack (bottom-right):**
1. **Recenter button** (`bottom: 88`) - Blue crosshairs, only when not following
2. **Route action button** (`bottom: 24`) - Green folder (load GPX) or red X (clear route)

**Floating Controls:**
- Position: Bottom-right corner (`bottom: 24, right: 16`)
- Icon-only circular buttons (56x56px)
- Vertical stack with 12px gap
- **Pause/Resume button:**
  - Active state: Pause icon, surface background
  - Paused state: Play icon, primary (orange) background
- **Stop button:**
  - Stop icon, error (red) background
  - Shows confirmation dialog before stopping
- Elevation: 6 with shadow for visibility
- Minimal footprint - maximizes map space

**State Management:**
- Uses `NavigationContext` for global state
- Persists navigation state to AsyncStorage
- Auto-starts when route is provided via navigation params
- Passes distance and time to NavigationMapView for stats display

**Screen Configuration:**
- `headerShown: false` in AppNavigator - removes "Navigate" title
- Map component receives all necessary data as props
- Orchestrates start/stop/pause logic
- Handles permission requests and errors

## Key Files

### Native Android Module
- **`BishvilNavigationModule.kt`**: Core GPS navigation logic
  - FusedLocationProvider integration (Layer 1)
  - Accelerometer motion detection (Layer 2)
  - Adaptive commit logic (Layer 3)
  - Event emission to React Native

### React Native Components
- **`navigationService.ts`**: JavaScript wrapper around native module
- **`NavigationContext.tsx`**: Global navigation state management
- **`NavigationMapView.tsx`**: Two-mode map component with MapPickerModal pattern
- **`NavigationScreen.tsx`**: Main navigation orchestration screen
- **`routeMetrics.ts`**: Route progress and metrics utilities

### routeMetrics.ts Functions

**Types:**
```typescript
type RouteBbox = { minLng, minLat, maxLng, maxLat };
type RouteMetrics = {
  totalDistanceM, totalAscentM,
  cumDistances[], cumAscents[],
  bbox: RouteBbox,        // Bounding box for distance gating
  startPoint: [lng, lat]  // First coordinate for distance-to-start
};
```

**Functions:**
- `computeRouteMetrics(route, elevations)` - Precomputes cumulative distances, ascents, bbox, startPoint
- `findRouteProgress(position, route, cumDistances)` - Finds nearest point and progress in meters
- `computeRemainingMetrics(metrics, progressM, speedMs)` - Remaining distance, ascent, ETA
- `formatRemainingMetrics(metrics)` - Formats as "X.X km • +XXX m • ~XX min"
- `isNearRouteArea(position, bbox)` - Checks if within bbox + 2km margin (distance gating)
- `computeDistanceToStart(position, startPoint)` - Haversine distance to start
- `formatDistanceToStart(distanceM)` - Formats as "Route loaded • X.X km to start"

### Integration Points
- **`AppNavigator.tsx`**: 5th navigation tab
- **`RideDetailsScreen.tsx`**: "Navigate Route" button
- **`MainActivity.kt`**: GPX file intent handler

## Battery Optimization Summary

**Expected Power Profile:**
- GPS (adaptive): ~120-180 mAh/hour (saves ~28% vs always HIGH_ACCURACY)
- Accelerometer: ~3-5 mAh/hour
- Native processing: ~2-5 mAh/hour
- Map rendering (event-driven): ~15-25 mAh/hour
- **Total: ~140-215 mAh/hour**

**Optimization Techniques:**
1. ✅ Motion gating reduces GPS reads when stationary
2. ✅ Event-driven rendering (not 60fps loop)
3. ✅ Native commit logic reduces JS bridge crossings
4. ✅ Adaptive GPS priority (HIGH_ACCURACY ↔ BALANCED_POWER)
5. ✅ Dynamic intervals (1s → 2s → 3s based on speed/motion)
6. ✅ Velocity-based adaptive sampling (linear formulas)

## Troubleshooting

### Map Zoom Issues

**Problem:** Map starts very zoomed out (world view) then jumps to user location.

**Root Causes:**
1. Rendering map before having location data
2. Setting both `centerCoordinate` and `followUserLocation` simultaneously

**Solution (MapPickerModal Pattern):**
1. State starts as null: `mapCenter` and `mapZoom = null`
2. useEffect gets location BEFORE rendering map
3. Conditional render: `{mapCenter && mapZoom !== null ? (<MapView>...)}`
4. Camera uses conditional `centerCoordinate`:
   - Initial render: `centerCoordinate={mapCenter}` (while no GPS position)
   - After GPS lock: `centerCoordinate={undefined}` (let followUserLocation take over)
5. Use `followUserLocation` with `followPadding` for automatic tracking
6. Use `followUserMode` to enable heading-up rotation

### Auto-Recenter Not Working

**Problem:** Map doesn't recenter after user interaction.

**Causes:**
1. `isUserInteracting` state stuck as `true`
2. Timeout not clearing properly
3. `followUserLocation` still `false` after timeout

**Solution:**
- Clear timeout on component unmount
- Set 5-second timeout on every touch interaction
- Reset `isUserInteracting` to `false` after timeout
- Ensure `followUserLocation` becomes `true` when `!isUserInteracting`

### Speed Display Issues

**Problem:** Shows false speed (e.g., 8.6 km/h) when phone is stationary.

**Cause:** Indoor GPS drift - poor accuracy causes position errors interpreted as movement.

**Solution:** Filter out low speeds and poor accuracy:
```typescript
speedKmh = (speed >= 0.5 m/s && accuracy <= 20m) ? realSpeed : 0
```

### North-Up Mode Not Facing North

**Problem:** Switching to North-Up mode doesn't rotate map back to north; it freezes at last heading.

**Cause:** The `heading` prop alone doesn't force a rotation when `followUserLocation` is active.

**Solution:** Explicitly call `setCamera` when mode changes:
```typescript
useEffect(() => {
  if (mode === 'north-up' && cameraRef.current && mapReady) {
    cameraRef.current.setCamera({
      heading: 0,
      pitch: 0,
      animationDuration: 300,
    });
  }
}, [mode, mapReady]);
```

### Recenter Button Resets Zoom

**Problem:** Pressing recenter resets zoom to default level 16 instead of preserving user's zoom.

**Cause:** Camera defaults to initial `mapZoom` state (16) when recentering.

**Solution:** Track current zoom level and use it when recentering:
```typescript
const currentZoomRef = useRef<number>(16);

const handleRegionDidChange = (feature: GeoJSON.Feature) => {
  if (feature.properties?.zoomLevel) {
    currentZoomRef.current = feature.properties.zoomLevel;
  }
};

const handleRecenter = () => {
  cameraRef.current.setCamera({
    centerCoordinate: currentPosition.coordinate,
    zoomLevel: currentZoomRef.current,  // Preserve zoom
    animationDuration: 300,
  });
};
```

### Route from Ride Details Doesn't Show Preview

**Problem:** Pressing "Navigate Route" from ride details stays at user location instead of fitting to route.

**Cause:** Timing issue - `shouldFollow` is `true` on first render, camera follows user before `fitBounds` effect runs.

**Solution:** Initialize `isUserInteracting` and `isRoutePreviewMode` to `true` when route exists:
```typescript
const [isUserInteracting, setIsUserInteracting] = useState(!!route);
const [isRoutePreviewMode, setIsRoutePreviewMode] = useState(!!route);
```
This ensures `shouldFollow = false` on first render, allowing `fitBounds` to work.

## Future Enhancements

**Potential Improvements:**
- [ ] Turn-by-turn voice guidance
- [ ] Automatic rerouting
- [ ] Offline map caching
- [ ] Background navigation (foreground service)
- [ ] Breadcrumb export to GPX
- [ ] Route deviation alerts
- [ ] iOS implementation
- [ ] Per-activity parameter tuning (walking vs cycling)

## Testing Checklist

### Unit Testing
- [ ] Native commit logic (dr/dθ/dt thresholds)
- [ ] Distance calculation (Haversine formula)
- [ ] Heading calculation and smoothing
- [ ] Motion state detection (accelerometer variance)

### Integration Testing
- [ ] Native → JS event emission
- [ ] Permission request flow
- [ ] Map mode switching
- [ ] Route rendering with live position

### Field Testing
- [ ] Solo navigation (no route)
- [ ] Ride navigation (with GPX)
- [ ] GPX file intent
- [ ] Battery profiling (2+ hour session)
- [ ] GPS accuracy (open field, tree cover, urban canyon)
- [ ] Motion gating (stationary vs moving transitions)

### Success Criteria
- ✅ Battery drain < 200 mAh/hour
- ✅ Map updates feel "live" (no lag perception)
- ✅ GPS accuracy typically < 20m
- ✅ No crashes during 2+ hour sessions
- ✅ No zoom-out flash on map initialization
- ✅ User positioned at bottom 1/3 for optimal forward view
- ✅ Auto-recenter works after 5 seconds of inactivity
- ✅ Mode toggle icons are intuitive and minimal
- ✅ Stats bar avoids Android status bar overlap

---

## UI/UX Design Decisions

### Immersive Full-Screen Experience
- **No header bar** - map uses full screen from top to bottom
- **Transparent overlays** - all controls float on map with minimal footprint
- **Icon-only buttons** - reduces visual clutter, maximizes map space
- **Auto-hiding elements** - stats only show when GPS has position

### Positioning Strategy
- **Stats at top** - positioned at `top: 48` to avoid Android status bar (time, battery, notifications)
- **Mode toggle at top-right** - traditional compass location, transparent background
- **Controls at bottom-right** - out of map view, easily thumb-accessible
- **User at bottom 1/3** - more forward view, ideal for navigation

### Color Coding
- **Red** - North-Up mode (cardinal direction focus)
- **Orange** - Heading-Up mode, pause/resume (primary actions)
- **Red (error)** - Stop button (destructive action)
- **Dark translucent** - Stats overlay (readable without blocking map)

### Interaction Patterns
- **Tap mode toggle** - instant switch between North-Up and Heading-Up
- **Manual map pan** - automatically detected, disables auto-tracking
- **5-second auto-recenter** - restores tracking after inactivity
- **No mode during interaction** - full manual control when panning/rotating

### Icon Choices
- **Compass** (North-Up) - universally recognized symbol for cardinal directions
- **Ship wheel** (Heading-Up) - nautical metaphor for steering/heading
- **Pause/Play/Stop** - standard media controls, familiar to all users

### Typography
- **Compact stats** - 13px values, 9px labels (uppercase)
- **High contrast** - white text on dark background
- **Single-line display** - all metrics visible at a glance
- **Dividers** - visual separation between stats

---

**Last Updated:** 2025-01-31
**Version:** 1.2.0

---

## Session Summary (v1.2.0)

Features implemented in this session:

1. **Tab Press Reset** - Pressing Navigation tab resets to free navigation mode
2. **Consistent Metrics Display** - Always shows all three metrics (distance, elevation, ETA) or none
3. **GPX Loading from Navigation Tab** - Document picker to load GPX files directly (ephemeral)
4. **Route Preview Mode** - Camera fits to route bounds on load, no auto-follow
5. **Recenter Button** - Blue crosshairs, shows when not following, explicit recenter
6. **Distance Gating** - Far from route shows "X km to start", near route shows full metrics
7. **Recenter Preserves Zoom** - Tracks and preserves user's chosen zoom level
8. **North-Up Resets Heading** - Explicitly resets camera heading to 0° when switching modes
9. **Route from Ride Details Preview** - Initializes in preview mode to show route bounds
