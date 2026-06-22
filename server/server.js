const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app         = express();
const PORT        = 3000;
const DATA_FILE   = '/data/weather.json';
const DAILY_FILE  = '/data/daily.json';
const MAX_HISTORY = 288; // ~24h at 5-min intervals

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
const toNum = v    => v    != null ? parseFloat(v)   : null;
const toInt = v    => v    != null ? parseInt(v, 10) : null;

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
  if (d.lightning.count   != null) a.lightning  = Math.max(a.lightning, d.lightning.count);
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
    lightningCount: a.lightning,
  };
}

function saveDailySummaries() {
  try { fs.writeFileSync(DAILY_FILE, JSON.stringify(dailySummaries)); } catch (_) {}
}

// ── Receive push from Ecowitt station ────────────────────────
app.post('/data/report/', (req, res) => {
  const r = req.body;
  const today = getDateStr();

  latestData = {
    timestamp: new Date().toISOString(),
    outdoor: { temp: toC(r.tempf), humidity: toInt(r.humidity) },
    wind: {
      speed:        toKmh(r.windspeedmph),
      gust:         toKmh(r.windgustmph),
      maxDailyGust: toKmh(r.maxdailygust),
      direction:    toInt(r.winddir),
    },
    rain: {
      rate:    toMm(r.rainratein),
      event:   toMm(r.eventrainin),
      hourly:  toMm(r.hourlyrainin),
      daily:   toMm(r.dailyrainin),
      weekly:  toMm(r.weeklyrainin),
      monthly: toMm(r.monthlyrainin),
      total:   toMm(r.totalrainin),
    },
    solar: {
      radiation: r.solarradiation != null ? Math.round(parseFloat(r.solarradiation)) : null,
      uv:        toNum(r.uv),
    },
    lightning: {
      count:    toInt(r.lightning_num),
      distance: toInt(r.lightning),
      lastTime: r.lightning_time ? new Date(parseInt(r.lightning_time, 10) * 1000).toISOString() : null,
    },
  };

  // Daily accumulator
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

// ── API endpoints ─────────────────────────────────────────────
app.get('/api/weather', (_req, res) => {
  if (!latestData) return res.status(503).json({ error: 'Noch keine Daten empfangen' });
  res.json({
    ...latestData,
    today: {
      tempMin:   dayAccum?.tempMin   ?? null,
      tempMax:   dayAccum?.tempMax   ?? null,
      solarMax:  dayAccum?.solarMax  ?? null,
      rainTotal: dayAccum?.rainMax   ?? null,
    },
  });
});

// Lightweight endpoint for sparklines (last 24h, minimal payload)
app.get('/api/sparklines', (_req, res) => {
  res.json(dataHistory.map(d => ({
    t: d.outdoor.temp,
    h: d.outdoor.humidity,
    w: d.wind.speed,
    r: d.rain.rate,
    u: d.solar.uv,
    s: d.solar.radiation,
    l: d.lightning.count,
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

// ── Load persisted data on startup ───────────────────────────
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    latestData  = saved.latest   || null;
    dataHistory = saved.history  || [];
    dayAccum    = saved.dayAccum || null;
    console.log(`Loaded ${dataHistory.length} recent readings from disk`);
  }
} catch (e) { console.warn('Could not load weather.json:', e.message); }

try {
  if (fs.existsSync(DAILY_FILE)) {
    dailySummaries = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8'));
    console.log(`Loaded ${dailySummaries.length} daily summaries from disk`);
  }
} catch (e) { console.warn('Could not load daily.json:', e.message); }

app.listen(PORT, () => {
  console.log(`Weather dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`Waiting for Ecowitt push on POST /data/report/`);
});
