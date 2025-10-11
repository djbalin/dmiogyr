# Weather Provider Comparison

This document compares the two weather forecast providers used in this application.

## Quick Comparison

| Feature              | DMI (Danish Met Institute)      | Yr (MET Norway)                    |
| -------------------- | ------------------------------- | ---------------------------------- |
| **Coverage**         | 7 days                          | 9 days                             |
| **Update Frequency** | Hourly                          | Hourly                             |
| **Authentication**   | API Key (X-Gravitee-Api-Key)    | User-Agent (identifying)           |
| **Cost**             | Free with API key               | Free                               |
| **Data Format**      | GeoJSON FeatureCollection       | GeoJSON Feature w/ timeseries      |
| **Temperature Unit** | Kelvin (needs conversion)       | Celsius                            |
| **Cloud Cover**      | Fraction 0-1 (needs conversion) | Percentage 0-100                   |
| **Precipitation**    | Per hour                        | Per next 1/6/12 hours              |
| **Regional Focus**   | Nordic region                   | Global                             |
| **Model**            | HARMONIE DINI SF                | Multiple models                    |
| **Caching**          | Next.js standard                | Manual (Expires/If-Modified-Since) |

## Data Structure Differences

### DMI Response Structure

```typescript
{
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        step: "2025-10-11T12:00:00Z",
        "temperature-2m": 288.15,      // Kelvin
        "total-precipitation": 0.5,     // mm
        "wind-speed-10m": 5.2,         // m/s
        "fraction-of-cloud-cover": 0.75, // 0-1 fraction
        // ... more parameters
      }
    }
  ]
}
```

### Yr Response Structure

```typescript
{
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat, altitude] },
  properties: {
    timeseries: [
      {
        time: "2025-10-11T12:00:00Z",
        data: {
          instant: {
            details: {
              air_temperature: 15.0,      // Celsius
              cloud_area_fraction: 75,    // 0-100 percentage
              wind_speed: 5.2,           // m/s
              // ... more parameters
            }
          },
          next_1_hours: {
            summary: { symbol_code: "partlycloudy_day" },
            details: { precipitation_amount: 0.5 }
          }
        }
      }
    ]
  }
}
```

## Weather Symbols

### DMI

Does not provide standardized weather symbol codes. We derive symbols from cloud cover and precipitation data using the `getWeatherEmoji` function.

### Yr

Provides comprehensive symbol codes like:

- `clearsky_day` / `clearsky_night`
- `partlycloudy_day` / `partlycloudy_night`
- `rain`
- `heavyrain`
- `snow`
- `fog`
- etc.

These can be mapped to Yr's official icon set from [weathericons](https://github.com/metno/weathericons).

## Best Practices Implementation

### DMI

- Simple API key authentication
- Standard HTTP caching
- Straightforward request/response

### Yr (Following Official Guidelines)

Per [Yr's developer documentation](https://developer.yr.no/doc/locationforecast/HowTO/):

1. **Identifying User-Agent**: Required, unique identifier
2. **Caching Headers**: Respect `Expires` and `Last-Modified`
3. **Conditional Requests**: Use `If-Modified-Since` for 304 responses
4. **Graceful Degradation**: Return cached data on errors
5. **Status Code Handling**: Special handling for 203, 304, 429
6. **HTTPS Only**: Always use secure connections
7. **Coordinate Precision**: Max 4 decimal places

## When to Use Which Provider

### Use DMI when:

- You need data specifically for the Nordic region
- You prefer simpler implementation
- You have a DMI API key
- 7-day forecast is sufficient

### Use Yr when:

- You need global coverage
- You want longer forecasts (9 days)
- You prefer no API key requirement
- You want official weather symbols
- You need battle-tested caching strategy

## Processing Functions

Both APIs are normalized to the same `HourlyForecast` interface:

- **DMI**: `processHourlyForecasts()` in `app/utils/processData.ts`
- **Yr**: `processYrForecasts()` in `app/utils/processYrData.ts`

This allows the frontend to use either provider interchangeably.

## API Endpoints

- `/api/dmi` - Direct DMI access
- `/api/yr` - Direct Yr access
- `/api/weather` - Default (currently DMI)

## Future Enhancements

1. **Provider Selection**: Let users choose their preferred provider
2. **Comparison View**: Show both forecasts side-by-side
3. **Fallback Chain**: Use Yr if DMI fails (or vice versa)
4. **Data Aggregation**: Combine forecasts for more accurate predictions
5. **Multiple Locations**: Extend beyond Copenhagen
