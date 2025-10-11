# UI Structure

This document describes the new dual-provider comparison interface.

## Layout Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Copenhagen Weather Comparison                              │
│  Compare forecasts from DMI and Yr                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│  DMI (Danish Met)            │  Yr (MET Norway)             │
│  7-day forecast              │  9-day forecast              │
├──────────────────────────────┼──────────────────────────────┤
│                              │                              │
│  [Loading...]                │  [Loading...]                │
│       OR                     │       OR                     │
│  [Error State]               │  [Error State]               │
│       OR                     │       OR                     │
│  [Weather Cards]             │  [Weather Cards]             │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Data from DMI and MET Norway (Yr)                          │
│  Forecasts updated hourly • Copenhagen 55.715°N, 12.561°E  │
└─────────────────────────────────────────────────────────────┘
```

## Provider Section States

### 1. Loading State

```
┌────────────────────────────┐
│ 🔄 Loading DMI...          │
└────────────────────────────┘
```

### 2. Error State

```
┌────────────────────────────┐
│ ⚠️ DMI Unavailable         │
│ DMI API error: 500         │
└────────────────────────────┘
```

### 3. Success State

```
┌────────────────────────────┐
│ DMI (Danish Met)           │
│ 7-day forecast • HARMONIE  │
├────────────────────────────┤
│ 168 hourly forecasts       │
│                            │
│ ┌────────────────────┐    │
│ │ I dag              │    │
│ │ 11. okt            │    │
│ │ 🌤️ 15° / 12°      │    │
│ │ 0.2mm  6m/s  89%  │    │
│ │ [TIME FOR TIME]    │    │
│ └────────────────────┘    │
│                            │
│ ┌────────────────────┐    │
│ │ Friday             │    │
│ │ 12. okt            │    │
│ │ ☁️ 14° / 11°      │    │
│ │ 0.1mm  3m/s  80%  │    │
│ │ [TIME FOR TIME]    │    │
│ └────────────────────┘    │
└────────────────────────────┘
```

### 4. Expanded Day View

```
┌────────────────────────────┐
│ I dag                      │
│ 11. okt                    │
│ 🌤️ 15° / 12°             │
│ 0.2mm  6m/s  89%         │
│ [LUK] ▲                   │
├────────────────────────────┤
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐     │
│ │00│ │01│ │02│ │03│ ... │
│ │🌙│ │🌙│ │☁️│ │☁️│     │
│ │12°│ │11°│ │11°│ │10°│     │
│ └──┘ └──┘ └──┘ └──┘     │
└────────────────────────────┘
```

## Color Scheme

### DMI Provider

- Header: `bg-emerald-500` (green)
- Badge: `bg-emerald-100 text-emerald-700`
- Accent: Emerald tones

### Yr Provider

- Header: `bg-sky-500` (blue)
- Badge: `bg-sky-100 text-sky-700`
- Accent: Sky blue tones

### Shared Elements

- Background: `bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600`
- Cards: `bg-white`
- Text: Gray scale for readability

## Responsive Behavior

### Desktop (XL and up)

```
┌─────────────┬─────────────┐
│    DMI      │     Yr      │
│             │             │
│   [Cards]   │   [Cards]   │
└─────────────┴─────────────┘
```

### Mobile/Tablet (Below XL)

```
┌─────────────┐
│    DMI      │
│   [Cards]   │
└─────────────┘
┌─────────────┐
│     Yr      │
│   [Cards]   │
└─────────────┘
```

## Component Hierarchy

```
Home
├── PageHeader
├── Grid (2 columns on XL, 1 column on mobile)
│   ├── ProviderSection (DMI)
│   │   ├── Provider Header
│   │   ├── Loading State (conditional)
│   │   ├── Error State (conditional)
│   │   └── Weather Data (conditional)
│   │       ├── Badge (forecast count)
│   │       └── WeatherDaysList
│   │           └── WeatherDayCard (multiple)
│   │               ├── CollapsedView
│   │               │   ├── Day Info
│   │               │   ├── Weather Icon
│   │               │   ├── Temperature
│   │               │   ├── WeatherMetrics
│   │               │   └── ExpandButton
│   │               └── ExpandedView (conditional)
│   │                   └── HourlyWeatherCard (multiple)
│   │                       ├── Hour + Icon
│   │                       ├── Temperature
│   │                       └── WeatherMetricRow (multiple)
│   │
│   └── ProviderSection (Yr)
│       └── [Same structure as DMI]
│
└── PageFooter
```

## User Interactions

1. **Page Load**: Both providers fetch simultaneously
2. **Independent Loading**: Each shows its own loading spinner
3. **Error Resilience**: One provider failing doesn't affect the other
4. **Expand Day**: Click anywhere on day card or the expand button
5. **Collapse Day**: Click the "LUK" button when expanded
6. **Independent Expansion**: DMI and Yr days expand independently

## Data Flow

```
User Opens Page
       ↓
   useEffect
       ↓
   ┌───┴────┐
   ↓        ↓
fetchDMI  fetchYr
   ↓        ↓
   ↓        ↓
setDmiWeather  setYrWeather
   ↓        ↓
   └───┬────┘
       ↓
   Render Components
       ↓
   ┌───┴────┐
   ↓        ↓
ProviderSection(DMI)  ProviderSection(Yr)
```

## Key Features

✅ **Parallel Fetching**: Both APIs called simultaneously  
✅ **Independent State**: Separate loading/error/data for each  
✅ **Graceful Degradation**: App works even if one provider fails  
✅ **Separate Expansion**: Each provider's days expand independently  
✅ **Visual Distinction**: Color-coded headers for easy identification  
✅ **Responsive Design**: Adapts to screen size  
✅ **Consistent Interface**: Both providers use same card layouts
