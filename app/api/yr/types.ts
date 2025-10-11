// Yr (MET Norway) API Types
// Based on https://api.met.no/weatherapi/locationforecast/2.0/documentation

export interface YrAPIResponse {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number, number]; // [lon, lat, altitude]
  };
  properties: {
    meta: {
      updated_at: string;
      units: {
        air_pressure_at_sea_level: string;
        air_temperature: string;
        cloud_area_fraction: string;
        precipitation_amount: string;
        relative_humidity: string;
        wind_from_direction: string;
        wind_speed: string;
      };
    };
    timeseries: YrTimeseries[];
  };
}

export interface YrTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        air_pressure_at_sea_level?: number;
        air_temperature?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
        wind_from_direction?: number;
        wind_speed?: number;
        wind_speed_of_gust?: number;
      };
    };
    next_1_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
      };
    };
    next_6_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
      };
    };
    next_12_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
      };
    };
  };
}
