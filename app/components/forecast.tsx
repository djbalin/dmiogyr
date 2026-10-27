"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { groupByDay, summariseDay } from "@/lib/weather/aggregate";
import type { Location } from "@/lib/weather/locations";
import type { PlaceSuggestion } from "@/lib/weather/providers/dmi-search";
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
import { LocationSearch } from "./location-search";
import { NowPanel } from "./now-panel";
import { ThemeToggle } from "./theme-toggle";
import { PROVIDER_STYLES, RefreshIcon, Skeleton, WarningIcon } from "./ui";

const STORAGE_KEY = "dmiogyr:location";
const NOW_COLLAPSED_KEY = "dmiogyr:now-hidden";

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

function readNowCollapsed(): boolean {
  try {
    return window.localStorage.getItem(NOW_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function storeNowCollapsed(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(NOW_COLLAPSED_KEY, "1");
    else window.localStorage.removeItem(NOW_COLLAPSED_KEY);
  } catch {
    // Ignored on purpose.
  }
}

/** The page for a place: the URL is where the chosen place lives. */
function placeHref(id: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("sted", id);
  return `${url.pathname}${url.search}`;
}

/** Yr reaches nine days out; beyond that neither provider has anything. */
const MAX_DAYS = 9;
/**
 * With no refresh button, a page left open keeps itself current: both models
 * run hourly, and the server caches for that long, so refetching more often
 * than this would only ever get the same numbers back.
 */
const AUTO_REFRESH_MS = 30 * 60 * 1000;

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
  location,
  unresolved = false,
}: {
  location: Location;
  /** The URL named a place DMI could not find; `location` is the default. */
  unresolved?: boolean;
}) {
  const router = useRouter();
  const [switching, startSwitching] = useTransition();
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
  // Read after mount, like the stored town: the server cannot see it.
  const [nowCollapsed, setNowCollapsed] = useState(false);

  useEffect(() => setNowCollapsed(readNowCollapsed()), []);

  const toggleNowCollapsed = (hidden: boolean) => {
    setNowCollapsed(hidden);
    storeNowCollapsed(hidden);
  };

  useEffect(() => {
    setNow(new Date());
    // Keep the "now" highlight honest without re-rendering constantly.
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Restore the last-used place when the URL does not name one.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sted")) return;
    const saved = readStoredLocation();
    if (saved && saved !== location.id) {
      startSwitching(() => router.replace(placeHref(saved), { scroll: false }));
    }
  }, [location.id, router]);

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

  const lastLoaded = useRef(0);

  useEffect(() => {
    const controllers = inFlight.current;
    reload(location.id);
    lastLoaded.current = Date.now();
    // Days opened for one place say nothing about the next one.
    setOpenDays(new Set());
    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoaded.current < AUTO_REFRESH_MS) return;
      lastLoaded.current = Date.now();
      reload(location.id);
    };
    // A phone tab woken after a night in the background refreshes at once;
    // an open desktop tab every half hour.
    const timer = setInterval(refreshIfDue, 60_000);
    document.addEventListener("visibilitychange", refreshIfDue);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
      for (const controller of controllers.values()) controller.abort();
    };
  }, [location.id, reload]);

  const changeLocation = (place: PlaceSuggestion) => {
    storeLocation(place.id);
    // The server resolves the place (and warms DMI's cache for it) as part
    // of rendering the new page.
    startSwitching(() =>
      router.replace(placeHref(place.id), { scroll: false }),
    );
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
      {/* On a phone: title and theme on one line, search full width under
          them. With room: title, search, theme in a row. */}
      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            DMI og Yr
          </h1>
          <p className="mt-1 font-display text-base italic text-ink-muted sm:text-lg">
            To vejrudsigter, side om side.
          </p>
        </div>
        <LocationSearch
          value={location}
          onSelect={changeLocation}
          pending={switching}
          className="order-last w-full sm:order-none sm:w-80"
        />
        <ThemeToggle className="sm:order-last" />
        {unresolved && (
          <p className="order-last inline-flex w-full items-center gap-2 text-sm text-warn">
            <WarningIcon className="shrink-0" />
            Stedet kunne ikke findes hos DMI. Viser {location.name} i stedet.
          </p>
        )}
      </header>

      <div className="space-y-4">
        {/* Expanded, "Lige nu" is a column beside the graph once there is
            room; collapsed, it is a slim bar above it and the graph gets the
            full width. On a phone it sits above the graph either way. */}
        <div
          className={
            nowCollapsed
              ? "flex flex-col gap-4"
              : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-stretch"
          }
        >
          <ForecastChart
            forecasts={forecasts}
            now={now ?? new Date()}
            loading={anyLoading}
            location={location}
          />
          <NowPanel
            forecasts={forecasts}
            sun={days[0]?.sun ?? null}
            dmiSun={extras?.details?.sun[0] ?? null}
            now={now ?? new Date()}
            loading={anyLoading}
            collapsed={nowCollapsed}
            onToggle={() => toggleNowCollapsed(!nowCollapsed)}
            className={
              nowCollapsed ? "order-first" : "order-first lg:order-none"
            }
          />
        </div>

        <DmiExtrasTop extras={extras} />

        <ProviderProblems states={states} onRetry={retry} />

        {allFailed ? (
          <EmptyState onRetry={() => reload(location.id)} />
        ) : days.length === 0 ? (
          <DayListSkeleton />
        ) : (
          <section
            aria-label="Udsigt dag for dag"
            aria-busy={anyLoading}
            className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)] transition-opacity duration-300 ${
              anyLoading ? "opacity-60" : ""
            }`}
          >
            <DayListHeader />
            {days.map((day) => (
              <DayCard
                key={day.day}
                data={day}
                today={today}
                now={now ?? new Date()}
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

/** A banner per provider that is down or serving old numbers; nothing when
 * both are fine. */
function ProviderProblems({
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
      className="flex flex-wrap items-center gap-2 empty:hidden"
      // Announce a provider going down or going stale without stealing focus.
      aria-live="polite"
    >
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

/** Placeholder rows shaped like the day table: a heading, then a DMI and a
 * Yr line of period icons and temperatures. */
function DayListSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]"
      aria-live="polite"
    >
      <span className="sr-only">Henter udsigten dag for dag…</span>
      {["a", "b", "c", "d", "e"].map((key) => (
        <div
          key={key}
          className="flex items-center gap-4 border-t border-line px-4 py-4 first:border-t-0"
        >
          <div className="w-28 shrink-0 space-y-2 sm:w-40">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex-1 space-y-2.5">
            {PROVIDER_IDS.map((provider) => (
              <div key={provider} className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full opacity-40 ${PROVIDER_STYLES[provider].dot}`}
                />
                <div className="flex flex-1 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="skeleton h-6 w-6 shrink-0 rounded-full"
                    />
                  ))}
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
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
