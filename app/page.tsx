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
import { getSunTimes, isNightTime, formatTime } from "./utils/sunTimes";

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

type SunTimesMap = Map<string, { sunrise: Date; sunset: Date }>;

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
  const [sunTimesData, setSunTimesData] = useState<SunTimesMap>(new Map());
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

      // Fetch sun times for the next 7 days
      const sunTimesMap = new Map<string, { sunrise: Date; sunset: Date }>();
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];

        try {
          const sunTimes = await getSunTimes(date);
          sunTimesMap.set(dateStr, sunTimes);
        } catch (err) {
          console.error(`Error fetching sun times for ${dateStr}:`, err);
        }
      }
      setSunTimesData(sunTimesMap);
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

  // Combine data from both providers by date and limit to 7 days
  const combinedData = combineProviderData(dmiWeather.data, yrWeather.data);

  // Filter to only show first 7 days
  const limitedData = new Map(
    Array.from(combinedData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 7),
  );

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
    <div className="min-h-screen bg-gradient-to-b from-cyan-600 via-blue-500 to-blue-600 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto text-base">
        <PageHeader />

        {/* Provider status indicators */}
        <ProviderStatusBar dmiWeather={dmiWeather} yrWeather={yrWeather} />

        {/* Combined weather display */}
        <UnifiedWeatherDaysList
          combinedData={limitedData}
          expandedDays={expandedDays}
          onToggleDay={toggleDay}
          sunTimesData={sunTimesData}
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
      <p className="text-blue-100 text-lg">
        7-dages vejrudsigt fra både DMI og Yr
      </p>
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
  sunTimesData: SunTimesMap;
}

function UnifiedWeatherDaysList({
  combinedData,
  expandedDays,
  onToggleDay,
  sunTimesData,
}: UnifiedWeatherDaysListProps) {
  return (
    <div className="space-y-4">
      {Array.from(combinedData.entries()).map(([date, data], dayIndex) => {
        const sunTimes = sunTimesData.get(date);
        if (!sunTimes) return null; // Skip if sun times not loaded yet

        return (
          <UnifiedWeatherDayCard
            key={date}
            date={date}
            dmiHours={data.dmi}
            yrHours={data.yr}
            dayIndex={dayIndex}
            isExpanded={expandedDays.has(date)}
            onToggle={() => onToggleDay(date)}
            sunTimes={sunTimes}
          />
        );
      })}
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
  sunTimes: { sunrise: Date; sunset: Date };
}

const EN_DAYS_TO_DA = {
  Monday: "Mandag",
  Tuesday: "Tirsdag",
  Wednesday: "Onsdag",
  Thursday: "Torsdag",
  Friday: "Fredag",
  Saturday: "Lørdag",
  Sunday: "Søndag",
};

function UnifiedWeatherDayCard({
  date,
  dmiHours,
  yrHours,
  dayIndex,
  isExpanded,
  onToggle,
  sunTimes,
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

  // Calculate weather for different time periods separately for DMI and Yr
  const dayDate = new Date(date);

  const getWeatherForPeriod = (
    hours: HourlyForecast[],
    startHour: number,
    endHour: number,
  ) => {
    const periodHours = hours.filter((h) => {
      const hour = parseInt(h.hour.split(":")[0]);
      return hour >= startHour && hour < endHour;
    });

    if (periodHours.length === 0) return null;

    const avgCloudCover =
      periodHours.reduce((sum, h) => sum + h.cloudCover, 0) /
      periodHours.length;
    const avgPrecip =
      periodHours.reduce((sum, h) => sum + h.precipitation, 0) /
      periodHours.length;

    // Check if the middle of this period is nighttime
    const midHour = Math.floor((startHour + endHour) / 2);
    const testDate = new Date(dayDate);
    testDate.setHours(midHour, 0, 0, 0);
    const isNight = isNightTime(testDate, sunTimes);

    return getWeatherEmoji(avgCloudCover, avgPrecip, isNight);
  };

  // DMI weather periods
  const dmiNightWeather = getWeatherForPeriod(dmiHours, 0, 6); // 00-06
  const dmiMorningWeather = getWeatherForPeriod(dmiHours, 6, 12); // 06-12
  const dmiAfternoonWeather = getWeatherForPeriod(dmiHours, 12, 18); // 12-18
  const dmiEveningWeather = getWeatherForPeriod(dmiHours, 18, 24); // 18-24

  // Yr weather periods
  const yrNightWeather = getWeatherForPeriod(yrHours, 0, 6); // 00-06
  const yrMorningWeather = getWeatherForPeriod(yrHours, 6, 12); // 06-12
  const yrAfternoonWeather = getWeatherForPeriod(yrHours, 12, 18); // 12-18
  const yrEveningWeather = getWeatherForPeriod(yrHours, 18, 24); // 18-24

  // Calculate max wind speed for the day
  const dmiMaxWind =
    dmiHours.length > 0 ? Math.max(...dmiHours.map((h) => h.windSpeed)) : null;
  const yrMaxWind =
    yrHours.length > 0 ? Math.max(...yrHours.map((h) => h.windSpeed)) : null;

  const dataDay = (dmiHours[0] || yrHours[0]).dayName.split(",")[0];

  const dataDayname = (dataDay || "") as keyof typeof EN_DAYS_TO_DA;

  // Use first available data for day name
  const dayName = (EN_DAYS_TO_DA[dataDayname] || dataDayname).substring(0, 3);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div
        onClick={onToggle}
        className="cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <DesktopHeaders />
        <MobileHeaders />
        <DataRowDesktop />
        <DataRowMobile />
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <ExpandedView
          dmiHours={dmiHours}
          yrHours={yrHours}
          date={date}
          sunTimes={sunTimes}
        />
      )}
    </div>
  );

  function DataRowMobile() {
    return (
      <div className="lg:hidden grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 py-3 items-center">
        <div className="flex flex-col gap-1">
          {/* Temperature */}
          <div className="flex flex-col text-sm">
            {dmiMaxTemp !== null && dmiMinTemp !== null && (
              <div className="text-teal-700 font-semibold">
                {Math.round(dmiMaxTemp)}° / {Math.round(dmiMinTemp)}°
              </div>
            )}
            {yrMaxTemp !== null && yrMinTemp !== null && (
              <div className="text-indigo-700 font-semibold">
                {Math.round(yrMaxTemp)}° / {Math.round(yrMinTemp)}°
              </div>
            )}
          </div>

          {/* Wind */}
          <div className="flex flex-col text-xs text-gray-600">
            {dmiMaxWind !== null && (
              <div className="text-teal-700">{Math.round(dmiMaxWind)} m/s</div>
            )}
            {yrMaxWind !== null && (
              <div className="text-indigo-700">{Math.round(yrMaxWind)} m/s</div>
            )}
          </div>
        </div>

        {/* Night */}
        <div className="flex flex-col items-center gap-0.5 w-14">
          {dmiNightWeather && <div className="text-xl">{dmiNightWeather}</div>}
          {yrNightWeather && <div className="text-xl">{yrNightWeather}</div>}
          {!dmiNightWeather && !yrNightWeather && (
            <div className="text-xl">—</div>
          )}
        </div>
        {/* Morning */}
        <div className="flex flex-col items-center gap-0.5 w-14">
          {dmiMorningWeather && (
            <div className="text-xl">{dmiMorningWeather}</div>
          )}
          {yrMorningWeather && (
            <div className="text-xl">{yrMorningWeather}</div>
          )}
          {!dmiMorningWeather && !yrMorningWeather && (
            <div className="text-xl">—</div>
          )}
        </div>
        {/* Afternoon */}
        <div className="flex flex-col items-center gap-0.5 w-14">
          {dmiAfternoonWeather && (
            <div className="text-xl">{dmiAfternoonWeather}</div>
          )}
          {yrAfternoonWeather && (
            <div className="text-xl">{yrAfternoonWeather}</div>
          )}
          {!dmiAfternoonWeather && !yrAfternoonWeather && (
            <div className="text-xl">—</div>
          )}
        </div>
        {/* Evening */}
        <div className="flex flex-col items-center gap-0.5 w-14">
          {dmiEveningWeather && (
            <div className="text-xl">{dmiEveningWeather}</div>
          )}
          {yrEveningWeather && (
            <div className="text-xl">{yrEveningWeather}</div>
          )}
          {!dmiEveningWeather && !yrEveningWeather && (
            <div className="text-xl">—</div>
          )}
        </div>
      </div>
    );
  }

  function DataRowDesktop() {
    return (
      <div className="hidden lg:grid grid-cols-[160px_280px_140px_120px_120px_120px_auto] gap-4 px-4 py-4 items-center">
        {/* Day name */}
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {dayIndex === 0 ? "I dag" : dayName.substring(0, 3)}
          </h2>
          <p className="text-base text-gray-500">
            {new Date(date).toLocaleDateString("da-DK", {
              day: "numeric",
              month: "short",
            })}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            ☀️ {formatTime(sunTimes.sunrise)} 🌙 {formatTime(sunTimes.sunset)}
          </p>
        </div>

        {/* Weather icons for different times of day */}
        <div className="grid grid-cols-4 gap-1 text-center">
          {/* Night */}
          <div className="flex flex-col items-center gap-0.5">
            {dmiNightWeather && (
              <div className="text-3xl">{dmiNightWeather}</div>
            )}
            {yrNightWeather && <div className="text-3xl">{yrNightWeather}</div>}
            {!dmiNightWeather && !yrNightWeather && (
              <div className="text-3xl">—</div>
            )}
          </div>
          {/* Morning */}
          <div className="flex flex-col items-center gap-0.5">
            {dmiMorningWeather && (
              <div className="text-3xl">{dmiMorningWeather}</div>
            )}
            {yrMorningWeather && (
              <div className="text-3xl">{yrMorningWeather}</div>
            )}
            {!dmiMorningWeather && !yrMorningWeather && (
              <div className="text-3xl">—</div>
            )}
          </div>
          {/* Afternoon */}
          <div className="flex flex-col items-center gap-0.5">
            {dmiAfternoonWeather && (
              <div className="text-3xl">{dmiAfternoonWeather}</div>
            )}
            {yrAfternoonWeather && (
              <div className="text-3xl">{yrAfternoonWeather}</div>
            )}
            {!dmiAfternoonWeather && !yrAfternoonWeather && (
              <div className="text-3xl">—</div>
            )}
          </div>
          {/* Evening */}
          <div className="flex flex-col items-center gap-0.5">
            {dmiEveningWeather && (
              <div className="text-3xl">{dmiEveningWeather}</div>
            )}
            {yrEveningWeather && (
              <div className="text-3xl">{yrEveningWeather}</div>
            )}
            {!dmiEveningWeather && !yrEveningWeather && (
              <div className="text-3xl">—</div>
            )}
          </div>
        </div>

        {/* Temperature */}
        <div className="flex flex-col gap-0.5 text-center">
          {dmiMaxTemp !== null && dmiMinTemp !== null && (
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl font-bold text-teal-700">
                {Math.round(dmiMaxTemp)}°
              </span>
              <span className="text-base text-teal-600">
                /{Math.round(dmiMinTemp)}°
              </span>
            </div>
          )}
          {yrMaxTemp !== null && yrMinTemp !== null && (
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl font-bold text-indigo-700">
                {Math.round(yrMaxTemp)}°
              </span>
              <span className="text-base text-indigo-600">
                /{Math.round(yrMinTemp)}°
              </span>
            </div>
          )}
        </div>

        {/* Precipitation */}
        <div className="text-center">
          {dmiHours.length > 0 && (
            <p className="text-base font-semibold text-teal-700">
              {dmiTotalPrecip.toFixed(1)} mm
            </p>
          )}
          {yrHours.length > 0 && (
            <p className="text-base font-semibold text-indigo-700">
              {yrTotalPrecip.toFixed(1)} mm
            </p>
          )}
        </div>

        {/* Wind */}
        <div className="text-center">
          {dmi2PM && (
            <p className="text-base font-semibold text-teal-700">
              {Math.round(dmi2PM.windSpeed)} m/s
            </p>
          )}
          {yr2PM && (
            <p className="text-base font-semibold text-indigo-700">
              {Math.round(yr2PM.windSpeed)} m/s
            </p>
          )}
        </div>

        {/* Humidity */}
        <div className="text-center">
          {dmi2PM && (
            <p className="text-base font-semibold text-teal-700">
              {Math.round(dmi2PM.humidity)}%
            </p>
          )}
          {yr2PM && (
            <p className="text-base font-semibold text-indigo-700">
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
    );
  }

  function MobileHeaders() {
    return (
      <div className="lg:hidden border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-3 py-2 text-xs font-semibold text-gray-600">
          <div className="text-left font-semibold w-24">
            {dayIndex === 0 ? "I dag" : dayName.split(",")[0]}{" "}
            {new Date(date).toLocaleDateString("da-DK", {
              day: "numeric",
              month: "short",
            })}
            <div className="text-[10px] text-gray-400 font-normal mt-0.5">
              ☀️ {formatTime(sunTimes.sunrise)} 🌙 {formatTime(sunTimes.sunset)}
            </div>
          </div>
          <div className="text-center w-14">Nat</div>
          <div className="text-center w-14">Dag</div>
          <div className="text-center w-14">Efterm.</div>
          <div className="text-center w-14">Aften</div>
        </div>
      </div>
    );
  }

  function DesktopHeaders() {
    return (
      <div className="hidden lg:grid grid-cols-[160px_280px_140px_120px_120px_120px_auto] gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600">
        <div>Dag</div>
        <div className="grid grid-cols-4 gap-1 text-center">
          <div>Nat</div>
          <div>Morgen</div>
          <div>Eftermiddag</div>
          <div>Aften</div>
        </div>
        <div className="text-center">Temp.</div>
        <div className="text-center">Nedbør</div>
        <div className="text-center">Vind</div>
        <div className="text-center">Luftfugtighed</div>
        <div></div>
      </div>
    );
  }
}

function ExpandedView({
  dmiHours,
  yrHours,
  date,
  sunTimes,
}: {
  dmiHours: HourlyForecast[];
  yrHours: HourlyForecast[];
  date: string;
  sunTimes: { sunrise: Date; sunset: Date };
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
      {/* Table header - Desktop */}
      <TableHeaderDesktop />

      {/* Table header - Mobile */}
      <TableHeaderMobile />

      {/* Table rows */}
      <div className="max-h-[500px] overflow-y-auto">
        {sortedHours.map(([hour, data]) => (
          <UnifiedHourlyRow
            key={hour}
            hour={hour}
            dmi={data.dmi}
            yr={data.yr}
            date={date}
            sunTimes={sunTimes}
          />
        ))}
      </div>
    </div>
  );

  function TableHeaderDesktop() {
    return (
      <div className="hidden lg:grid grid-cols-[100px_100px_140px_120px_120px_120px_120px] gap-4 px-4 py-3 bg-gray-100 border-b border-gray-200 text-sm font-semibold text-gray-600">
        <div>Tid</div>
        <div className="text-center">Vejr</div>
        <div className="text-center">Temp.</div>
        <div className="text-center">Nedbør mm</div>
        <div className="text-center">Vind m/s</div>
        <div className="text-center">Skydække</div>
        <div className="text-center">Luftfugtighed</div>
      </div>
    );
  }

  function TableHeaderMobile() {
    return (
      <div className="lg:hidden grid grid-cols-[60px_50px_1fr_1fr] gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600">
        <div>Tid</div>
        <div className="text-center">Vejr</div>
        <div className="text-center">Temp.</div>
        <div className="text-center">Vind</div>
      </div>
    );
  }
}

function UnifiedHourlyRow({
  hour,
  dmi,
  yr,
  date,
  sunTimes,
}: {
  hour: string;
  dmi?: HourlyForecast;
  yr?: HourlyForecast;
  date: string;
  sunTimes: { sunrise: Date; sunset: Date };
}) {
  // Determine if this hour is during nighttime
  const hourNum = parseInt(hour.split(":")[0]);
  const testDate = new Date(date);
  testDate.setHours(hourNum, 0, 0, 0);
  const isNight = isNightTime(testDate, sunTimes);

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden lg:grid grid-cols-[100px_100px_140px_120px_120px_120px_120px] gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 items-center">
        {/* Time */}
        <div className="font-medium text-gray-700 text-base">{hour}</div>

        {/* Weather icon */}
        <div className="flex flex-col items-center gap-0.5">
          {dmi && (
            <div className="text-2xl">
              {getWeatherEmoji(dmi.cloudCover, dmi.precipitation, isNight)}
            </div>
          )}
          {yr && (
            <div className="text-2xl">
              {getWeatherEmoji(yr.cloudCover, yr.precipitation, isNight)}
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="text-center">
          {dmi && (
            <div className="font-semibold text-teal-700 text-base">
              {Math.round(dmi.temperature)}°
            </div>
          )}
          {yr && (
            <div className="font-semibold text-indigo-700 text-base">
              {Math.round(yr.temperature)}°
            </div>
          )}
        </div>

        {/* Precipitation */}
        <div className="text-center">
          {dmi && (
            <div className="text-teal-700 text-base">
              {dmi.precipitation.toFixed(1)}
            </div>
          )}
          {yr && (
            <div className="text-indigo-700 text-base">
              {yr.precipitation.toFixed(1)}
            </div>
          )}
        </div>

        {/* Wind */}
        <div className="text-center">
          {dmi && (
            <div className="text-teal-700 text-base">
              {Math.round(dmi.windSpeed)}
            </div>
          )}
          {yr && (
            <div className="text-indigo-700 text-base">
              {Math.round(yr.windSpeed)}
            </div>
          )}
        </div>

        {/* Cloud cover */}
        <div className="text-center">
          {dmi && (
            <div className="text-teal-700 text-base">
              {Math.round(dmi.cloudCover)}%
            </div>
          )}
          {yr && (
            <div className="text-indigo-700 text-base">
              {Math.round(yr.cloudCover)}%
            </div>
          )}
        </div>

        {/* Humidity */}
        <div className="text-center">
          {dmi && (
            <div className="text-teal-700 text-base">
              {Math.round(dmi.humidity)}%
            </div>
          )}
          {yr && (
            <div className="text-indigo-700 text-base">
              {Math.round(yr.humidity)}%
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden grid grid-cols-[60px_50px_1fr_1fr] gap-2 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 text-sm items-center">
        {/* Time */}
        <div className="font-medium text-gray-700 text-xs">{hour}</div>

        {/* Weather icon */}
        <div className="flex flex-col items-center gap-0.5">
          {dmi && (
            <div className="text-lg">
              {getWeatherEmoji(dmi.cloudCover, dmi.precipitation, isNight)}
            </div>
          )}
          {yr && (
            <div className="text-lg">
              {getWeatherEmoji(yr.cloudCover, yr.precipitation, isNight)}
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="text-center">
          {dmi && (
            <div className="font-semibold text-teal-700 text-xs">
              {Math.round(dmi.temperature)}°
            </div>
          )}
          {yr && (
            <div className="font-semibold text-indigo-700 text-xs">
              {Math.round(yr.temperature)}°
            </div>
          )}
        </div>

        {/* Wind */}
        <div className="text-center">
          {dmi && (
            <div className="text-teal-700 text-xs">
              {Math.round(dmi.windSpeed)} m/s
            </div>
          )}
          {yr && (
            <div className="text-indigo-700 text-xs">
              {Math.round(yr.windSpeed)} m/s
            </div>
          )}
        </div>
      </div>
    </>
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
      className="text-blue-600 hover:text-blue-700 font-medium text-sm uppercase tracking-wide flex items-center gap-2 cursor-pointer"
      onClick={onToggle}
    >
      {isExpanded ? "LUK" : "UDVID"}
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
