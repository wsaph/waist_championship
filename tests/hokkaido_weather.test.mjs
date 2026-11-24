import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOKKAIDO_SAPPORO_COORDS,
  fetchHokkaidoHybridWeather,
  getBangkokDayPhase,
  mapHokkaidoWmoWeather,
} from '../lib/hokkaido_weather.ts';
import { resolveIslandWeatherTargets } from '../festivals/schedule.ts';

test('getBangkokDayPhase resolves dawn, day, dusk, and night strictly in Thailand time (UTC+7)', () => {
  assert.equal(getBangkokDayPhase(Date.parse('2026-12-15T06:30:00+07:00')), 'dawn');
  assert.equal(getBangkokDayPhase(Date.parse('2026-12-15T12:15:00+07:00')), 'day');
  assert.equal(getBangkokDayPhase(Date.parse('2026-12-15T17:45:00+07:00')), 'dusk');
  assert.equal(getBangkokDayPhase(Date.parse('2026-12-15T20:00:00+07:00')), 'night');
  assert.equal(getBangkokDayPhase(Date.parse('2026-12-15T02:10:00+07:00')), 'night');
});

test('mapHokkaidoWmoWeather classifies Hokkaido snowfall, blizzard, diamond dust, and cold rain', () => {
  // Light snow in daytime
  const lightSnow = mapHokkaidoWmoWeather(71, 'day', -3, 12, 0.2);
  assert.equal(lightSnow.condition, 'snow');
  assert.equal(lightSnow.emoji, '❄️');

  // Heavy snow code -> blizzard
  const heavySnow = mapHokkaidoWmoWeather(75, 'dusk', -6, 15, 0.8);
  assert.equal(heavySnow.condition, 'blizzard');
  assert.equal(heavySnow.emoji, '🌨️');

  // Light snow + strong Hokkaido gale (>= 28 km/h) -> blizzard
  const windySnow = mapHokkaidoWmoWeather(71, 'night', -4, 32, 0.1);
  assert.equal(windySnow.condition, 'blizzard');

  // Freezing drizzle at <= 1°C -> treated as snow
  const freezingPrecip = mapHokkaidoWmoWeather(61, 'day', 0, 10, 0);
  assert.equal(freezingPrecip.condition, 'snow');

  // Above-freezing rain -> rain
  const coldRain = mapHokkaidoWmoWeather(61, 'day', 6, 10, 0);
  assert.equal(coldRain.condition, 'rain');

  // Sub-zero clear daytime -> Diamond Dust clear
  const subZeroClear = mapHokkaidoWmoWeather(0, 'day', -5, 6, 0);
  assert.equal(subZeroClear.condition, 'clear');
  assert.equal(subZeroClear.emoji, '✨');
});

test('fetchHokkaidoHybridWeather combines Sapporo Open-Meteo metrics with Thailand clock phase', async () => {
  // 18:15 Thailand time = dusk in Thailand (even though Sapporo is 20:15 night!)
  const thaiDuskMs = Date.parse('2026-12-20T18:15:00+07:00');
  let requestedUrl = '';

  const fakeFetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: -4.2,
          weather_code: 71,
          snowfall: 0.25,
          wind_speed_10m: 14.4,
        },
      }),
    };
  };

  const snap = await fetchHokkaidoHybridWeather(thaiDuskMs, fakeFetch);
  assert.ok(requestedUrl.includes(String(HOKKAIDO_SAPPORO_COORDS.latitude)));
  assert.ok(requestedUrl.includes(String(HOKKAIDO_SAPPORO_COORDS.longitude)));
  assert.ok(snap);
  assert.equal(snap.dayPhase, 'dusk');
  assert.equal(snap.isDay, true);
  assert.equal(snap.temp, -4);
  assert.equal(snap.windKmh, 14);
  assert.equal(snap.condition, 'snow');
});

test('resolveIslandWeatherTargets computes snow, blizzard fog, diamond dust, and festival overrides', () => {
  const blizzardTargets = resolveIslandWeatherTargets({
    temp: -7,
    windKmh: 35,
    snowfallCm: 0.9,
    isDay: true,
    dayPhase: 'day',
    condition: 'blizzard',
    label: 'พายุหิมะฮอกไกโด',
    emoji: '🌨️',
  });
  assert.equal(blizzardTargets.isSnowing, true);
  assert.equal(blizzardTargets.isBlizzard, true);
  assert.equal(blizzardTargets.isRaining, false);
  assert.ok(blizzardTargets.fogDensity > 0.007);

  const diamondDustTargets = resolveIslandWeatherTargets({
    temp: -3,
    windKmh: 5,
    snowfallCm: 0,
    isDay: true,
    dayPhase: 'day',
    condition: 'clear',
    label: 'ฟ้าใสหนาวจัด (Diamond Dust)',
    emoji: '✨',
  });
  assert.equal(diamondDustTargets.isDiamondDust, true);
  assert.equal(diamondDustTargets.isSnowing, false);

  const festOverride = resolveIslandWeatherTargets(null, {
    skyHex: 0x08122e,
    lightHex: 0xfef3c7,
    hemiIntensity: 0.68,
    dirIntensity: 0.88,
    isRaining: false,
    showNightSky: true,
  });
  assert.equal(festOverride.showNight, true);
  assert.equal(festOverride.isSnowing, false);
});
