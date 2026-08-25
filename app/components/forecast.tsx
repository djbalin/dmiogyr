"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupByDay, summariseDay } from "@/lib/weather/aggregate";
import { LOCATIONS, type Location } from "@/lib/weather/locations";
import { computeSunTimes } from "@/lib/weather/sun";
import { formatClock, todayKey } from "@/lib/weather/time";
import {
  type ForecastResponse,
  PROVIDER_IDS,
  PROVIDERS,
  type ProviderId,
} from "@/lib/weather/types";
import { DayCard, type DayData, DayListHeader } from "./day-card";
import { DmiExtrasBottom, DmiExtrasTop, useDmiExtras } from "./dmi-extras";
import { ForecastChart } from "./forecast-chart";
import { LocationPicker } from "./location-picker";
import { NowPanel } from "./now-panel";
import { PROVIDER_STYLES, RefreshIcon, Skeleton, WarningIcon } from "./ui";

const STORAGE_KEY = "dmiogyr:location";

/*
 * localStorage throws outright when a browser is set to block site data, so
 * both sides of it are guarded. Remembering the last town is a convenience;
 * it is never worth breaking the page over.
 */
function readStoredLocation(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLocation(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignored on purpose.
  }
}

/** Put the chosen town in the URL, so a forecast can be linked and shared. */
function syncUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("sted", id);
  window.history.replaceState(null, "", url);
}
/** Yr reaches nine days out; beyond that neither provider has anything. */
const MAX_DAYS = 9;

type ProviderState = {
  status: "loading" | "ready" | "error";
  data: ForecastResponse | null;
  error: string | null;
};

const INITIAL: ProviderState = { status: "loading", data: null, error: null };

async function loadForecast(
  provider: ProviderId,
  locationId: string,
  signal: AbortSignal,
): Promise<ForecastResponse> {
  const response = await fetch(
    `/api/${provider}?location=${encodeURIComponent(locationId)}`,
    { signal, cache: "no-store" },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // The message is phrased to follow the provider's name, which the status
    // banner supplies.
    throw new Error(body?.error ?? `svarede ${response.status}.`);
  }
  return body as ForecastResponse;
}

export function Forecast({
  location: initialLocation,
}: {
  location: Location;
}) {
  const [location, setLocation] = useState(initialLocation);
  const [states, setStates] = useState<Record<ProviderId, ProviderState>>({
    dmi: INITIAL,
    yr: INITIAL,
  });
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  // One controller per provider, so retrying the one that failed does not
  // cancel the one that is still loading.
  const inFlight = useRef(new Map<ProviderId, AbortController>());
  // `now` only exists once the browser has it, so the server-rendered HTML and
  // the first client render agree and React does not report a mismatch.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Keep the "now" highlight honest without re-rendering constantly.
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Restore the last-used location when the URL does not name one.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sted")) return;
    const saved = readStoredLocation();
    const match = LOCATIONS.find((candidate) => candidate.id === saved);
    if (match && match.id !== initialLocation.id) {
      setLocation(match);
      syncUrl(match.id);
    }
  }, [initialLocation.id]);

  const fetchProvider = useCallback(
    (provider: ProviderId, locationId: string, signal: AbortSignal) => {
      setStates((previous) => ({
        ...previous,
        [provider]: { ...previous[provider], status: "loading", error: null },
      }));
      loadForecast(provider, locationId, signal)
        .then((data) => {
          if (signal.aborted) return;
          setStates((previous) => ({
            ...previous,
            [provider]: { status: "ready", data, error: null },
          }));
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          setStates((previous) => ({
            ...previous,
            [provider]: {
              status: "error",
              // Keep whatever we already showed: a failed refresh should not
              // wipe a forecast the user is in the middle of reading.
              data: previous[provider].data,
              error:
                error instanceof Error ? error.message : "kunne ikke hentes.",
            },
          }));
        });
    },
    [],
  );

  const reload = useCallback(
    (locationId: string, providers: readonly ProviderId[] = PROVIDER_IDS) => {
      const controllers = inFlight.current;
      for (const provider of providers) {
        controllers.get(provider)?.abort();
        const controller = new AbortController();
        controllers.set(provider, controller);
        fetchProvider(provider, locationId, controller.signal);
      }
    },
    [fetchProvider],
  );

  useEffect(() => {
    const controllers = inFlight.current;
    reload(location.id);
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, [location.id, reload]);

  const changeLocation = (next: Location) => {
    setLocation(next);
    // Days opened for one town say nothing about the next one.
    setOpenDays(new Set());
    storeLocation(next.id);
    syncUrl(next.id);
  };

  const retry = (provider: ProviderId) => reload(location.id, [provider]);

  const today = useMemo(() => todayKey(undefined, now ?? new Date()), [now]);

  const { extras, loading: extrasLoading } = useDmiExtras(location.id);

  const days = useMemo<DayData[]>(() => {
    const grouped = PROVIDER_IDS.map((provider) => ({
      provider,
      byDay: groupByDay(states[provider].data?.hours ?? []),
    }));

    const dayKeys = [
      ...new Set(grouped.flatMap(({ byDay }) => [...byDay.keys()])),
    ]
      .filter((day) => day >= today)
      .sort()
      .slice(0, MAX_DAYS);

    return dayKeys
      .map((day) => {
        const sun = computeSunTimes(day, location.lat, location.lon);
        const summaries: DayData["summaries"] = {};
        let total = 0;
        for (const { provider, byDay } of grouped) {
          const hours = byDay.get(day) ?? [];
          total += hours.length;
          const summary = summariseDay(day, hours, sun);
          if (summary) summaries[provider] = summary;
        }
        const uv = extras?.details?.uv.find((entry) => entry.date === day)?.max;
        // A trailing day with an hour or two of data is noise, not a forecast.
        const result: DayData | null =
          total >= 3 ? { day, sun, summaries, uv } : null;
        return result;
      })
      .filter((day): day is DayData => day !== null);
  }, [states, today, location.lat, location.lon, extras]);

  // One temperature scale across the whole week, so the range bars can be
  // compared between days rather than each being drawn to its own scale.
  const [scaleMin, scaleMax] = useMemo(() => {
    const values = days.flatMap((day) =>
      Object.values(day.summaries).flatMap((summary) => [
        summary.minTemperature,
        summary.maxTemperature,
      ]),
    );
    if (values.length === 0) return [0, 1];
    return [Math.floor(Math.min(...values)), Math.ceil(Math.max(...values))];
  }, [days]);

  const forecasts = useMemo(() => {
    const map: Partial<Record<ProviderId, ForecastResponse>> = {};
    for (const provider of PROVIDER_IDS) {
      const data = states[provider].data;
      if (data) map[provider] = data;
    }
    return map;
  }, [states]);

  const anyLoading = PROVIDER_IDS.some((p) => states[p].status === "loading");
  const allFailed = PROVIDER_IDS.every(
    (p) => states[p].status === "error" && !states[p].data,
  );
  const updatedAt = PROVIDER_IDS.map((p) => states[p].data?.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const toggleDay = (day: string) =>
    setOpenDays((previous) => {
      const next = new Set(previous);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              DMI og Yr
            </h1>
            <p className="mt-1 max-w-md text-ink-muted">
              To vejrudsigter for {location.name}, side om side — så du kan se
              hvor de er enige.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LocationPicker value={location} onChange={changeLocation} />
            <button
              type="button"
              onClick={() => reload(location.id)}
              disabled={anyLoading}
              className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-[var(--shadow)] transition-colors hover:border-line-strong disabled:opacity-60"
            >
              <RefreshIcon spinning={anyLoading} />
              Opdatér
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <NowPanel
          forecasts={forecasts}
          sun={days[0]?.sun ?? null}
          now={now ?? new Date()}
          loading={anyLoading}
        />

        <ForecastChart
          forecasts={forecasts}
          now={now ?? new Date()}
          loading={anyLoading}
          location={location}
        />

        <DmiExtrasTop extras={extras} loading={extrasLoading} />

        <ProviderStatus states={states} onRetry={retry} />

        {allFailed ? (
          <EmptyState onRetry={() => reload(location.id)} />
        ) : days.length === 0 ? (
          <DayListSkeleton />
        ) : (
          <section
            aria-label="Udsigt dag for dag"
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]"
          >
            <DayListHeader />
            {days.map((day) => (
              <DayCard
                key={day.day}
                data={day}
                today={today}
                now={now ?? new Date()}
                scaleMin={scaleMin}
                scaleMax={scaleMax}
                open={openDays.has(day.day)}
                onToggle={() => toggleDay(day.day)}
              />
            ))}
          </section>
        )}

        <DmiExtrasBottom extras={extras} loading={extrasLoading} />
      </div>

      <footer className="mt-8 space-y-1 text-sm text-ink-faint">
        <p>
          Data fra{" "}
          <a
            className="text-accent underline underline-offset-2"
            href={PROVIDERS.dmi.attribution.href}
          >
            {PROVIDERS.dmi.attribution.label}
          </a>{" "}
          og{" "}
          <a
            className="text-accent underline underline-offset-2"
            href={PROVIDERS.yr.attribution.href}
          >
            {PROVIDERS.yr.attribution.label}
          </a>
          . Tidspunkter er dansk tid.
        </p>
        <p className="numeric">
          {location.name} · {location.lat.toFixed(3)}°N,{" "}
          {location.lon.toFixed(3)}°Ø
          {updatedAt && now
            ? ` · hentet ${formatClock(new Date(updatedAt))}`
            : ""}
        </p>
      </footer>
    </div>
  );
}

function ProviderStatus({
  states,
  onRetry,
}: {
  states: Record<ProviderId, ProviderState>;
  onRetry: (provider: ProviderId) => void;
}) {
  const problems = PROVIDER_IDS.filter(
    (provider) =>
      states[provider].status === "error" ||
      states[provider].data?.freshness === "stale",
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      // Announce a provider going down or going stale without stealing focus.
      aria-live="polite"
    >
      {PROVIDER_IDS.map((provider) => {
        const state = states[provider];
        const meta = PROVIDERS[provider];
        return (
          <span
            key={provider}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted"
            title={meta.description}
          >
            <span
              className={`h-2 w-2 rounded-full ${PROVIDER_STYLES[provider].dot} ${
                state.status === "loading" ? "animate-pulse" : ""
              }`}
            />
            <span className="font-semibold text-ink">{meta.name}</span>
            <span>
              {state.status === "loading"
                ? "henter…"
                : state.status === "error"
                  ? "utilgængelig"
                  : `${meta.horizonDays} døgn`}
            </span>
          </span>
        );
      })}

      {problems.map((provider) => {
        const state = states[provider];
        const stale = state.data?.freshness === "stale";
        return (
          <span
            key={`problem-${provider}`}
            className="inline-flex items-center gap-2 rounded-full bg-warn-soft px-3 py-1.5 text-xs text-warn"
          >
            <WarningIcon />
            <span>
              {stale
                ? `${PROVIDERS[provider].name} svarer ikke — viser sidst hentede tal.`
                : `${PROVIDERS[provider].name} ${state.error}`}
            </span>
            {state.status === "error" && (
              <button
                type="button"
                onClick={() => onRetry(provider)}
                className="font-semibold underline underline-offset-2"
              >
                Prøv igen
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function DayListSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
      {["a", "b", "c", "d", "e"].map((key) => (
        <div
          key={key}
          className="flex items-center gap-4 border-t border-line px-4 py-5 first:border-t-0"
        >
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow)]">
      <WarningIcon className="mx-auto mb-3 h-8 w-8 text-warn" />
      <h2 className="text-lg font-semibold text-ink">
        Ingen af vejrtjenesterne svarer
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
        Både DMI og Yr afviste forespørgslen. Det plejer at gå over af sig selv
        — prøv igen om lidt.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-page"
      >
        <RefreshIcon spinning={false} />
        Prøv igen
      </button>
    </section>
  );
}
