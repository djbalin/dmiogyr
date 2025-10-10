"use client";

import { useEffect, useState } from "react";
import {
  HourlyForecast,
  processHourlyForecasts,
  getWeatherEmoji,
} from "./utils/processData";
import { APIResponse } from "@/app/api/types";

async function fetchWeather() {
  try {
    const response = await fetch("/api/weather");
    if (!response.ok) {
      throw new Error("Failed to fetch weather data");
    }
    const data: APIResponse = await response.json();

    // Process the data to get hourly forecasts
    const hourlyForecasts = processHourlyForecasts(data);
    return hourlyForecasts;
  } catch (err) {
    console.log(err);
    return err instanceof Error ? err.message : "Unknown error";
  }
}

export default function Home() {
  const [weather, setWeather] = useState<HourlyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function initWeather() {
      const result = await fetchWeather();
      if (typeof result === "string") {
        setError(result);
      } else {
        setWeather(result);
      }
      setLoading(false);
    }

    void initWeather();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  const groupedByDay = weather.reduce(
    (groups: Record<string, HourlyForecast[]>, hour) => {
      const date = hour.timestamp.split("T")[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(hour);
      return groups;
    },
    {},
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
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader />
        <WeatherDaysList
          groupedForecasts={groupedByDay}
          expandedDays={expandedDays}
          onToggleDay={toggleDay}
        />
        <PageFooter />
      </div>
    </div>
  );
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
      <h1 className="text-4xl sm:text-5xl font-bold mb-2">
        Copenhagen Weather
      </h1>
      <p className="text-blue-100 text-lg">Hourly Forecast</p>
    </header>
  );
}

function PageFooter() {
  return (
    <footer className="mt-8 text-center text-blue-100 text-sm">
      <p>Data from Danish Meteorological Institute (DMI)</p>
    </footer>
  );
}

interface WeatherDaysListProps {
  groupedForecasts: Record<string, HourlyForecast[]>;
  expandedDays: Set<string>;
  onToggleDay: (date: string) => void;
}

function WeatherDaysList({
  groupedForecasts,
  expandedDays,
  onToggleDay,
}: WeatherDaysListProps) {
  return (
    <div className="space-y-4">
      {Object.entries(groupedForecasts).map(([date, hours], dayIndex) => (
        <WeatherDayCard
          key={date}
          date={date}
          hours={hours}
          dayIndex={dayIndex}
          isExpanded={expandedDays.has(date)}
          onToggle={() => onToggleDay(date)}
        />
      ))}
    </div>
  );
}

interface WeatherDayCardProps {
  date: string;
  hours: HourlyForecast[];
  dayIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function WeatherDayCard({
  date,
  hours,
  dayIndex,
  isExpanded,
  onToggle,
}: WeatherDayCardProps) {
  const hour2PM =
    hours.find((h) => h.hour === "14:00") ||
    hours[Math.floor(hours.length / 2)];
  const temps = hours.map((h) => h.temperature);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const totalPrecipitation = hours.reduce((sum, h) => sum + h.precipitation, 0);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <CollapsedView
        date={date}
        hours={hours}
        dayIndex={dayIndex}
        hour2PM={hour2PM}
        maxTemp={maxTemp}
        minTemp={minTemp}
        totalPrecipitation={totalPrecipitation}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded && <ExpandedView hours={hours} />}
    </div>
  );
}

interface CollapsedViewProps {
  date: string;
  hours: HourlyForecast[];
  dayIndex: number;
  hour2PM: HourlyForecast;
  maxTemp: number;
  minTemp: number;
  totalPrecipitation: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function CollapsedView({
  date,
  hours,
  dayIndex,
  hour2PM,
  maxTemp,
  minTemp,
  totalPrecipitation,
  isExpanded,
  onToggle,
}: CollapsedViewProps) {
  return (
    <div
      onClick={onToggle}
      className="cursor-pointer hover:bg-gray-50 transition-colors p-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-[120px]">
          <h2 className="text-lg font-bold text-gray-800">
            {dayIndex === 0 ? "I dag" : hours[0].dayName.split(",")[0]}
          </h2>
          <p className="text-sm text-gray-500">
            {new Date(date).toLocaleDateString("da-DK", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>

        <div className="text-4xl">
          {getWeatherEmoji(hour2PM.cloudCover, hour2PM.precipitation)}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-800">
            {Math.round(maxTemp)}°
          </span>
          <span className="text-xl text-gray-500">/{Math.round(minTemp)}°</span>
        </div>

        <WeatherMetrics
          precipitation={totalPrecipitation}
          windSpeed={hour2PM.windSpeed}
          humidity={hour2PM.humidity}
        />

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

interface WeatherMetricsProps {
  precipitation: number;
  windSpeed: number;
  humidity: number;
}

function WeatherMetrics({
  precipitation,
  windSpeed,
  humidity,
}: WeatherMetricsProps) {
  return (
    <>
      <div className="text-center min-w-[60px]">
        <p className="text-sm font-semibold text-gray-800">
          {precipitation.toFixed(1)} mm
        </p>
      </div>

      <div className="text-center min-w-[80px]">
        <p className="text-sm font-semibold text-gray-800">
          {Math.round(windSpeed)} m/s
        </p>
      </div>

      <div className="text-center min-w-[60px]">
        <p className="text-sm font-semibold text-gray-800">
          {Math.round(humidity)}%
        </p>
      </div>
    </>
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

function ExpandedView({ hours }: { hours: HourlyForecast[] }) {
  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {hours.map((hour) => (
          <HourlyWeatherCard key={hour.timestamp} hour={hour} />
        ))}
      </div>
    </div>
  );
}

function HourlyWeatherCard({ hour }: { hour: HourlyForecast }) {
  return (
    <div className="bg-white rounded-lg shadow p-3 transition-transform hover:scale-105">
      <div className="text-center mb-2">
        <p className="text-base font-bold text-gray-800">{hour.hour}</p>
        <span className="text-3xl">
          {getWeatherEmoji(hour.cloudCover, hour.precipitation)}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800">
            {Math.round(hour.temperature)}°C
          </p>
        </div>

        <div className="text-xs space-y-1">
          <WeatherMetricRow
            icon="💧"
            value={`${hour.precipitation.toFixed(1)}mm`}
          />
          <WeatherMetricRow
            icon="💨"
            value={`${Math.round(hour.windSpeed)}m/s`}
          />
          <WeatherMetricRow
            icon="☁️"
            value={`${Math.round(hour.cloudCover)}%`}
          />
          <WeatherMetricRow icon="💦" value={`${Math.round(hour.humidity)}%`} />
        </div>
      </div>
    </div>
  );
}

function WeatherMetricRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{icon}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
