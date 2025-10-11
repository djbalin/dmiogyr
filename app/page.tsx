"use client";

import { useEffect, useState } from "react";
import {
  HourlyForecast,
  processHourlyForecasts,
  getWeatherEmoji,
} from "./utils/processData";
import { processYrForecasts } from "./utils/processYrData";
import { type DMIAPIResponse } from "@/app/api/dmi/types";
import { type YrAPIResponse } from "@/app/api/yr/types";

async function fetchDMI() {
  try {
    const response = await fetch("/api/dmi");
    if (!response.ok) {
      throw new Error(`DMI API error: ${response.status}`);
    }
    const data: DMIAPIResponse = await response.json();
    return processHourlyForecasts(data);
  } catch (err) {
    console.error("DMI fetch error:", err);
    return err instanceof Error ? err.message : "Unknown error";
  }
}

async function fetchYr() {
  try {
    const response = await fetch("/api/yr");
    if (!response.ok) {
      throw new Error(`Yr API error: ${response.status}`);
    }
    const data: YrAPIResponse = await response.json();
    return processYrForecasts(data);
  } catch (err) {
    console.error("Yr fetch error:", err);
    return err instanceof Error ? err.message : "Unknown error";
  }
}

type WeatherState = {
  data: HourlyForecast[] | null;
  loading: boolean;
  error: string | null;
};

export default function Home() {
  const [dmiWeather, setDmiWeather] = useState<WeatherState>({
    data: null,
    loading: true,
    error: null,
  });
  const [yrWeather, setYrWeather] = useState<WeatherState>({
    data: null,
    loading: true,
    error: null,
  });
  const [dmiExpandedDays, setDmiExpandedDays] = useState<Set<string>>(
    new Set(),
  );
  const [yrExpandedDays, setYrExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function initWeather() {
      // Fetch DMI
      fetchDMI().then((result) => {
        if (typeof result === "string") {
          setDmiWeather({ data: null, loading: false, error: result });
        } else {
          setDmiWeather({ data: result, loading: false, error: null });
        }
      });

      // Fetch Yr
      fetchYr().then((result) => {
        if (typeof result === "string") {
          setYrWeather({ data: null, loading: false, error: result });
        } else {
          setYrWeather({ data: result, loading: false, error: null });
        }
      });
    }

    void initWeather();
  }, []);

  const bothLoading = dmiWeather.loading && yrWeather.loading;
  const bothError = dmiWeather.error && yrWeather.error;
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  if (bothLoading) {
    return <LoadingState />;
  }

  if (bothError) {
    return (
      <ErrorState error="Both weather services are unavailable. Please try again later." />
    );
  }

  // Combine data from both providers by date
  const combinedData = combineProviderData(dmiWeather.data, yrWeather.data);

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader />

        {/* Provider status indicators */}
        <ProviderStatusBar dmiWeather={dmiWeather} yrWeather={yrWeather} />

        {/* Combined weather display */}
        <UnifiedWeatherDaysList
          combinedData={combinedData}
          expandedDays={expandedDays}
          onToggleDay={toggleDay}
        />

        <PageFooter />
      </div>
    </div>
  );
}

// Helper function to combine data from both providers
function combineProviderData(
  dmiData: HourlyForecast[] | null,
  yrData: HourlyForecast[] | null,
): Map<string, { date: string; dmi: HourlyForecast[]; yr: HourlyForecast[] }> {
  const combined = new Map<
    string,
    { date: string; dmi: HourlyForecast[]; yr: HourlyForecast[] }
  >();

  // Add DMI data
  if (dmiData) {
    dmiData.forEach((forecast) => {
      const date = forecast.timestamp.split("T")[0];
      if (!combined.has(date)) {
        combined.set(date, { date, dmi: [], yr: [] });
      }
      combined.get(date)!.dmi.push(forecast);
    });
  }

  // Add Yr data
  if (yrData) {
    yrData.forEach((forecast) => {
      const date = forecast.timestamp.split("T")[0];
      if (!combined.has(date)) {
        combined.set(date, { date, dmi: [], yr: [] });
      }
      combined.get(date)!.yr.push(forecast);
    });
  }

  return combined;
}

// Components

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
      <div className="text-white text-xl">Loading weather data...</div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-400 to-red-600">
      <div className="bg-white rounded-lg p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
        <p className="text-gray-700">{error}</p>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="text-white mb-8">
      <h1 className="text-4xl sm:text-5xl font-bold mb-2">DMI og Yr</h1>
      <p className="text-blue-100 text-lg">Vejrudsigt fra både DMI og Yr</p>
    </header>
  );
}

function ProviderStatusBar({
  dmiWeather,
  yrWeather,
}: {
  dmiWeather: WeatherState;
  yrWeather: WeatherState;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      {/* DMI Status */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg px-4 py-2 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-teal-500" />
        <span className="text-sm font-medium text-gray-700">DMI</span>
        {dmiWeather.loading && (
          <span className="text-xs text-gray-500">Loading...</span>
        )}
        {dmiWeather.error && (
          <span className="text-xs text-red-600">Error</span>
        )}
        {dmiWeather.data && (
          <span className="text-xs text-teal-600 font-semibold">
            {dmiWeather.data.length} forecasts
          </span>
        )}
      </div>

      {/* Yr Status */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg px-4 py-2 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-sm font-medium text-gray-700">Yr</span>
        {yrWeather.loading && (
          <span className="text-xs text-gray-500">Loading...</span>
        )}
        {yrWeather.error && <span className="text-xs text-red-600">Error</span>}
        {yrWeather.data && (
          <span className="text-xs text-indigo-600 font-semibold">
            {yrWeather.data.length} forecasts
          </span>
        )}
      </div>
    </div>
  );
}

interface UnifiedWeatherDaysListProps {
  combinedData: Map<
    string,
    { date: string; dmi: HourlyForecast[]; yr: HourlyForecast[] }
  >;
  expandedDays: Set<string>;
  onToggleDay: (date: string) => void;
}

function UnifiedWeatherDaysList({
  combinedData,
  expandedDays,
  onToggleDay,
}: UnifiedWeatherDaysListProps) {
  return (
    <div className="space-y-4">
      {Array.from(combinedData.entries()).map(([date, data], dayIndex) => (
        <UnifiedWeatherDayCard
          key={date}
          date={date}
          dmiHours={data.dmi}
          yrHours={data.yr}
          dayIndex={dayIndex}
          isExpanded={expandedDays.has(date)}
          onToggle={() => onToggleDay(date)}
        />
      ))}
    </div>
  );
}

interface UnifiedWeatherDayCardProps {
  date: string;
  dmiHours: HourlyForecast[];
  yrHours: HourlyForecast[];
  dayIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function UnifiedWeatherDayCard({
  date,
  dmiHours,
  yrHours,
  dayIndex,
  isExpanded,
  onToggle,
}: UnifiedWeatherDayCardProps) {
  // Get 2PM data or midday data for both providers
  const dmi2PM =
    dmiHours.find((h) => h.hour === "14:00") ||
    dmiHours[Math.floor(dmiHours.length / 2)];
  const yr2PM =
    yrHours.find((h) => h.hour === "14:00") ||
    yrHours[Math.floor(yrHours.length / 2)];

  // Calculate aggregates for the day
  const dmiTemps = dmiHours.map((h) => h.temperature);
  const yrTemps = yrHours.map((h) => h.temperature);

  const dmiMaxTemp = dmiTemps.length > 0 ? Math.max(...dmiTemps) : null;
  const dmiMinTemp = dmiTemps.length > 0 ? Math.min(...dmiTemps) : null;
  const yrMaxTemp = yrTemps.length > 0 ? Math.max(...yrTemps) : null;
  const yrMinTemp = yrTemps.length > 0 ? Math.min(...yrTemps) : null;

  const dmiTotalPrecip = dmiHours.reduce((sum, h) => sum + h.precipitation, 0);
  const yrTotalPrecip = yrHours.reduce((sum, h) => sum + h.precipitation, 0);

  // Use first available data for day name
  const dayName = (dmiHours[0] || yrHours[0])?.dayName || "";

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Collapsed view */}
      <div
        onClick={onToggle}
        className="cursor-pointer hover:bg-gray-50 transition-colors"
      >
        {/* Column Headers */}
        <div className="grid grid-cols-[140px_60px_120px_100px_100px_100px_auto] gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
          <div>Dag</div>
          <div className="text-center">Vær</div>
          <div className="text-center">Temp.</div>
          <div className="text-center">Nedbør</div>
          <div className="text-center">Vind</div>
          <div className="text-center">Luftfugtighed</div>
          <div></div>
        </div>

        {/* Data Row */}
        <div className="grid grid-cols-[140px_60px_120px_100px_100px_100px_auto] gap-4 px-4 py-3 items-center">
          {/* Day name */}
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {dayIndex === 0 ? "I dag" : dayName.split(",")[0]}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(date).toLocaleDateString("da-DK", {
                day: "numeric",
                month: "short",
              })}
            </p>
          </div>

          {/* Weather icon */}
          <div className="text-center text-3xl">
            {dmi2PM && getWeatherEmoji(dmi2PM.cloudCover, dmi2PM.precipitation)}
          </div>

          {/* Temperature */}
          <div className="flex flex-col gap-0.5 text-center">
            {dmiMaxTemp !== null && dmiMinTemp !== null && (
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-teal-700">
                  {Math.round(dmiMaxTemp)}°
                </span>
                <span className="text-sm text-teal-600">
                  /{Math.round(dmiMinTemp)}°
                </span>
              </div>
            )}
            {yrMaxTemp !== null && yrMinTemp !== null && (
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-indigo-700">
                  {Math.round(yrMaxTemp)}°
                </span>
                <span className="text-sm text-indigo-600">
                  /{Math.round(yrMinTemp)}°
                </span>
              </div>
            )}
          </div>

          {/* Precipitation */}
          <div className="text-center">
            {dmiHours.length > 0 && (
              <p className="text-sm font-semibold text-teal-700">
                {dmiTotalPrecip.toFixed(1)} mm
              </p>
            )}
            {yrHours.length > 0 && (
              <p className="text-sm font-semibold text-indigo-700">
                {yrTotalPrecip.toFixed(1)} mm
              </p>
            )}
          </div>

          {/* Wind */}
          <div className="text-center">
            {dmi2PM && (
              <p className="text-sm font-semibold text-teal-700">
                {Math.round(dmi2PM.windSpeed)} m/s
              </p>
            )}
            {yr2PM && (
              <p className="text-sm font-semibold text-indigo-700">
                {Math.round(yr2PM.windSpeed)} m/s
              </p>
            )}
          </div>

          {/* Humidity */}
          <div className="text-center">
            {dmi2PM && (
              <p className="text-sm font-semibold text-teal-700">
                {Math.round(dmi2PM.humidity)}%
              </p>
            )}
            {yr2PM && (
              <p className="text-sm font-semibold text-indigo-700">
                {Math.round(yr2PM.humidity)}%
              </p>
            )}
          </div>

          {/* Expand button */}
          <div className="flex justify-end">
            <ExpandButton
              isExpanded={isExpanded}
              onToggle={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            />
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <UnifiedExpandedView dmiHours={dmiHours} yrHours={yrHours} />
      )}
    </div>
  );
}

function UnifiedExpandedView({
  dmiHours,
  yrHours,
}: {
  dmiHours: HourlyForecast[];
  yrHours: HourlyForecast[];
}) {
  // Combine hours by timestamp
  const hourMap = new Map<
    string,
    { dmi?: HourlyForecast; yr?: HourlyForecast }
  >();

  dmiHours.forEach((hour) => {
    const key = hour.hour;
    if (!hourMap.has(key)) hourMap.set(key, {});
    hourMap.get(key)!.dmi = hour;
  });

  yrHours.forEach((hour) => {
    const key = hour.hour;
    if (!hourMap.has(key)) hourMap.set(key, {});
    hourMap.get(key)!.yr = hour;
  });

  const sortedHours = Array.from(hourMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Table header */}
      <div className="grid grid-cols-[80px_60px_100px_100px_100px_100px_100px] gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600">
        <div>Tid</div>
        <div className="text-center">Vær</div>
        <div className="text-center">Temp.</div>
        <div className="text-center">Nedbør mm</div>
        <div className="text-center">Vind m/s</div>
        <div className="text-center">Skydække</div>
        <div className="text-center">Luftfukt.</div>
      </div>

      {/* Table rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {sortedHours.map(([hour, data]) => (
          <UnifiedHourlyRow
            key={hour}
            hour={hour}
            dmi={data.dmi}
            yr={data.yr}
          />
        ))}
      </div>
    </div>
  );
}

function UnifiedHourlyRow({
  hour,
  dmi,
  yr,
}: {
  hour: string;
  dmi?: HourlyForecast;
  yr?: HourlyForecast;
}) {
  return (
    <div className="grid grid-cols-[80px_60px_100px_100px_100px_100px_100px] gap-2 px-4 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm items-center">
      {/* Time */}
      <div className="font-medium text-gray-700">{hour}</div>

      {/* Weather icon */}
      <div className="text-center text-2xl">
        {dmi && getWeatherEmoji(dmi.cloudCover, dmi.precipitation)}
      </div>

      {/* Temperature */}
      <div className="text-center">
        {dmi && (
          <div className="font-semibold text-teal-700">
            {Math.round(dmi.temperature)}°
          </div>
        )}
        {yr && (
          <div className="font-semibold text-indigo-700">
            {Math.round(yr.temperature)}°
          </div>
        )}
      </div>

      {/* Precipitation */}
      <div className="text-center">
        {dmi && (
          <div className="text-teal-700">{dmi.precipitation.toFixed(1)}</div>
        )}
        {yr && (
          <div className="text-indigo-700">{yr.precipitation.toFixed(1)}</div>
        )}
      </div>

      {/* Wind */}
      <div className="text-center">
        {dmi && (
          <div className="text-teal-700">{Math.round(dmi.windSpeed)}</div>
        )}
        {yr && (
          <div className="text-indigo-700">{Math.round(yr.windSpeed)}</div>
        )}
      </div>

      {/* Cloud cover */}
      <div className="text-center">
        {dmi && (
          <div className="text-teal-700">{Math.round(dmi.cloudCover)}%</div>
        )}
        {yr && (
          <div className="text-indigo-700">{Math.round(yr.cloudCover)}%</div>
        )}
      </div>

      {/* Humidity */}
      <div className="text-center">
        {dmi && (
          <div className="text-teal-700">{Math.round(dmi.humidity)}%</div>
        )}
        {yr && (
          <div className="text-indigo-700">{Math.round(yr.humidity)}%</div>
        )}
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <footer className="mt-8 text-center text-blue-100 text-sm space-y-2">
      <p>Data from Danish Meteorological Institute (DMI) and MET Norway (Yr)</p>
      <p className="text-blue-200/80 text-xs">
        Forecasts are updated hourly • Copenhagen coordinates: 55.715°N,
        12.561°E
      </p>
    </footer>
  );
}

function ExpandButton({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className="text-blue-600 hover:text-blue-700 font-medium text-sm uppercase tracking-wide flex items-center gap-2"
      onClick={onToggle}
    >
      {isExpanded ? "LUK" : "TIME FOR TIME"}
      <svg
        className={`w-5 h-5 transform transition-transform ${
          isExpanded ? "rotate-180" : ""
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}
