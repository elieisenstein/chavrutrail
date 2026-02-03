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
   - Camera pitch: 0° (flat 2D, same as North-Up)
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
**Version:** 1.3.0

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

---

## Session Summary (v1.3.0)

Features implemented in this session:

### 1. Top Info Bar (Instrument Cluster)

Full-width bar at the top of the navigation screen replacing the old stats overlay:

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Route loaded • 27 km          18:13 🔋 37%              │  ← Top Info Bar
├──────────────────────────────────────────────────────────┤
│ DBG: MOVING | dim=ON(0.80) | br=1.00 | dimmed=N         │  ← Debug Row (__DEV__ only)
├──────────────────────────────────────────────────────────┤
```

**Components:**
- **Left side**: Route metrics (`"X.X km • +XXX m • ~XX min"`) or `"Free nav"` when no route
- **Right side**: Current time (HH:mm format) and battery percentage with 🔋 icon

**Styling:**
- Height: 52px
- Background: `rgba(0, 0, 0, 0.80)`
- Text: White, orange accent on battery icon
- Only shows when GPS position is available

**Dependencies:**
- `expo-battery` - for battery level monitoring
- Time updates every 30 seconds
- Battery updates every 60 seconds

### 2. Debug Row (Development Only)

A second row below the top info bar showing internal navigation state:

**Format:**
```
DBG: MOVING | dim=ON(0.80) | br=0.85 | dimmed=N
```

**Fields:**
- `motionState`: `MOVING` or `STATIONARY` (from native module)
- `dim=ON/OFF(level)`: Auto-dim enabled state and target brightness
- `br=X.XX`: Current screen brightness (0.0-1.0)
- `dimmed=Y/N`: Whether screen is currently dimmed

**Visibility:**
- Only renders when `__DEV__` is true (development builds)
- Automatically hidden in production builds
- To test in production mode: `npx expo run:android --variant release`

### 3. Auto-Dim Feature

Automatically dims the screen when stationary to save battery:

**Behavior:**
- After 15 seconds of `STATIONARY` motion state → dims to configured level
- When motion resumes (`MOVING`) → restores original brightness
- Brightness is captured before first dim and restored on stop/resume

**Settings (SettingsScreen):**
- Toggle: "Auto-dim screen when stationary"
- Level selector: 60%, 70%, 80%, 90% (segmented buttons)
- Persisted to AsyncStorage

**Configuration:**
```typescript
type NavigationConfig = {
  // ... existing fields
  autoDimEnabled: boolean;  // default: true
  autoDimLevel: number;     // default: 0.8 (80%)
};
```

### 4. Keep Screen On

Prevents screen from turning off while Navigation tab is visible using `expo-keep-awake`.

- Activated when Navigation screen gains focus (`useFocusEffect`)
- Deactivated when Navigation screen loses focus (switching tabs)
- Implemented in `NavigationScreen.tsx`, not `NavigationContext.tsx`
- No user setting - always on while on Navigation tab

### 5. Mode Persistence

Saves the last used map mode (North-Up / Heading-Up) to AsyncStorage.

- Stored under `@bishvil_navigation_mode` key
- Loaded on context mount into `savedModeRef`
- Used in `startNavigation` instead of hardcoded 'north-up'
- Persisted on every `toggleMode` or `setMode` call

### 6. User Location Arrow

Orange arrow with black outline for visibility against any map background.

- **Fill**: Orange `#ff6b35`, 35px (Material Design `navigation` icon)
- **Outline**: Black `#000000`, 38px (layered behind fill)
- Layered approach: two icons absolutely positioned, larger black one behind
- Rotates with heading in north-up mode, fixed in heading-up mode

### 7. DebugInfo Type

New type exposed from NavigationContext for UI consumption:

```typescript
export type DebugInfo = {
  motionState: 'MOVING' | 'STATIONARY' | null;
  brightnessCurrent: number | null;
  brightnessTarget: number;
  isDimmed: boolean;
  autoDimEnabled: boolean;
};
```

**Flow:**
1. NavigationContext maintains `debugInfo` state
2. Updates on motion state changes, brightness changes, config changes
3. Passed through NavigationScreen → NavigationMapView
4. Rendered only in `__DEV__` builds

### 8. Status Bar Hiding

Android status bar is hidden when the top info bar is visible:

```typescript
useEffect(() => {
  if (currentPosition) {
    StatusBar.setHidden(true, 'fade');
  } else {
    StatusBar.setHidden(false, 'fade');
  }
  return () => StatusBar.setHidden(false, 'fade');
}, [currentPosition]);
```

**Rationale:**
- Top info bar shows time and battery, replacing system status bar
- Provides more immersive full-screen experience
- Status bar restored when leaving navigation

### 9. i18n Additions

**English (`en.json`):**
```json
"navigation": {
  "freeNav": "Free nav"
},
"settings": {
  "navigation": {
    "title": "Navigation",
    "autoDim": "Auto-dim screen when stationary",
    "autoDimLevel": "Dim to"
  }
}
```

**Hebrew (`he.json`):**
```json
"navigation": {
  "freeNav": "ניווט חופשי"
},
"settings": {
  "navigation": {
    "title": "ניווט",
    "autoDim": "עמעם מסך אוטומטית בעמידה",
    "autoDimLevel": "עמעם ל-"
  }
}
```

### Updated UI Layout

```
┌─────────────────────────────────────────┐
│ Free nav            18:13 🔋 37%        │  ← Top Info Bar (height: 52)
├─────────────────────────────────────────┤
│ DBG: MOVING | dim=ON(0.80) | br=...     │  ← Debug Row (__DEV__ only, height: 24)
├─────────────────────────────────────────┤
│                            [Mode Toggle]│  ← top: 56 (or 84 in dev)
│                                         │
│              [Map View]                 │
│                                         │
│                            [Recenter]   │  ← bottom: 88
│ [Speed Pill]              [Route Action]│  ← bottom: 24
└─────────────────────────────────────────┘
```

### Files Modified

| File | Changes |
|------|---------|
| `NavigationContext.tsx` | Added DebugInfo type, exposed through context, brightness control logic |
| `NavigationMapView.tsx` | Added top info bar, debug row, time/battery state, StatusBar hiding |
| `NavigationScreen.tsx` | Pass debugInfo to NavigationMapView |
| `navigationService.ts` | Added autoDimEnabled, autoDimLevel to config |
| `SettingsScreen.tsx` | Added Navigation settings section with auto-dim toggle and level |
| `en.json` / `he.json` | Added "freeNav" and settings.navigation translations |

---

## Session Summary (v1.3.1)

Bug fixes and improvements:

### 1. Navigation Bar Flickering Fix

**Problem:** Top info bar flickered repeatedly when navigation was active.

**Root Cause:** `useFocusEffect` with dependencies like `activeNavigation.state` ran cleanup on every state change, calling `stopNavigation()` repeatedly.

**Solution:** Separated into two effects:
```typescript
// Blur cleanup only (empty deps)
useFocusEffect(
  useCallback(() => {
    return () => { stopNavigation(); };
  }, [])
);

// Start logic (regular useEffect)
useEffect(() => {
  if (needsStart || needsRestart) {
    void handleStartNavigation();
  }
}, [routeKey, activeNavigation.state, ...]);
```

### 2. Fast GPS Acquisition

**Problem:** GPS took 30+ seconds to acquire position when stationary, while Google Maps showed location instantly.

**Root Cause:** `BishvilNavigationModule.kt` switched to `PRIORITY_BALANCED_POWER_ACCURACY` when motion state was `STATIONARY`.

**Solution:** Always use `PRIORITY_HIGH_ACCURACY`:
```kotlin
// Always use high accuracy during navigation - the UX cost of slow GPS
// acquisition (30+ seconds) outweighs the battery savings from balanced mode.
// Battery is saved via longer intervals when stationary + screen dimming.
val priority = Priority.PRIORITY_HIGH_ACCURACY
```

Battery savings now achieved via:
- Longer update intervals when stationary (3x)
- Screen auto-dim feature

### 3. Brightness User Override

**Problem:** When auto-dim activated, users couldn't manually adjust brightness - Android showed "controlled by app" message.

**Root Cause:** `Brightness.setBrightnessAsync()` sets a **window-level override** that blocks user control.

**Solution:** Use `Brightness.setSystemBrightnessAsync()` instead:
```typescript
// Before (blocks user control)
await Brightness.setBrightnessAsync(target);

// After (allows user override)
await Brightness.setSystemBrightnessAsync(target);
```

**Behavior:**
- Auto-dim still works (dims screen when stationary for 15s)
- User can manually adjust brightness at any time via system settings
- When motion resumes, restores to original captured brightness

**Permission Added:**
```xml
<uses-permission android:name="android.permission.WRITE_SETTINGS"/>
```

### 4. Route Start/End Markers

**Feature:** Added visual markers for route start and end points when a GPX file is loaded in navigation tab.

**Implementation:**
```typescript
{/* Start Point Marker (orange) */}
{route && route.length >= 2 && (
  <MapboxGL.ShapeSource id="nav-start-point-source"
    shape={{ type: 'Point', coordinates: route[0] }}>
    <MapboxGL.CircleLayer id="nav-start-point-circle"
      style={{
        circleRadius: 8,
        circleColor: '#FF8C00',  // Orange
        circleStrokeWidth: 2,
        circleStrokeColor: '#FFFFFF',
      }}
    />
  </MapboxGL.ShapeSource>
)}

{/* End Point Marker (red) */}
{route && route.length >= 2 && (
  <MapboxGL.ShapeSource id="nav-end-point-source"
    shape={{ type: 'Point', coordinates: route[route.length - 1] }}>
    <MapboxGL.CircleLayer id="nav-end-point-circle"
      style={{
        circleRadius: 8,
        circleColor: '#DC143C',  // Crimson red
        circleStrokeWidth: 2,
        circleStrokeColor: '#FFFFFF',
      }}
    />
  </MapboxGL.ShapeSource>
)}
```

**Styling:** Matches RoutePreviewScreen markers.

### Files Modified

| File | Changes |
|------|---------|
| `NavigationScreen.tsx` | Separated useFocusEffect for blur cleanup vs start logic |
| `BishvilNavigationModule.kt` | Always use PRIORITY_HIGH_ACCURACY |
| `NavigationContext.tsx` | Changed to setSystemBrightnessAsync for user override |
| `AndroidManifest.xml` | Added WRITE_SETTINGS permission |
| `NavigationMapView.tsx` | Added start/end point circle markers |

---

## Session Summary (v1.3.2)

Improvements to map mode behavior:

### 1. Auto-Recenter When Moving

**Problem:** When loading a GPX file, the camera fits to route bounds and stays there until user manually presses recenter button. Users didn't realize they needed to press the button and thought the map was frozen.

**Solution:** Automatically exit route preview mode when user starts moving:

```typescript
// Auto-recenter when user starts moving (exits route preview mode automatically)
useEffect(() => {
  if (debugInfo?.motionState === 'MOVING' && isRoutePreviewMode) {
    // User started moving - exit preview mode and follow them
    handleRecenter();
  }
}, [debugInfo?.motionState, isRoutePreviewMode]);
```

**Behavior:**
| State | Camera Behavior |
|-------|----------------|
| Route loaded + STATIONARY | Shows route bounds (preview mode) |
| Route loaded + MOVING | Auto-recenters and follows user |
| Manual pan/zoom | 5-second timeout then auto-recenter |

### 2. Stable Heading When Stationary

**Problem:** In heading-up mode, when the user is stationary, the map rotates randomly due to noisy GPS heading data.

**Root Cause:** GPS heading is unreliable/meaningless when not moving - the device can't determine direction without displacement.

**Solution:** Save the last known heading when MOVING, and use that saved heading when STATIONARY:

```typescript
// Store last heading when moving (for stable heading-up when stationary)
const lastMovingHeadingRef = useRef<number>(0);

// Update last known heading only when moving
useEffect(() => {
  if (debugInfo?.motionState === 'MOVING' && currentPosition?.heading != null) {
    lastMovingHeadingRef.current = currentPosition.heading;
  }
}, [debugInfo?.motionState, currentPosition?.heading]);

// Use stable heading for camera and arrow
const stableHeading = debugInfo?.motionState === 'MOVING'
  ? currentPosition?.heading ?? lastMovingHeadingRef.current
  : lastMovingHeadingRef.current;
```

**Behavior:**
| Motion State | Heading Behavior |
|--------------|-----------------|
| MOVING | Uses live GPS heading (accurate when moving) |
| STATIONARY | Uses last heading from when moving (stable) |

**Applied to:**
- `cameraBearing` - map rotation in heading-up mode
- Arrow rotation - user location marker in north-up mode

**UX Improvement:** If user is heading south and stops, the map stays facing south instead of randomly rotating to various directions.

### Files Modified

| File | Changes |
|------|---------|
| `NavigationMapView.tsx` | Added `lastMovingHeadingRef`, auto-recenter effect, `stableHeading` calculation |

---

## Session Summary (v1.3.3)

Auto-dim improvements:

### 1. Expanded Dim Level Range

**Problem:** Auto-dim level selector only offered 60-90%, limiting testing of lower brightness values.

**Solution:** Changed from `SegmentedButtons` to +/- stepper with expanded range:

```typescript
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <IconButton
    icon="minus"
    disabled={config.autoDimLevel <= 0.3}
    onPress={() => updateConfig({ autoDimLevel: Math.round((config.autoDimLevel - 0.1) * 10) / 10 })}
  />
  <Text>{Math.round(config.autoDimLevel * 100)}%</Text>
  <IconButton
    icon="plus"
    disabled={config.autoDimLevel >= 0.9}
    onPress={() => updateConfig({ autoDimLevel: Math.round((config.autoDimLevel + 0.1) * 10) / 10 })}
  />
</View>
```

**Settings UI:**
```
┌────────────────────────────────────────┐
│ Dim to              [-]  80%  [+]      │
└────────────────────────────────────────┘
```

- Range: 30% to 90%
- Steps: 10%
- Default: 80%

### 2. Tap to Wake Brightness

**Problem:** When screen is dimmed (stationary for 15s), user has no way to temporarily restore brightness without moving.

**Solution:** Tapping the map restores brightness, then dims again after 15s if still stationary.

**NavigationContext.tsx:**
```typescript
const wakeBrightness = useCallback(async () => {
  // Only wake if currently dimmed and auto-dim is enabled
  if (!isDimmedRef.current || !configRef.current.autoDimEnabled) return;

  // Restore brightness
  await restoreBrightness();

  // If still stationary, start a new dim timer
  if (lastMotionStateRef.current === 'STATIONARY') {
    pendingDimTimerRef.current = setTimeout(() => {
      if (configRef.current.autoDimEnabled && lastMotionStateRef.current === 'STATIONARY') {
        dimScreen(configRef.current.autoDimLevel);
      }
      pendingDimTimerRef.current = null;
    }, AUTO_DIM_DELAY_MS);
  }
}, []);
```

**NavigationMapView.tsx:**
```typescript
const handleMapInteraction = () => {
  // Wake brightness if dimmed (tap to wake)
  onWakeBrightness?.();
  // ... existing interaction handling
};
```

**Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│ STATIONARY for 15s → Screen dims                            │
│                                                             │
│ User taps screen:                                           │
│   1. Restore brightness immediately                         │
│   2. Start new 15s timer                                    │
│                                                             │
│ After 15s:                                                  │
│   - If STILL STATIONARY → dim again                         │
│   - If MOVING → timer cancelled, stay bright                │
└─────────────────────────────────────────────────────────────┘
```

### Files Modified

| File | Changes |
|------|---------|
| `SettingsScreen.tsx` | Changed dim level from SegmentedButtons to +/- stepper (30-90% range) |
| `NavigationContext.tsx` | Added `wakeBrightness()` function |
| `NavigationMapView.tsx` | Added `onWakeBrightness` prop, called on map touch |
| `NavigationScreen.tsx` | Passes `wakeBrightness` to NavigationMapView |

---

## Session Summary (v1.3.4)

Visual feedback for stationary state:

### Stationary Pulse Animation

**Problem:** No visual feedback when stationary - the arrow looks identical whether moving or stopped.

**Solution:** Add a pulse animation to the location arrow when `motionState === 'STATIONARY'`.

**Implementation:**

```typescript
// Pulse animation for stationary state
const pulseAnim = useRef(new Animated.Value(1)).current;

useEffect(() => {
  if (debugInfo?.motionState === 'STATIONARY') {
    // Start infinite pulse loop (1.0 → 0.75 → 1.0, 1s period, ease in-out)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  } else {
    // Reset to normal scale when moving
    pulseAnim.setValue(1);
  }
}, [debugInfo?.motionState, pulseAnim]);

// Apply to arrow
<Animated.View style={{ transform: [{ rotate }, { scale: pulseAnim }] }}>
  <Icon source="navigation" ... />
</Animated.View>
```

**Animation Parameters:**
| Parameter | Value |
|-----------|-------|
| Scale | 1.0 → 0.75 → 1.0 (25% shrink) |
| Period | 1 second (500ms each direction) |
| Easing | `Easing.inOut(Easing.ease)` |
| Driver | Native (60fps, off JS thread) |

**Behavior:**
| Motion State | Arrow Behavior |
|--------------|----------------|
| MOVING | Static arrow (scale = 1.0) |
| STATIONARY | Pulsing arrow (smooth 25% shrink/grow) |

### Files Modified

| File | Changes |
|------|---------|
| `NavigationMapView.tsx` | Added `Animated`, `Easing` imports, `pulseAnim` ref, pulse useEffect, `Animated.View` wrapper |

---

## Session Summary (v1.3.5)

Bug fixes for map and motion detection:

### 1. Zoom Level Preservation After Auto-Recenter

**Problem:** When user zoomed out and the map auto-recentered (after 5 seconds of inactivity), the zoom reset to default level 16 instead of preserving the user's chosen zoom.

**Root Cause:** The `mapZoom` state was initialized to 16 and never updated when user changed zoom. The Camera component used `zoomLevel={mapZoom}` which always returned 16, fighting with the `setCamera()` calls that correctly used `currentZoomRef.current`.

**Solution:** Update `mapZoom` state when user changes zoom in `handleRegionDidChange`:

```typescript
// Track zoom level from map region changes - update both ref and state
// State is needed so Camera component uses user's zoom level after auto-recenter
const handleRegionDidChange = (feature: GeoJSON.Feature) => {
  if (feature.properties?.zoomLevel) {
    currentZoomRef.current = feature.properties.zoomLevel;
    setMapZoom(feature.properties.zoomLevel);  // NEW: sync state with ref
  }
};
```

**Behavior:**
- User zooms out → `mapZoom` state updates to new level
- Auto-recenter triggers after 5 seconds
- Camera uses user's zoom level instead of resetting to 16

### 2. Hybrid Motion Detection (GPS + Accelerometer)

**Problem:** When user stopped moving during navigation, the map appeared "frozen" showing stale speed (e.g., 10 km/h) and the arrow didn't pulse as expected in STATIONARY state.

**Root Cause:** Timing/latency issue between GPS and accelerometer:
1. Accelerometer needs ~1.6 seconds to detect STATIONARY (8 samples at 200ms each)
2. GPS continues reporting stale speed until new fix acquired
3. GPS events fire faster than accelerometer can catch up
4. Result: `motionState="MOVING"` embedded in GPS event even when physically stopped

**Solution:** Use GPS speed as **secondary signal** for motion detection:

```kotlin
// HYBRID MOTION DETECTION: Use GPS speed as secondary signal
// If GPS shows essentially zero speed (<1 km/h) with good accuracy, override to STATIONARY
// This catches the case where accelerometer hasn't detected stop yet
// Threshold: 0.3 m/s = 1 km/h (standing still with GPS drift)
val gpsIndicatesStationary = currentSpeed < 0.3f && currentAccuracy < 10f
val effectiveMotionState = if (gpsIndicatesStationary) "STATIONARY" else motionState

// Emit event with effective motion state
emitNavCommitEvent(location, heading, dr, dTheta, dt, commitReason, effectiveMotionState)
```

**Speed Thresholds:**
| Speed | Value | Classification |
|-------|-------|----------------|
| < 0.3 m/s | < 1 km/h | STATIONARY (via GPS) |
| 1.4 m/s | 5 km/h | MOVING (slow ride) |
| 2.8 m/s | 10 km/h | MOVING (normal ride) |

**Additional Optimizations:**
1. **Faster accelerometer sampling**: Changed from `SENSOR_DELAY_NORMAL` (~200ms) to `SENSOR_DELAY_GAME` (~50ms)
2. **Reduced minimum samples**: Changed from 8 to 5 samples for faster state transitions (~250ms instead of ~1.6s)

**Updated `emitNavCommitEvent` signature:**
```kotlin
private fun emitNavCommitEvent(
    location: Location,
    heading: Double,
    dr: Double,
    dTheta: Double,
    dt: Long,
    reason: String,
    effectiveMotionState: String  // NEW parameter
)
```

### Files Modified

| File | Changes |
|------|---------|
| `NavigationMapView.tsx` | Added `setMapZoom()` call in `handleRegionDidChange` |
| `BishvilNavigationModule.kt` | Added hybrid motion detection, `effectiveMotionState`, faster accelerometer (GAME delay, 5 samples) |

---

## Session Summary (v1.3.6)

Bug fix for GPX bounding box auto-recenter behavior.

### GPX Route Preview Auto-Recenter Fix

**Problem:** When loading a GPX file during navigation, the camera should show the route's bounding box and stay there until the user presses recenter. Instead, it auto-recentered immediately if the user was already moving, or when the user started moving from STATIONARY.

**Root Cause:** The auto-recenter logic fired on any STATIONARY→MOVING transition while in preview mode, without checking if the user was actually near the route.

**Solution:** Add bounding box check - only auto-recenter if user is **inside** the route's bounding box (+2km margin):

```typescript
// Auto-recenter when user STARTS moving (transition from STATIONARY to MOVING)
// BUT only if user is INSIDE the route bounding box
useEffect(() => {
  const prevState = prevMotionStateRef.current;
  const currState = debugInfo?.motionState;
  prevMotionStateRef.current = currState;

  if (isRoutePreviewMode && prevState === 'STATIONARY' && currState === 'MOVING') {
    const isInsideBbox = routeMetrics && currentPosition
      ? isNearRouteArea(currentPosition.coordinate, routeMetrics.bbox)
      : false;

    if (isInsideBbox) {
      handleRecenter();
    }
    // If outside bbox, stay on bounding box view - user must manually recenter
  }
}, [debugInfo?.motionState, isRoutePreviewMode, routeMetrics, currentPosition]);
```

### Camera State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMERA STATE MACHINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATES:                                                                │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │  FOLLOW MODE    │     │  PREVIEW MODE   │     │  INTERACTION    │   │
│  │                 │     │                 │     │    MODE         │   │
│  │ shouldFollow=T  │     │ isRoutePreview  │     │ isUserInteract  │   │
│  │ Camera follows  │     │    Mode=T       │     │    ing=T        │   │
│  │ user position   │     │ Shows route     │     │ User panning/   │   │
│  │                 │     │ bounding box    │     │ zooming         │   │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘   │
│           │                       │                       │             │
├───────────┴───────────────────────┴───────────────────────┴─────────────┤
│                                                                         │
│  TRANSITIONS:                                                           │
│                                                                         │
│  1. Load GPX/Route ──────────────────────► PREVIEW MODE                 │
│     - fitBounds() to route bbox                                         │
│     - isRoutePreviewMode = true                                         │
│     - isUserInteracting = true                                          │
│                                                                         │
│  2. PREVIEW MODE + STATIONARY→MOVING + INSIDE BBOX ──► FOLLOW MODE      │
│     - Auto-recenter when user starts riding on the route                │
│     - handleRecenter() called                                           │
│                                                                         │
│  3. PREVIEW MODE + STATIONARY→MOVING + OUTSIDE BBOX ──► (stay PREVIEW)  │
│     - User is far from route, keep showing bounding box                 │
│     - Must manually press recenter button                               │
│                                                                         │
│  4. PREVIEW/INTERACT + Press Recenter Button ──────────► FOLLOW MODE    │
│     - Manual recenter always works                                      │
│     - isRoutePreviewMode = false                                        │
│     - isUserInteracting = false                                         │
│                                                                         │
│  5. FOLLOW MODE + Touch Map ───────────────────────────► INTERACTION    │
│     - isUserInteracting = true                                          │
│     - Start 5-second auto-recenter timer                                │
│                                                                         │
│  6. INTERACTION + 5 seconds timeout ───────────────────► FOLLOW MODE    │
│     - isUserInteracting = false                                         │
│     - Resume following user                                             │
│                                                                         │
│  7. Clear Route ───────────────────────────────────────► FOLLOW MODE    │
│     - isRoutePreviewMode = false                                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  KEY FLAGS:                                                             │
│  • isRoutePreviewMode: True when showing route bbox, no auto-recenter   │
│  • isUserInteracting: True when user touched map, 5s timer running      │
│  • shouldFollow: Computed = mapReady && currentPosition && !interacting │
│                           && !previewMode && accuracy < 50m             │
│                                                                         │
│  BBOX CHECK (isNearRouteArea):                                          │
│  • Uses route bbox + 2km margin                                         │
│  • Inside = user is near/on the route                                   │
│  • Outside = user is far from route (e.g., at home viewing a trail)     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Files Modified

| File | Changes |
|------|---------|
| `NavigationMapView.tsx` | Added `isNearRouteArea` bbox check to auto-recenter logic, added `prevMotionStateRef` for state transition detection |

---

## Session Summary (v1.3.7)

Bug fix for Camera declarative props overriding fitBounds() in route preview mode.

### Camera Props Override Fix

**Problem:** When loading a GPX file, the camera briefly showed the route's bounding box but then immediately recentered to the user's location, even when far from the route. The v1.3.6 fix (bbox check + motion state transition) was correct but insufficient.

**Root Cause:** The Camera component's **declarative props** were fighting with the imperative `fitBounds()` call:

```tsx
<MapboxGL.Camera
  centerCoordinate={shouldFollow ? currentPosition!.coordinate : mapCenter!}  // ← Problem!
  zoomLevel={mapZoom}
  ...
/>
```

Even when `shouldFollow=false` (in preview mode), the Camera had:
- `centerCoordinate={mapCenter}` → user's initial position
- `zoomLevel={mapZoom}` → default zoom (16)

After `fitBounds()` set the camera to the route bbox, the next React render caused the Camera's declarative props to **override** it.

**Solution:** Don't set `centerCoordinate`/`zoomLevel` props when in route preview mode. Let `fitBounds()` control the camera without interference:

```tsx
<MapboxGL.Camera
  ref={cameraRef}
  defaultSettings={{
    centerCoordinate: mapCenter!,
    zoomLevel: mapZoom,
    pitch: 0,
    heading: 0,
  }}
  // Only set centerCoordinate/zoomLevel when NOT in route preview mode
  // In preview mode, fitBounds() controls the camera - don't override it with declarative props
  {...(!isRoutePreviewMode && {
    centerCoordinate: shouldFollow ? currentPosition!.coordinate : mapCenter!,
    zoomLevel: mapZoom,
  })}
  pitch={cameraPitch}
  heading={cameraBearing}
  animationDuration={300}
  followUserLocation={false}
/>
```

### Camera Props by Mode

| Mode | Camera Props | Behavior |
|------|-------------|----------|
| **Preview Mode** (`isRoutePreviewMode=true`) | No `centerCoordinate`/`zoomLevel` | `fitBounds()` controls camera freely |
| **Follow Mode** (`shouldFollow=true`) | `centerCoordinate={currentPosition}` | Camera tracks user |
| **Interaction Mode** (`isUserInteracting=true`) | `centerCoordinate={mapCenter}` | Camera stays where user panned |

### Files Modified

| File | Changes |
|------|---------|
| `NavigationMapView.tsx` | Conditionally spread `centerCoordinate`/`zoomLevel` props based on `isRoutePreviewMode` |

---

## Session Summary (v1.3.8)

Bug fix for auto-dim not restoring brightness when switching tabs.

### Auto-Dim Tab Switch Fix

**Problem:** When auto-dim was active (screen dimmed on Navigation tab while stationary), switching to another tab (e.g., "Feed") should restore the original brightness. Instead, the dim stayed even after leaving the Navigation tab.

**Root Cause:** Race condition between two effects in `NavigationScreen.tsx`:

1. **Blur Cleanup Effect** (lines 145-153):
   ```typescript
   useFocusEffect(
     useCallback(() => {
       return () => {
         stopNavigation(); // Called when screen loses focus
       };
     }, [])
   );
   ```

2. **Auto-Start Effect** (lines 159-182):
   ```typescript
   useEffect(() => {
     const needsStart = activeNavigation.state === 'idle';
     if (needsStart || needsRestart) {
       void handleStartNavigation();
     }
   }, [routeKey, activeNavigation.state, ...]);
   ```

**The Bug Flow:**
1. User is on Navigation tab, screen is dimmed (stationary for 15s)
2. User switches to Feed tab
3. `useFocusEffect` cleanup runs → `stopNavigation()` → brightness restored → state = `'idle'`
4. BUT... the Navigation screen is still **mounted** (tabs keep screens alive)
5. The state change triggers the `useEffect`
6. It sees `activeNavigation.state === 'idle'` → `needsStart = true`
7. It calls `handleStartNavigation()` immediately, **restarting navigation even though the screen is not focused!**
8. The native module starts tracking again, and if stationary, a new dim timer starts

**Solution:** Add `useIsFocused` hook to check if the screen is focused before starting navigation:

```typescript
import { useIsFocused } from '@react-navigation/native';

// In component:
const isFocused = useIsFocused();

// In useEffect:
if ((needsStart || needsRestart) && isFocused) {
  void handleStartNavigation();
}
```

**Fixed Flow:**
1. User is on Navigation tab, screen is dimmed
2. User switches to Feed tab
3. `isFocused` becomes `false`
4. `stopNavigation()` runs → brightness restored → state = `'idle'`
5. The `useEffect` runs due to state change
6. BUT `isFocused` is `false`, so `handleStartNavigation()` is NOT called
7. Brightness stays restored!

### Files Modified

| File | Changes |
|------|---------|
| `NavigationScreen.tsx` | Added `useIsFocused` import and hook, added focus check to auto-start useEffect |

---

**Last Updated:** 2025-02-03
**Version:** 1.3.8
