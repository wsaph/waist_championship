export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'snow'
  | 'blizzard'
  | 'rain'
  | 'storm';

export interface HokkaidoWeatherSnapshot {
  temp: number;
  windKmh: number;
  snowfallCm: number;
  isDay: boolean;
  dayPhase: DayPhase;
  condition: WeatherCondition;
  label: string;
  emoji: string;
}

/** Sapporo, Hokkaido coordinates for live Open-Meteo weather */
export const HOKKAIDO_SAPPORO_COORDS = {
  latitude: 43.0618,
  longitude: 141.3545,
} as const;

export const HOKKAIDO_OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${HOKKAIDO_SAPPORO_COORDS.latitude}` +
  `&longitude=${HOKKAIDO_SAPPORO_COORDS.longitude}` +
  `&current=temperature_2m,weather_code,snowfall,wind_speed_10m&timezone=Asia%2FTokyo`;

/**
 * Computes day/night phase strictly anchored to Thailand time (Asia/Bangkok, UTC+7)
 * so Thai players experience dawn, daytime, golden/pastel dusk, and night illumination
 * matching their real-world Thai clock.
 */
export function getBangkokDayPhase(nowMs: number = Date.now()): DayPhase {
  const bkkNow = new Date(nowMs + 7 * 60 * 60 * 1000);
  const bkkHour = bkkNow.getUTCHours() + bkkNow.getUTCMinutes() / 60;
  if (bkkHour >= 5.5 && bkkHour < 8) return 'dawn';
  if (bkkHour >= 8 && bkkHour < 17) return 'day';
  if (bkkHour >= 17 && bkkHour < 19) return 'dusk';
  return 'night';
}

export function getBangkokTimeLabel(nowMs: number = Date.now()): string {
  const bkkNow = new Date(nowMs + 7 * 60 * 60 * 1000);
  const hh = String(bkkNow.getUTCHours()).padStart(2, '0');
  const mm = String(bkkNow.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Maps WMO weather codes + live Hokkaido temperature & wind speed into
 * rich Hokkaido winter conditions combined with Thailand's day phase.
 */
export function mapHokkaidoWmoWeather(
  code: number,
  dayPhase: DayPhase,
  tempC = 0,
  windKmh = 0,
  snowfallCm = 0
): Pick<HokkaidoWeatherSnapshot, 'condition' | 'label' | 'emoji'> {
  const isDay = dayPhase !== 'night';

  // Heavy snow / snow showers / snow + strong wind => Blizzard!
  const isSnowWmo = [71, 73, 75, 77, 85, 86].includes(code) || snowfallCm > 0.05;
  const isHeavySnowWmo = [73, 75, 86].includes(code) || snowfallCm >= 0.5;
  const isFreezingPrecip =
    tempC <= 1 && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code);

  if (isHeavySnowWmo || ((isSnowWmo || isFreezingPrecip) && windKmh >= 28)) {
    return {
      condition: 'blizzard',
      label: 'พายุหิมะฮอกไกโด',
      emoji: '🌨️',
    };
  }

  if (isSnowWmo || isFreezingPrecip) {
    return {
      condition: 'snow',
      label: dayPhase === 'night' ? 'หิมะโปรยยามค่ำ' : 'หิมะตกโปรยปราย',
      emoji: '❄️',
    };
  }

  if (code === 95 || code === 96 || code === 99) {
    return {
      condition: 'storm',
      label: 'พายุลมหนาวฟ้าคะนอง',
      emoji: '⛈️',
    };
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return {
      condition: 'rain',
      label: 'ฝนพรำอากาศเย็น',
      emoji: '🌧️',
    };
  }

  if (code === 0 || code === 1) {
    if (tempC <= 0) {
      if (dayPhase === 'dawn') {
        return { condition: 'clear', label: 'รุ่งเช้าเกล็ดน้ำแข็งใส', emoji: '🌅' };
      }
      if (dayPhase === 'dusk') {
        return { condition: 'clear', label: 'ยามเย็นโอตารุหนาวจัด', emoji: '🌇' };
      }
      return {
        condition: 'clear',
        label: isDay ? 'ฟ้าใสหนาวจัด (Diamond Dust)' : 'คืนดาวใสหนาวจัด',
        emoji: isDay ? '✨' : '🌙',
      };
    }
    if (dayPhase === 'dawn') {
      return { condition: 'clear', label: 'เช้าอากาศสดชื่น', emoji: '🌅' };
    }
    if (dayPhase === 'dusk') {
      return { condition: 'clear', label: 'ยามเย็นอากาศเย็นสบาย', emoji: '🌇' };
    }
    return {
      condition: 'clear',
      label: isDay ? 'แดดอุ่นลมหนาว' : 'ฟ้าโปร่งลมเย็น',
      emoji: isDay ? '☀️' : '🌙',
    };
  }

  // Fog / Overcast / Partly Cloudy (codes 2, 3, 45, 48, etc.)
  if (code === 45 || code === 48) {
    return {
      condition: 'cloudy',
      label: tempC <= 0 ? 'หมอกน้ำแข็งฮอกไกโด' : 'หมอกจางอากาศหนาว',
      emoji: '🌫️',
    };
  }

  if (dayPhase === 'dawn') {
    return { condition: 'cloudy', label: 'รุ่งเช้ามีเมฆลมหนาว', emoji: '🌅' };
  }
  if (dayPhase === 'dusk') {
    return { condition: 'cloudy', label: 'ยามเย็นเมฆครึ้ม', emoji: '🌇' };
  }
  return {
    condition: 'cloudy',
    label: isDay ? 'เมฆมากอากาศหนาว' : 'คืนเมฆครึ้มลมเย็น',
    emoji: isDay ? '⛅' : '☁️',
  };
}

/**
 * Fetches live weather from Sapporo, Hokkaido (Open-Meteo) while locking
 * `dayPhase` and `isDay` to Thailand local clock (UTC+7).
 */
export async function fetchHokkaidoHybridWeather(
  nowMs: number = Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<HokkaidoWeatherSnapshot | null> {
  try {
    const res = await fetchImpl(HOKKAIDO_OPEN_METEO_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;

    const dayPhase = getBangkokDayPhase(nowMs);
    const isDay = dayPhase !== 'night';
    const code = Number(cur.weather_code ?? 0);
    const temp = Math.round(Number(cur.temperature_2m ?? 0));
    const windKmh = Math.round(Number(cur.wind_speed_10m ?? 8));
    const snowfallCm = Number(cur.snowfall ?? 0);
    const mapped = mapHokkaidoWmoWeather(code, dayPhase, temp, windKmh, snowfallCm);

    return {
      temp,
      windKmh,
      snowfallCm,
      isDay,
      dayPhase,
      ...mapped,
    };
  } catch {
    return null;
  }
}
