// Re-export types from provider-specific modules
export type { DMIAPIResponse } from "./dmi/types";
export { DMI_WEATHER_METRICS } from "./dmi/types";
export type { YrAPIResponse, YrTimeseries } from "./yr/types";

// Common types that might be used across providers
export type WeatherProvider = "dmi" | "yr";
