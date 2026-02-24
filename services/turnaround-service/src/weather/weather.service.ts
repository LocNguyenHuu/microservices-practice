import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Weather data from the Data Ingestion Service's METAR endpoint.
interface WeatherData {
  icao: string;
  temperature_c: number | null;
  visibility_m: number | null;
  conditions: string[];
  is_icing: boolean;
  is_lvp: boolean;
}

// De-icing task template injected when icing conditions are detected.
// Holdover time varies by temperature range (Type I/IV fluid).
export interface DeIcingTask {
  name: string;
  estimatedDurationMinutes: number;
  requiredCertification: string;
  requiredEquipment: string;
  order: number;
}

// Duration scaling factor for Low Visibility Procedures (LVP).
// When visibility < 550m, all tasks take longer due to reduced movement speeds.
const LVP_DURATION_FACTOR = 1.2;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly dataIngestionUrl: string;
  private cachedWeather: WeatherData | null = null;
  private lastFetchAt = 0;

  constructor(private readonly config: ConfigService) {
    this.dataIngestionUrl = config.get<string>('dataIngestionUrl')!;
  }

  // Fetch current weather from the Data Ingestion Service.
  // Caches for 5 minutes to avoid excessive requests.
  async getCurrentWeather(): Promise<WeatherData | null> {
    const now = Date.now();
    if (this.cachedWeather && now - this.lastFetchAt < 5 * 60 * 1000) {
      return this.cachedWeather;
    }

    try {
      const resp = await fetch(
        `${this.dataIngestionUrl}/api/weather/current`,
      );
      if (!resp.ok) {
        this.logger.debug('Weather data not available yet');
        return null;
      }
      const data = (await resp.json()) as WeatherData;
      this.cachedWeather = data;
      this.lastFetchAt = now;
      return data;
    } catch (error) {
      this.logger.warn(`Failed to fetch weather: ${(error as Error).message}`);
      return this.cachedWeather;
    }
  }

  // Check if de-icing is needed based on current weather conditions.
  // De-icing required when: temp < 3°C, or icing conditions detected.
  async isDeIcingRequired(): Promise<boolean> {
    const weather = await this.getCurrentWeather();
    if (!weather) return false;

    if (weather.is_icing) return true;
    if (weather.temperature_c !== null && weather.temperature_c < 3) return true;

    return false;
  }

  // Generate a de-icing task with holdover time based on temperature.
  // Colder temperatures require longer holdover periods.
  getDeIcingTask(insertAfterOrder: number): DeIcingTask {
    const temp = this.cachedWeather?.temperature_c ?? 0;
    let holdoverMinutes: number;

    if (temp < -10) {
      holdoverMinutes = 45; // Type IV fluid, very cold
    } else if (temp < -3) {
      holdoverMinutes = 30; // Type IV fluid
    } else {
      holdoverMinutes = 20; // Type I fluid
    }

    return {
      name: 'de_icing',
      estimatedDurationMinutes: holdoverMinutes,
      requiredCertification: 'fueling', // De-icing crews typically have fueling cert
      requiredEquipment: 'de_icing_truck',
      order: insertAfterOrder + 1,
    };
  }

  // Check if Low Visibility Procedures (LVP) are active.
  // LVP: visibility < 550m or ceiling < 200ft.
  async isLVPActive(): Promise<boolean> {
    const weather = await this.getCurrentWeather();
    if (!weather) return false;
    return weather.is_lvp;
  }

  // Get the duration scaling factor for current weather.
  // Returns 1.0 in normal conditions, 1.2 under LVP.
  async getDurationFactor(): Promise<number> {
    return (await this.isLVPActive()) ? LVP_DURATION_FACTOR : 1.0;
  }
}
