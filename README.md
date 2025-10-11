# Copenhagen Weather Comparison

A Next.js weather application that compares hourly forecasts from two meteorological services side by side:

- **DMI** (Danish Meteorological Institute) - HARMONIE DINI model
- **Yr** (MET Norway) - Global forecast coverage

## Features

✨ **Dual Provider Comparison**: View forecasts from both DMI and Yr simultaneously  
🔄 **Independent Loading**: Each provider loads independently with separate loading indicators  
🛡️ **Graceful Error Handling**: If one provider fails, the other still displays  
📊 **Collapsible Days**: Expand any day to see hourly forecasts  
🎨 **Color-Coded Providers**: Emerald for DMI, Sky blue for Yr  
📱 **Responsive Design**: Works on desktop and mobile

## Screenshots

The app displays:

- Side-by-side comparison (desktop) or stacked (mobile)
- Provider-specific loading states
- Individual error handling per provider
- Detailed hourly forecasts when expanded
- Weather emojis, temperatures, precipitation, wind, clouds, and humidity

## Getting Started

### Prerequisites

- Node.js 18+ (or use a compatible package manager)
- DMI API Key (get from [DMI's API portal](https://confluence.govcloud.dk/display/FDAPI))

### Installation

```bash
# Install dependencies
pnpm install

# Create environment file
echo 'DMI_API_KEY=your_api_key_here' > .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env.local` file:

```bash
DMI_API_KEY=your_dmi_api_key_here
```

**Note**: Yr doesn't require an API key, but uses a User-Agent header (configured automatically).

## API Structure

### Endpoints

- `/api/dmi` - DMI weather data (7-day forecast)
- `/api/yr` - Yr weather data (9-day forecast)
- `/api/weather` - Default endpoint (currently DMI, for backward compatibility)

### Data Processing

Both providers are normalized to the same `HourlyForecast` interface:

```typescript
interface HourlyForecast {
  timestamp: string;
  hour: string;
  dayName: string;
  temperature: number; // Celsius
  precipitation: number; // mm
  windSpeed: number; // m/s
  windDirection: number; // degrees
  cloudCover: number; // percentage
  humidity: number; // percentage
  pressure: number; // hPa
  gustSpeed: number; // m/s
  visibility: number; // meters
}
```

## Project Structure

```
app/
├── api/
│   ├── dmi/              # DMI provider
│   │   ├── route.ts      # API endpoint
│   │   └── types.ts      # TypeScript types
│   ├── yr/               # Yr provider
│   │   ├── route.ts      # API endpoint (with caching logic)
│   │   └── types.ts      # TypeScript types
│   ├── weather/          # Default route
│   │   └── route.ts
│   ├── types.ts          # Shared types
│   └── README.md         # API documentation
├── utils/
│   ├── processData.ts    # DMI data processor
│   └── processYrData.ts  # Yr data processor
├── page.tsx              # Main UI component
├── layout.tsx            # App layout
└── globals.css           # Global styles
```

## Technologies

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Linting**: Biome
- **Fonts**: Geist Sans & Geist Mono

## API Providers

### DMI (Danish Meteorological Institute)

- **Model**: HARMONIE DINI SF
- **Coverage**: 7 days, hourly
- **Focus**: Nordic region
- **Auth**: API Key
- **Docs**: [DMI API Documentation](https://opendatadocs.dmi.govcloud.dk/)

### Yr (MET Norway)

- **Model**: Multiple (ECMWF, MEPS, etc.)
- **Coverage**: 9 days, hourly
- **Focus**: Global
- **Auth**: User-Agent (identifying header)
- **Docs**: [Yr Developer Portal](https://developer.yr.no/)
- **Implementation**: Follows [official best practices](https://developer.yr.no/doc/locationforecast/HowTO/)

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Format code
pnpm format
```

## Caching

- **DMI**: Uses Next.js built-in caching (1-hour revalidation)
- **Yr**: Implements manual caching with `Expires` and `If-Modified-Since` headers per Yr's guidelines
  - Respects 304 Not Modified responses
  - Falls back to stale data on errors
  - Handles throttling (429 responses)

## Production Considerations

1. **Yr Cache**: Replace in-memory cache with Redis for multi-instance deployments
2. **User-Agent**: Update the User-Agent string in `/app/api/yr/route.ts` with your contact info
3. **Error Monitoring**: Add error tracking (Sentry, etc.)
4. **Rate Limiting**: Implement rate limiting on your endpoints
5. **Multiple Locations**: Extend beyond Copenhagen

## Documentation

- [API Documentation](app/api/README.md) - Detailed API docs
- [Provider Comparison](WEATHER_PROVIDERS.md) - DMI vs Yr comparison

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Credits

- Weather data from [DMI](https://www.dmi.dk/) and [MET Norway (Yr)](https://www.yr.no/)
- Built with [Next.js](https://nextjs.org/)
