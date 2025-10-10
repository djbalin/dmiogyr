"use client";
import { useState, useEffect } from "react";
import { DailyForecast, WeatherData } from "./page";

export default function Home() {
  const [weather, setWeather] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        console.log("Fetching");
        const response = await fetch("/api/weather");
        if (!response.ok) {
          throw new Error("Failed to fetch weather data");
        }
        const data: WeatherData = await response.json();

        // Process the data to get daily forecasts
        const dailyForecasts = processDailyForecasts(data);
        setWeather(dailyForecasts);
      } catch (err) {
        console.log(err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, []);

  function processDailyForecasts(data: WeatherData): DailyForecast[] {
    const dailyMap = new Map<string, any>();

    data.features?.forEach((feature) => {
      const from = new Date(feature.properties.from);
      const dateKey = from.toISOString().split("T")[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          temps: [],
          precipitations: [],
          windSpeeds: [],
          cloudCovers: [],
          humidities: [],
        });
      }

      const day = dailyMap.get(dateKey);
      if (feature.properties["temperature-2m"]) {
        day.temps.push(Number(feature.properties["temperature-2m"]));
      }
      if (feature.properties["total-precipitation"]) {
        day.precipitations.push(
          Number(feature.properties["total-precipitation"]),
        );
      }
      if (feature.properties["wind-speed-10m"]) {
        day.windSpeeds.push(Number(feature.properties["wind-speed-10m"]));
      }
      if (feature.properties["fraction-of-cloud-cover"]) {
        day.cloudCovers.push(
          Number(feature.properties["fraction-of-cloud-cover"]),
        );
      }
      if (feature.properties["relative-humidity-2m"]) {
        day.humidities.push(Number(feature.properties["relative-humidity-2m"]));
      }
    });

    const forecasts: DailyForecast[] = [];
    dailyMap.forEach((day) => {
      const date = new Date(day.date);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });

      forecasts.push({
        date: day.date,
        dayName,
        temp: {
          min: Math.min(...day.temps),
          max: Math.max(...day.temps),
        },
        precipitation: day.precipitations.reduce(
          (a: number, b: number) => a + b,
          0,
        ),
        windSpeed:
          day.windSpeeds.reduce((a: number, b: number) => a + b, 0) /
          day.windSpeeds.length,
        cloudCover:
          day.cloudCovers.reduce((a: number, b: number) => a + b, 0) /
          day.cloudCovers.length,
        humidity:
          day.humidities.reduce((a: number, b: number) => a + b, 0) /
          day.humidities.length,
      });
    });

    return forecasts.slice(0, 7); // Return first 7 days
  }

  function getWeatherEmoji(cloudCover: number, precipitation: number): string {
    if (precipitation > 2) return "🌧️";
    if (cloudCover > 75) return "☁️";
    if (cloudCover > 40) return "⛅";
    return "☀️";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600">
        <div className="text-white text-xl">Loading weather data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-400 to-red-600">
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-white mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">
            Copenhagen Weather
          </h1>
          <p className="text-blue-100 text-lg">7-Day Forecast</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weather.map((day, index) => (
            <div
              key={day.date}
              className={`bg-white rounded-xl shadow-lg p-6 transition-transform hover:scale-105 ${
                index === 0 ? "md:col-span-2 lg:col-span-1" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {index === 0 ? "Today" : day.dayName}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {new Date(day.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-4xl">
                  {getWeatherEmoji(day.cloudCover, day.precipitation)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-3xl font-bold text-gray-800">
                    {Math.round(day.temp.max)}°
                  </span>
                  <span className="text-xl text-gray-500">
                    {Math.round(day.temp.min)}°
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span>💧</span>
                    <div>
                      <p className="text-gray-500">Rain</p>
                      <p className="font-semibold">
                        {day.precipitation.toFixed(1)} mm
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>💨</span>
                    <div>
                      <p className="text-gray-500">Wind</p>
                      <p className="font-semibold">
                        {Math.round(day.windSpeed)} m/s
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>☁️</span>
                    <div>
                      <p className="text-gray-500">Clouds</p>
                      <p className="font-semibold">
                        {Math.round(day.cloudCover)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>💦</span>
                    <div>
                      <p className="text-gray-500">Humidity</p>
                      <p className="font-semibold">
                        {Math.round(day.humidity)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-8 text-center text-blue-100 text-sm">
          <p>Data from Danish Meteorological Institute (DMI)</p>
        </footer>
      </div>
    </div>
  );
}
