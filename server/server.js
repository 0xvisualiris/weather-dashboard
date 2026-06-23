const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app         = express();
const PORT        = 3000;
const DATA_FILE   = '/data/weather.json';
const DAILY_FILE  = '/data/daily.json';
const MAX_HISTORY = 288; // ~24 h at 5-min intervals

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let latestData     = null;
let dataHistory    = [];
let dailySummaries = [];
let dayAccum       = null;

// ── Unit converters ──────────────────────────────────────────
const toC   = f    => f    != null ? Math.round((parseFloat(f) - 32) * 5 / 9 * 10) / 10 : null;
const toKmh = mph  => mph  != null ? Math.round(parseFloat(mph) * 1.60934 * 10) / 10    : null;
const toMm  = inch => inch != null ? Math.round(parseFloat(inch) * 25.4 * 10) / 10      : null;
const toHpa = inhg => inhg != null ? Math.round(parseFloat(inhg) * 33.8639 * 10) / 10   : null;
const toNum = v    => v    != null ? parseFloat(v)   : null;
const toInt = v    => v    != null ? parseInt(v, 10) : null;

// Safe field accessor — accepts string or number from body
const field = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== '') return v;
  }
  return null;
};

// ── Date helper (Europe/Berlin) ───────────────────────────────
function getDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

// ── Daily accumulator ─────────────────────────────────────────
function newAccum(date) {
  return {
    date, n: 0,
    tempSum: 0, tempMin: null, tempMax: null,
    humiSum: 0,
    windSum: 0, windMax: 0,
    rainMax: 0,
    uvSum: 0,
    solarSum: 0, solarMax: 0,
    pressSum: 0, pressMin: null, pressMax: null,
    lightning: 0,
  };
}

function addToAccum(a, d) {
  a.n++;
  if (d.outdoor.temp != null) {
    a.tempSum += d.outdoor.temp;
    a.tempMin  = a.tempMin === null ? d.outdoor.temp : Math.min(a.tempMin, d.outdoor.temp);
    a.tempMax  = a.tempMax === null ? d.outdoor.temp : Math.max(a.tempMax, d.outdoor.temp);
  }
  if (d.outdoor.humidity  != null) a.humiSum  += d.outdoor.humidity;
  if (d.wind.speed        != null) { a.windSum += d.wind.speed; a.windMax = Math.max(a.windMax, d.wind.speed); }
  if (d.rain.daily        != null) a.rainMax   = Math.max(a.rainMax, d.rain.daily);
  if (d.solar.uv          != null) a.uvSum     += d.solar.uv;
  if (d.solar.radiation   != null) { a.solarSum += d.solar.radiation; a.solarMax = Math.max(a.solarMax, d.solar.radiation); }
  if (d.pressure?.relative != null) {
    a.pressSum += d.pressure.relative;
    a.pressMin  = a.pressMin === null ? d.pressure.relative : Math.min(a.pressMin, d.pressure.relative);
    a.pressMax  = a.pressMax === null ? d.pressure.relative : Math.max(a.pressMax, d.pressure.relative);
  }
  if (d.lightning.count   != null) a.lightning = Math.max(a.lightning, d.lightning.count);
}

function finalizeAccum(a) {
  if (!a || a.n === 0) return null;
  return {
    date:          a.date,
    outTemp:       +(a.tempSum  / a.n).toFixed(1),
    outTempMin:    a.tempMin,
    outTempMax:    a.tempMax,
    outHumi:       Math.round(a.humiSum / a.n),
    windSpeed:     +(a.windSum  / a.n).toFixed(1),
    windSpeedMax:  a.windMax,
    rainDaily:     a.rainMax,
    uvIndex:       +(a.uvSum    / a.n).toFixed(1),
    solarRad:      Math.round(a.solarSum / a.n),
    solarRadMax:   a.solarMax,
    pressure:      a.n > 0 ? +(a.pressSum / a.n).toFixed(1) : null,
    pressureMin:   a.pressMin,
    pressureMax:   a.pressMax,
    lightningCount: a.lightning,
  };
}

function saveDailySummaries() {
  try { fs.writeFileSync(DAILY_FILE, JSON.stringify(dailySummaries)); } catch (_) {}
}

// ── Ecowitt push receiver ─────────────────────────────────────
// Station config: Protocol=Ecowitt, Path=/data/report/, Port=3000
app.post('/data/report/', (req, res) => {
  const r = req.body;
  const today = getDateStr();

  latestData = {
    timestamp: new Date().toISOString(),
    outdoor: {
      temp:     toC(field(r, 'tempf')),
      humidity: toInt(field(r, 'humidity')),
    },
    wind: {
      speed:        toKmh(field(r, 'windspeedmph')),
      gust:         toKmh(field(r, 'windgustmph')),
      maxDailyGust: toKmh(field(r, 'maxdailygust')),
      direction:    toInt(field(r, 'winddir')),
    },
    rain: {
      // Accept multiple field-name variants sent by different Ecowitt gateway firmware versions
      rate:    toMm(field(r, 'rainratein',   'rain_rate',   'rainrate')),
      event:   toMm(field(r, 'eventrainin',  'rain_event')),
      hourly:  toMm(field(r, 'hourlyrainin', 'rain_hour')),
      daily:   toMm(field(r, 'dailyrainin',  'rain_day',    'rain_daily')),
      weekly:  toMm(field(r, 'weeklyrainin', 'rain_week')),
      monthly: toMm(field(r, 'monthlyrainin','rain_month')),
      total:   toMm(field(r, 'totalrainin',  'rain_total')),
    },
    solar: {
      radiation: field(r, 'solarradiation') != null
        ? Math.round(parseFloat(field(r, 'solarradiation')))
        : null,
      uv: toNum(field(r, 'uv')),
    },
    pressure: {
      relative: toHpa(field(r, 'baromrelin', 'barometrelin')),
      absolute: toHpa(field(r, 'baromabsin', 'barometreabs')),
    },
    lightning: {
      count:    toInt(field(r, 'lightning_num')),
      distance: toInt(field(r, 'lightning')),
      lastTime: field(r, 'lightning_time')
        ? new Date(parseInt(field(r, 'lightning_time'), 10) * 1000).toISOString()
        : null,
    },
  };

  // Daily accumulator — roll over at midnight
  if (!dayAccum) {
    dayAccum = newAccum(today);
  } else if (dayAccum.date !== today) {
    const summary = finalizeAccum(dayAccum);
    if (summary) {
      dailySummaries = dailySummaries.filter(s => s.date !== summary.date);
      dailySummaries.push(summary);
      dailySummaries.sort((a, b) => a.date.localeCompare(b.date));
      saveDailySummaries();
    }
    dayAccum = newAccum(today);
  }
  addToAccum(dayAccum, latestData);

  dataHistory.push({ ...latestData });
  if (dataHistory.length > MAX_HISTORY) dataHistory.shift();

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ latest: latestData, history: dataHistory, dayAccum }));
  } catch (_) {}

  res.send('OK');
});

// ── API ───────────────────────────────────────────────────────
app.get('/api/weather', (_req, res) => {
  if (!latestData) return res.status(503).json({ error: 'No data received yet' });
  res.json({
    ...latestData,
    today: {
      tempMin:     dayAccum?.tempMin   ?? null,
      tempMax:     dayAccum?.tempMax   ?? null,
      solarMax:    dayAccum?.solarMax  ?? null,
      rainTotal:   dayAccum?.rainMax   ?? null,
      pressureMin: dayAccum?.pressMin  ?? null,
      pressureMax: dayAccum?.pressMax  ?? null,
    },
  });
});

// Lightweight payload for sparklines (last 24 h)
app.get('/api/sparklines', (_req, res) => {
  res.json(dataHistory.map(d => ({
    t: d.outdoor.temp,
    h: d.outdoor.humidity,
    w: d.wind.speed,
    r: d.rain.rate,
    u: d.solar.uv,
    s: d.solar.radiation,
    l: d.lightning.count,
    p: d.pressure?.relative ?? null,
  })));
});

app.get('/api/history', (_req, res) => {
  res.json(dataHistory.slice(-48));
});

app.get('/api/daily', (req, res) => {
  const { from, to } = req.query;
  let result = [...dailySummaries];
  if (dayAccum && dayAccum.n > 0) {
    const partial = finalizeAccum(dayAccum);
    if (partial) {
      result = result.filter(s => s.date !== partial.date);
      result.push(partial);
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  if (from) result = result.filter(d => d.date >= from);
  if (to)   result = result.filter(d => d.date <= to);
  res.json(result);
});

// ── Startup ───────────────────────────────────────────────────
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    latestData  = saved.latest   || null;
    dataHistory = saved.history  || [];
    dayAccum    = saved.dayAccum || null;
    console.log(`Loaded ${dataHistory.length} recent readings`);
  }
} catch (e) { console.warn('Could not load weather.json:', e.message); }

try {
  if (fs.existsSync(DAILY_FILE)) {
    dailySummaries = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8'));
    console.log(`Loaded ${dailySummaries.length} daily summaries`);
  }
} catch (e) { console.warn('Could not load daily.json:', e.message); }

app.listen(PORT, () => {
  console.log(`Weather dashboard on http://0.0.0.0:${PORT}`);
  console.log(`Waiting for Ecowitt push on POST /data/report/`);
});
