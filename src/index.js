import { importPKCS8, SignJWT } from 'jose';

const LANGUAGES = new Set(['zh', 'zh-hans', 'zh-hant', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']);

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, s-maxage=600, stale-while-revalidate=3600' : 'no-store'
    }
  });
}

function text(value, status = 200) {
  return new Response(value, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': status === 200 ? 'public, s-maxage=600, stale-while-revalidate=3600' : 'no-store'
    }
  });
}

async function createQWeatherClient(env) {
  const { QWEATHER_API_HOST, QWEATHER_KID, QWEATHER_PROJECT_ID, QWEATHER_PRIVATE_KEY } = env;
  if (!QWEATHER_API_HOST || !QWEATHER_KID || !QWEATHER_PROJECT_ID || !QWEATHER_PRIVATE_KEY) {
    throw new Error('Missing QWeather configuration');
  }

  const host = QWEATHER_API_HOST.trim();
  const baseUrl = new URL(host.includes('://') ? host : `https://${host}`);
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) {
    throw new Error('QWEATHER_API_HOST must be an HTTPS API host');
  }

  const privateKey = QWEATHER_PRIVATE_KEY
    .trim()
    .replace(/^(['"])(.*)\1$/s, '$2')
    .replace(/\\r?\\n/g, '\n')
    .replace(/\r\n/g, '\n');
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('QWEATHER_PRIVATE_KEY must contain a PKCS#8 PEM private key beginning with -----BEGIN PRIVATE KEY-----');
  }

  const key = await importPKCS8(privateKey, 'EdDSA');
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sub: QWEATHER_PROJECT_ID, iat: now - 30, exp: now + 900 })
    .setProtectedHeader({ alg: 'EdDSA', kid: QWEATHER_KID })
    .sign(key);
  const headers = { Authorization: `Bearer ${token}` };

  return async function qweather(path, params) {
    const url = new URL(path, baseUrl);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, { headers });
    const data = await response.json();
    if (!response.ok || data.code !== '200') {
      throw new Error(`QWeather ${data.code || response.status}: ${data.message || 'upstream request failed'}`);
    }
    return data;
  };
}

async function locate(qweather, location, lang) {
  const data = await qweather('/geo/v2/city/lookup', { location, lang, number: '1' });
  const result = data.location?.[0];
  if (!result) throw new Error(`Location not found: ${location}`);
  return result;
}

async function getWeather(qweather, location, lang, days) {
  const [now, forecast] = await Promise.all([
    qweather('/v7/weather/now', { location: location.id, lang }),
    qweather(`/v7/weather/${days <= 3 ? '3d' : '7d'}`, { location: location.id, lang })
  ]);
  return { now, forecast };
}

function normalized(location, weather) {
  return {
    location: {
      name: location.name,
      id: location.id,
      country: location.country,
      admin1: location.adm1,
      admin2: location.adm2,
      lat: location.lat,
      lon: location.lon,
      timezone: location.tz
    },
    updateTime: weather.now.updateTime,
    current: weather.now.now,
    daily: weather.forecast.daily,
    source: weather.now.refer
  };
}

function symbol(icon) {
  const code = Number(icon);
  if ([100, 101, 102, 103, 104].includes(code)) return '☀️';
  if ([150, 151, 152, 153].includes(code)) return '🌙';
  if ([300, 301, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318].includes(code)) return '🌧️';
  if ([400, 401, 402, 403, 404, 405, 406, 407].includes(code)) return '🌨️';
  if ([500, 501, 502, 503, 504, 507, 508, 509, 510, 511, 512, 513, 514, 515].includes(code)) return '🌫️';
  if ([200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213].includes(code)) return '💨';
  return '⛅';
}

function formatValue(format, data, location) {
  const current = data.current || {};
  const values = {
    c: symbol(current.icon), C: current.text || '', x: current.text || '', i: current.icon || '',
    t: `${current.temp ?? '--'}°C`, f: `${current.feelsLike ?? '--'}°C`,
    w: `${current.windDir || ''} ${current.windSpeed || '--'} km/h`.trim(),
    h: `${current.humidity ?? '--'}%`, p: `${current.precip ?? '--'} mm`,
    P: `${current.pressure ?? '--'} hPa`, l: location.name, T: current.obsTime || ''
  };
  return format.replace(/%([cCxitfwhpPlT])/g, (_, key) => values[key] ?? `%${key}`).replace(/\\n/g, '\n');
}

function compactText(data, location) {
  const c = data.current;
  return `${location.name}: ${symbol(c.icon)} ${c.temp}°C ${c.windDir} ${c.windSpeed} km/h\n`;
}

function padDisplay(value, width) {
  const text = String(value || '');
  const displayWidth = [...text].reduce((total, char) => total + (char.codePointAt(0) > 0x7f ? 2 : 1), 0);
  return text + ' '.repeat(Math.max(width - displayWidth, 0));
}

function detailedText(data, location) {
  const c = data.current;
  const lines = [
    `天气预报：${location.name}`,
    '',
    `当前：${symbol(c.icon)} ${c.text}  ${c.temp}°C（体感 ${c.feelsLike}°C）`,
    `风况：${c.windDir} ${c.windSpeed} km/h`,
    `湿度：${c.humidity}%  气压：${c.pressure} hPa`,
    '',
    '未来预报：'
  ];
  for (const day of data.daily || []) {
    const condition = padDisplay(day.textDay, 6);
    const wind = padDisplay(day.windDirDay, 6);
    lines.push(`${day.fxDate}  ${symbol(day.iconDay)} ${condition}  ${day.tempMin}..${day.tempMax}°C  ${wind} ${day.windSpeedDay} km/h`);
  }
  return lines.join('\n') + '\n';
}

async function handler(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method Not Allowed\n', 405);
  try {
    const url = new URL(request.url);
    const rawPath = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
    const requestedLocation = rawPath || url.searchParams.get('location');
    const locationInput = requestedLocation || request.cf?.city || '北京';
    const langInput = url.searchParams.get('lang') || 'zh-hans';
    const lang = LANGUAGES.has(langInput) ? langInput : 'zh-hans';
    const qweather = await createQWeatherClient(env);
    let location;
    try {
      location = await locate(qweather, locationInput, lang);
    } catch (error) {
      if (requestedLocation || locationInput === '北京') throw error;
      location = await locate(qweather, '北京', lang);
    }
    const hasDays = url.searchParams.has('days');
    const requestedDays = Number(url.searchParams.get('days') || '3');
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 7) : 3;
    const data = normalized(location, await getWeather(qweather, location, lang, days));
    const format = url.searchParams.get('format');
    if (format === 'j1' || format === 'json') return json(data);
    if (format === 'j2') return json({ location: data.location, current: data.current, daily: data.daily });
    if (format) return text(formatValue(format, data, location));
    return text(hasDays ? detailedText(data, location) : compactText(data, location));
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, 502);
  }
}

export default { fetch: handler };
