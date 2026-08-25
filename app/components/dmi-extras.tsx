"use client";

import { useEffect, useState } from "react";
import type { DmiExtras } from "@/lib/weather/extras-service";
import type { DmiWarningLevel } from "@/lib/weather/providers/dmi-extras";
import { formatClock } from "@/lib/weather/time";
import { Skeleton, WarningIcon } from "./ui";

/**
 * Everything dmi.dk's own location page shows beyond the hourly forecast:
 * its written regional forecast, sun times, active weather warnings, and —
 * for towns near the coast — the water level. (UV index rides along with
 * the day-by-day table instead, as a badge, since it is per-day data like
 * the rest of that row.)
 *
 * Fetched separately from the DMI/Yr hourly comparison: none of this exists
 * for Yr, and each of these upstream calls is free to fail without taking
 * the forecast down with it.
 */
export function useDmiExtras(locationId: string): {
  extras: DmiExtras | null;
  loading: boolean;
} {
  const [extras, setExtras] = useState<DmiExtras | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/dmi-extras?location=${encodeURIComponent(locationId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((data: DmiExtras) => {
        if (!controller.signal.aborted) setExtras(data);
      })
      .catch(() => {
        // A failed load just leaves these sections empty; the hourly
        // comparison is the part of the page that must not break.
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locationId]);

  return { extras, loading };
}

/** Warnings banner and sun times — sits right under "Lige nu". */
export function DmiExtrasTop({
  extras,
  loading,
}: {
  extras: DmiExtras | null;
  loading: boolean;
}) {
  if (loading && !extras) return <Skeleton className="h-12" />;
  if (!extras) return null;

  const hasWarning = extras.warnings && extras.warnings.level !== "none";
  const hasSun = (extras.details?.sun.length ?? 0) > 0;
  if (!hasWarning && !hasSun) return null;

  return (
    <div className="space-y-4">
      {extras.warnings && hasWarning && (
        <WarningBanner
          level={extras.warnings.level}
          count={extras.warnings.warnings.length}
        />
      )}
      {hasSun && extras.details && <SunCard details={extras.details} />}
    </div>
  );
}

/** The regional forecast text and water level — sits below the day table. */
export function DmiExtrasBottom({
  extras,
  loading,
}: {
  extras: DmiExtras | null;
  loading: boolean;
}) {
  if (loading && !extras) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (!extras) return null;

  const hasRegional =
    extras.details?.regionalForecast.text ||
    extras.details?.regionalForecast.headline;
  const hasTide = extras.tide && extras.tide.obs.length > 0;
  if (!hasRegional && !hasTide) return null;

  return (
    <div className="space-y-4">
      {hasRegional && extras.details && (
        <RegionalForecastCard details={extras.details} />
      )}
      {hasTide && extras.tide && (
        <TidePanel obs={extras.tide.obs} fcst={extras.tide.fcst} />
      )}
    </div>
  );
}

const WARNING_STYLES: Record<
  Exclude<DmiWarningLevel, "none">,
  { bg: string; text: string; label: string }
> = {
  yellow: { bg: "bg-warn-soft", text: "text-warn", label: "Gult varsel" },
  orange: { bg: "bg-warn-soft", text: "text-warn", label: "Orange varsel" },
  red: { bg: "bg-danger-soft", text: "text-danger", label: "Rødt varsel" },
};

function WarningBanner({
  level,
  count,
}: {
  level: DmiWarningLevel;
  count: number;
}) {
  if (level === "none") return null;
  const style = WARNING_STYLES[level];
  return (
    <section
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${style.bg} ${style.text}`}
      role="alert"
    >
      <WarningIcon className="shrink-0" />
      <p>
        <strong>{style.label} fra DMI.</strong>{" "}
        {count > 0
          ? `${count} varsel${count === 1 ? "" : "er"} er i kraft for dette område.`
          : "Der er udsendt et varsel for dette område i dag."}{" "}
        <a
          className="underline underline-offset-2"
          href="https://www.dmi.dk/dmis-vejrprodukter/varsler"
        >
          Se varslet på dmi.dk
        </a>
      </p>
    </section>
  );
}

function RegionalForecastCard({
  details,
}: {
  details: NonNullable<DmiExtras["details"]>;
}) {
  const { regionalForecast } = details;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        DMI's udsigt for {regionalForecast.area || "området"}
      </h2>
      {regionalForecast.headline && (
        <p className="mt-2 text-lg font-semibold text-ink">
          {regionalForecast.headline}
        </p>
      )}
      {regionalForecast.text && (
        <p className="mt-2 text-sm text-ink-muted">{regionalForecast.text}</p>
      )}
      {regionalForecast.valid && (
        <p className="mt-3 text-xs text-ink-faint">{regionalForecast.valid}</p>
      )}
    </section>
  );
}

function SunCard({ details }: { details: NonNullable<DmiExtras["details"]> }) {
  const today = details.sun[0];
  if (!today) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        Sol i dag
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Stat label="Solopgang" value={today.sunrise} />
        <Stat label="Solnedgang" value={today.sunset} />
        <Stat
          label="Dagslængde"
          value={formatDayLength(today.dayLengthSeconds)}
        />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="numeric text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}

function formatDayLength(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} t ${minutes} min`;
}

function TidePanel({
  obs,
  fcst,
}: {
  obs: { time: string; levelCm: number }[];
  fcst: { time: string; levelCm: number }[];
}) {
  const latest = obs.at(-1);
  const points = [...obs, ...fcst];
  if (points.length < 2 || !latest) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Vandstand ved nærmeste målestation
        </h2>
        <p className="text-xs text-ink-faint">
          Målt {formatClock(new Date(latest.time))}
        </p>
      </div>
      <p className="mt-2 numeric text-3xl font-semibold text-ink">
        {latest.levelCm >= 0 ? "+" : ""}
        {latest.levelCm.toFixed(1)} cm
      </p>
      <p className="text-sm text-ink-muted">i forhold til dagligt vande</p>
      <TideSparkline obs={obs} fcst={fcst} className="mt-4" />
    </section>
  );
}

/**
 * A minimal inline chart: observed level as a solid line, forecast as a
 * dashed continuation, with "nu" marked at the boundary. No charting library
 * is pulled in for one sparkline.
 */
function TideSparkline({
  obs,
  fcst,
  className = "",
}: {
  obs: { time: string; levelCm: number }[];
  fcst: { time: string; levelCm: number }[];
  className?: string;
}) {
  const width = 600;
  const height = 80;
  const all = [...obs, ...fcst];
  const values = all.map((p) => p.levelCm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toPoint = (index: number, levelCm: number) => {
    const x = (index / (all.length - 1)) * width;
    const y = height - ((levelCm - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const obsPath = obs.map((p, i) => toPoint(i, p.levelCm)).join(" ");
  const fcstPath = fcst
    .map((p, i) => toPoint(obs.length - 1 + i, p.levelCm))
    .join(" ");
  const nowX = ((obs.length - 1) / (all.length - 1)) * width;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-16 w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={nowX}
        x2={nowX}
        y1="0"
        y2={height}
        stroke="var(--color-line-strong)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <polyline
        points={obsPath}
        fill="none"
        stroke="var(--color-dmi)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {fcst.length > 0 && (
        <polyline
          points={fcstPath}
          fill="none"
          stroke="var(--color-dmi)"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      )}
    </svg>
  );
}
