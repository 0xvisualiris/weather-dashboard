# 🌤 Weather Station Gründau

> **Hobby project · 100% vibecoded · not actively maintained**
>
> This project was built in my spare time and is not regularly maintained. It runs reliably for me — but I'll only respond to issues and pull requests when I have time.

![Dashboard Screenshot](./screenshot.png)

---

## What this dashboard shows

A self-hosted weather dashboard for Ecowitt weather stations using local HTTP push. No cloud, no external services — all data stays on your own network.

**Live view (updates every 30 seconds):**

- **Hero banner** — current weather condition (sunny / cloudy / rain / thunderstorm), temperature, feels-like temperature, daily min/max, dew point, sunrise and sunset times
- **Outdoor temperature** — with humidity, feels-like temperature and dew point
- **Wind** — compass needle, speed, gusts, Beaufort scale with plain-text description
- **Precipitation** — current rate, event total, daily/weekly/monthly totals, intensity badge
- **Lightning** — strike count today, distance and time of last strike
- **UV & Solar radiation** — UV index with color scale, solar radiation in W/m², daily maximum
- **Mini sparklines** — 24h trend line at the bottom of each card

**Historical view (click the chart icon on any card):**

- Date picker with freely selectable start and end date
- Quick selection: 7 days · 30 days · 3 months · All
- Dual-axis charts (e.g. temperature °C + humidity % at the same time)
- Daily averages are saved automatically and survive container restarts

---

## Requirements

- Docker & Docker Compose
- Ecowitt weather station with gateway (GW1000, GW2000, HP2553, etc.) on the same network

---

## Installation

```bash
git clone https://github.com/0xvisualiris/weather-dashboard.git
cd weather-dashboard
docker compose up -d
```

The dashboard will then be available at:

```
http://<SERVER-IP>:3000
```

For external access (e.g. to share with neighbours), add a reverse proxy entry in Nginx Proxy Manager:

- **Forward Hostname/IP:** `<SERVER-IP>`
- **Port:** `3000`
- Enable SSL certificate

---

## Ecowitt gateway configuration

Open the **WS View Plus** app (iOS / Android):

1. Select your device → **More** → **Upload to Customized Server**
2. Enter the following settings:

| Field             | Value                    |
|-------------------|--------------------------|
| Protocol Type     | **Ecowitt**              |
| Server IP / Host  | `<your server IP>`       |
| Path              | `/data/report/`          |
| Port              | `3000`                   |
| Upload interval   | `60` (seconds)           |

3. Save — data will appear within 60 seconds.

---

## Supported sensors

| Sensor               | Unit  | Ecowitt field     |
|----------------------|-------|-------------------|
| Outdoor temperature  | °C    | `tempf`           |
| Outdoor humidity     | %     | `humidity`        |
| Wind speed           | km/h  | `windspeedmph`    |
| Wind gust            | km/h  | `windgustmph`     |
| Wind direction       | °     | `winddir`         |
| Rain rate            | mm/h  | `rainratein`      |
| Daily rain           | mm    | `dailyrainin`     |
| UV index             | —     | `uv`              |
| Solar radiation      | W/m²  | `solarradiation`  |
| Lightning count      | count | `lightning_num`   |
| Lightning distance   | km    | `lightning`       |
| Last lightning       | Unix  | `lightning_time`  |

---

## Data storage

All data is stored locally in a Docker volume:

| File                 | Contents                                    |
|----------------------|---------------------------------------------|
| `/data/weather.json` | Latest reading + last 24h                   |
| `/data/daily.json`   | Daily averages since first data received    |

---

## API

| Endpoint                   | Description                                  |
|----------------------------|----------------------------------------------|
| `GET /api/weather`         | Latest reading including today's min/max     |
| `GET /api/sparklines`      | Last 24h (lightweight payload)               |
| `GET /api/history`         | Last ~4 hours (raw readings)                 |
| `GET /api/daily?from=&to=` | Daily averages filtered by date range        |
| `POST /data/report/`       | Ecowitt push receiver                        |
