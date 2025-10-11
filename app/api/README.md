# Weather API Documentation

This application fetches weather forecast data from multiple providers for Copenhagen, Denmark.

## API Structure

### Endpoints

#### `/api/weather` (Default)

Currently routes to DMI by default for backward compatibility with the frontend.

#### `/api/dmi`

Fetches weather data from Danish Meteorological Institute (DMI).

**Requirements:**

- Requires `DMI_API_KEY` environment variable
- Uses the HARMONIE DINI surface forecast model
- Returns 7-day hourly forecast

**Response Format:** GeoJSON FeatureCollection

#### `/api/yr`

Fetches weather data from Yr (MET Norway's Locationforecast API).

**Requirements:**

- No API key required
- Must provide a valid, identifying User-Agent header (handled automatically)
- Returns 9-day forecast data
- Implements proper caching per Yr's best practices

**Response Format:** GeoJSON Feature with timeseries

**Caching Strategy:**

- Respects `Expires` and `Last-Modified` headers from Yr
- Uses `If-Modified-Since` for conditional requests (304 responses)
- Returns cached data if API is unavailable
- Custom cache headers: `X-Cache` (HIT/MISS/STALE/REVALIDATED), `X-Cache-Expires`

**Status Code Handling:**

- `200 OK`: Fresh data received and cached
- `203 Deprecated`: Warning logged, data still usable
- `304 Not Modified`: Cached data extended
- `429 Too Many Requests`: Throttling detected, returns error
- `5xx`: Returns stale cached data if available

## Data Processing

### DMI Data (`/app/utils/processData.ts`)

The `processHourlyForecasts` function converts DMI's raw API response into a normalized `HourlyForecast` format:

- Converts temperature from Kelvin to Celsius
- Converts cloud cover from fraction (0-1) to percentage (0-100)
- Extracts all weather parameters into a flat structure

### Yr Data (`/app/utils/processYrData.ts`)

The `processYrForecasts` function converts Yr's timeseries API response into the same normalized `HourlyForecast` format:

- Temperature already in Celsius (no conversion needed)
- Cloud cover already in percentage (0-100)
- Uses `next_1_hours` precipitation data, falls back to `next_6_hours`
- Provides symbol code mapping to emojis

**Additional functions:**

- `getYrSymbolCode`: Extracts the weather symbol code (e.g., "partlycloudy_day")
- `getWeatherEmojiFromYrSymbol`: Maps Yr symbols to emojis

## Environment Variables

```bash
DMI_API_KEY=your_dmi_api_key_here
```

## Caching

### DMI

Uses Next.js built-in caching with 1-hour revalidation (`next: { revalidate: 3600 }`).

### Yr

Implements [Yr's recommended caching strategy](https://developer.yr.no/doc/locationforecast/HowTO/):

- Manual cache management respecting `Expires` and `Last-Modified` headers
- Conditional requests using `If-Modified-Since` to minimize data transfer
- Falls back to stale data if API is unavailable
- In-memory cache (upgrade to Redis/similar for production)

## Adding New Providers

To add a new weather provider:

1. Create a new folder under `/app/api/{provider-name}/`
2. Add `types.ts` with the provider's API response types
3. Add `route.ts` with the API fetching logic
4. Optionally update `/app/api/types.ts` to re-export common types
5. Create a processing function in `/app/utils/` if needed

## Notes

- All APIs are cached server-side
- Copenhagen coordinates: 55.715°N, 12.561°E (limited to 4 decimals for Yr)
- DMI uses custom authentication header: `X-Gravitee-Api-Key`
- Yr requires a proper User-Agent header (enforced by their API - generic headers will get 403)
- Yr implementation follows [official best practices](https://developer.yr.no/doc/locationforecast/HowTO/)
- Both APIs use HTTPS exclusively

## Production Considerations

For production deployment:

1. **Yr Cache**: Replace in-memory cache with Redis or similar persistent storage
2. **User-Agent**: Update the User-Agent string in `/app/api/yr/route.ts` with your actual contact info
3. **Error Monitoring**: Add proper error tracking (Sentry, etc.) for API failures
4. **Rate Limiting**: Implement rate limiting on your endpoints to prevent abuse
5. **Multiple Locations**: Extend to support multiple location coordinates
