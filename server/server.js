const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_FILE = '/data/weather.json';
// Keep last 288 readings = ~24h at 5-min intervals
const MAX_HISTORY = 288;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let latestData = null;
let dataHistory = [];

// --- Unit converters ---
const toC    = f    => f    != null ? Math.round((parseFloat(f) - 32) * 5 / 9 * 10) / 10 : null;
const toKmh  = mph  => mph  != null ? Math.round(parseFloat(mph) * 1.60934 * 10) / 10   : null;
const toMm   = inch => inch != null ? Math.round(parseFloat(inch) * 25.4 * 10) / 10     : null;
const toNum  = v    => v    != null ? parseFloat(v)  : null;
const toInt  = v    => v    != null ? parseInt(v, 10): null;

// --- Receive data from Ecowitt station (Ecowitt protocol) ---
// Configure station: Protocol=Ecowitt, Path=/data/report/, Port=3000
app.post('/data/report/', (req, res) => {
  const r = req.body;

  latestData = {
    timestamp: new Date().toISOString(),
    indoor: {
      temp:     toC(r.tempinf),
      humidity: toInt(r.humidityin),
    },
    outdoor: {
      temp:     toC(r.tempf),
      humidity: toInt(r.humidity),
    },
    wind: {
      speed:       toKmh(r.windspeedmph),
      gust:        toKmh(r.windgustmph),
      maxDailyGust:toKmh(r.maxdailygust),
      direction:   toInt(r.winddir),
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

  dataHistory.push({ ...latestData });
  if (dataHistory.length > MAX_HISTORY) dataHistory.shift();

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ latest: latestData, history: dataHistory }));
  } catch (_) {}

  res.send('OK');
});

// --- API endpoints ---
app.get('/api/weather', (_req, res) => {
  if (!latestData) return res.status(503).json({ error: 'Noch keine Daten empfangen' });
  res.json(latestData);
});

app.get('/api/history', (_req, res) => {
  // Return last 4 hours (48 readings at 5-min intervals)
  res.json(dataHistory.slice(-48));
});

// --- Load persisted data on startup ---
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    latestData   = saved.latest  || null;
    dataHistory  = saved.history || [];
    console.log(`Loaded ${dataHistory.length} historical readings from disk`);
  }
} catch (e) {
  console.warn('Could not load saved data:', e.message);
}

app.listen(PORT, () => {
  console.log(`Weather dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`Waiting for Ecowitt push on POST /data/report/`);
});
