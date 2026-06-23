# Wetterstation Gründau 🌦️

A self-hosted personal weather dashboard for my Ecowitt weather station in my village.

> **⚠️ Heads up:** This is a 100% vibecoded hobby project built entirely with AI assistance. I'm not a professional developer and I'm not actively maintaining this. I built it to learn how AI can help with coding — it's a fun experiment, not production software. Use it, fork it, break it — all good.

---

## What it is

A lightweight Node.js dashboard that receives live data pushed from an Ecowitt weather station gateway and displays it in a dark-mode web interface. It also pulls in data from the nearest official DWD (Deutscher Wetterdienst) station via the free Bright Sky API.

Runs entirely on your local network or behind a reverse proxy — no cloud accounts, no subscriptions, no external services except the free Bright Sky API for DWD data.

---

## Features

### Ecowitt station (your own hardware)
- **Outdoor temperature** — current, feels-like, dew point, daily min/max
- **Wind** — speed, gust, direction (compass rose + Beaufort scale)
- **Precipitation** — current rate, event total, today / week / month
- **Lightning** — strike count, distance, last strike time (requires WH57 sensor)
- **Air pressure** — relative (sea-level corrected) and absolute, trend arrow
- **UV & Solar radiation** — UV index with category, radiation in W/m²

### DWD open data (nearest official station)
- Current temperature, humidity, dew point
- Wind speed, gust, direction
- Precipitation (last 60 / 30 min), sunshine
- Air pressure (sea-level)
- Visibility and cloud cover
- Station name and distance resolved automatically via coordinates — no hardcoded station ID

### Alerts
- DWD weather warnings fetched by GPS coordinates
- Always-visible status bar — green ✅ when no warnings, expandable ⚠️ banner when active
- Includes heat warnings (Wärmebelastung) and standard severe weather alerts

### Rain radar
- Live DWD RADOLAN radar overlay on an OpenStreetMap base (Leaflet)
- Markers for your Ecowitt station and the nearest DWD station

### History & charts
- 24-hour sparklines on every card
- Full history charts (7 / 30 / 90 days / all) for all sensors
- Daily summaries stored locally — temperature min/max/avg, rain total, wind, UV, pressure, lightning

### UI
- Dark mode only
- German / English language toggle (persisted across reloads)
- Active tab persisted across page reloads
- Responsive — works on desktop and mobile
- PWA manifest — installable as a home screen app
- Custom weather icon / logo (SVG, used as favicon and in header)

---

## Tech stack

| Layer | What |
|-------|------|
| Backend | Node.js + Express |
| Data source 1 | Ecowitt HTTP push (local network) |
| Data source 2 | [Bright Sky API](https://brightsky.dev) — free, CORS-enabled, no key needed |
| Frontend | Vanilla HTML/CSS/JS, Chart.js, Leaflet |
| Deploy | Docker → GitHub Actions → ghcr.io → Watchtower |

---

## Requirements

- Docker (tested on TrueNAS Scale, works anywhere Docker runs)
- An Ecowitt weather station gateway (GW1000, GW1100, GW2000, HP2553, WS View Plus app, or similar)
- A server on the same local network as the gateway, or accessible via a domain

---

## Installation

### 1. Clone or download

```bash
git clone https://github.com/0xvisualiris/weather-dashboard.git
cd weather-dashboard
```

### 2. Configure docker-compose

Edit `docker-compose.yml` if you want to change the port (default: `3000`):

```yaml
services:
  wetterstation:
    image: ghcr.io/0xvisualiris/weather-dashboard:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data      # persistent storage for history
    restart: unless-stopped
```

### 3. Start the container

```bash
docker compose up -d
```

Open `http://<your-server-ip>:3000` in your browser. You'll see "No data received yet" until the Ecowitt gateway starts pushing.

### 4. Persistent data

Weather history and daily summaries are stored in `/data` inside the container, mapped to `./data` on the host. This folder persists across container restarts and updates.

---

## Ecowitt Gateway Configuration

The dashboard receives data via **Ecowitt's local HTTP push** feature. You configure this in the **WS View Plus** app (or WS Tool / EasyWeather, depending on your model).

### Step-by-step

1. Open the **WS View Plus** app on your phone
2. Go to **My Devices** → tap your gateway → **Settings**
3. Scroll to **Weather Services** → **Customized**
4. Set the following:

   | Field | Value |
   |-------|-------|
   | **Protocol** | Ecowitt |
   | **Server IP / Hostname** | IP address of the machine running Docker |
   | **Path** | `/data/report/` |
   | **Port** | `3000` (or whatever port you chose) |
   | **Upload Interval** | `60` seconds (recommended) |

5. Save — the gateway starts pushing data within one interval

### Supported sensors

The dashboard automatically picks up any of these if connected to your gateway:

| Sensor | Data |
|--------|------|
| Main gateway (GW1000/GW2000/etc.) | Barometric pressure, indoor temp/humi |
| Outdoor sensor (WH65, WS90, etc.) | Temp, humidity, wind, UV, solar radiation |
| Rain gauge (built-in or WH40) | Rain rate, daily/weekly/monthly totals |
| Lightning sensor (WH57) | Strike count, distance, last strike time |

Multiple field-name variants are accepted to handle different firmware versions sending slightly different field names.

---

## Auto-update (optional)

The included `docker-compose.yml` works with **Watchtower** for automatic updates when a new image is pushed to the registry:

```bash
# If you don't have Watchtower running already:
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower --interval 300
```

Watchtower polls for new images every 5 minutes and restarts the container if one is found.

---

## Docker logs

Useful for debugging. Every Ecowitt push and DWD API call is logged:

```
[Server   ] 2026-06-23 10:38:01 ✓ Wetterstation Gründau · Port 3000
[Ecowitt  ] 2026-06-23 10:39:14 ✓ Temp:23.4°C  Humi:61%  Wind:12.6km/h SW  Rain:0.0mm/h  Druck:1014.2hPa  UV:5.2
[DWD-Curr ] 2026-06-23 10:40:02 → GET brightsky.dev/current_weather
[DWD-Curr ] 2026-06-23 10:40:02 ✓ 200 OK (312ms)
[DWD-Alert] 2026-06-23 10:40:03 ⚠ WÄRMEBELASTUNG (Moderate) bis 20:00
[Daily    ] 2026-06-23 00:00:01 ✓ Abschluss 2026-06-22: Ø21.3°C  Max:28.4°C  Min:14.7°C  Regen:11.5mm  n:288
```

```bash
docker compose logs -f
```
---

## License

Do whatever you want with this. MIT.

---

*Built with ❤️ and a lot of Claude.*
