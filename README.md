# Private Vibecoded Dashboard.

# Wetterstation Gründau – Self-hosted Dashboard

Empfängt Daten per **Ecowitt Local Push** und stellt sie als öffentliches Dashboard bereit.

## Voraussetzungen

- Docker & Docker Compose auf deinem Server (TrueNAS Scale, Raspberry Pi, etc.)
- Ecowitt-Station im selben Netzwerk

---

## 1. Stack starten

```bash
cd weather-dashboard
docker compose up -d
```

Das Dashboard ist dann erreichbar unter:
`http://<SERVER-IP>:3000`

---

## 2. Wetterstation konfigurieren

Öffne die **WS View Plus**-App (iOS/Android):

1. Gerät auswählen → **Mehr** → **Upload to Customized Server**
2. Einstellungen:

| Feld              | Wert                     |
|-------------------|--------------------------|
| Protocol Type     | **Ecowitt**              |
| Server IP / Host  | `<deine Server-IP>`      |
| Path              | `/data/report/`          |
| Port              | `3000`                   |
| Upload interval   | `60` (Sekunden)          |

3. Speichern – nach max. 60 Sekunden erscheinen die ersten Daten.

---

## 3. Für Nachbarn freigeben (via Nginx Proxy Manager)

Da du NPM bereits betreibst, einfach einen neuen Proxy Host anlegen:

- **Domain:** `wetter.deine-domain.de`
- **Forward IP:** `<SERVER-IP>`
- **Port:** `3000`
- SSL-Zertifikat aktivieren

Die URL `https://wetter.deine-domain.de` kannst du dann teilen.

---

## API-Endpunkte

| Endpunkt        | Beschreibung                          |
|-----------------|---------------------------------------|
| `GET /`         | Dashboard (HTML)                      |
| `GET /api/weather` | Aktuellster Datensatz (JSON)       |
| `GET /api/history` | Letzte ~4 Stunden (JSON-Array)    |
| `POST /data/report/` | Ecowitt Push-Empfänger          |

---

## Sensoren

| Sensor        | Einheit   | Ecowitt-Feld           |
|---------------|-----------|------------------------|
| Außen-Temp    | °C        | `tempf` (°F → °C)      |
| Außen-Feuchte | %         | `humidity`             |
| Innen-Temp    | °C        | `tempinf`              |
| Innen-Feuchte | %         | `humidityin`           |
| Windgeschw.   | km/h      | `windspeedmph`         |
| Windböe       | km/h      | `windgustmph`          |
| Windrichtung  | °         | `winddir`              |
| Regen Rate    | mm/h      | `rainratein`           |
| Regen Heute   | mm        | `dailyrainin`          |
| UV-Index      | —         | `uv`                   |
| Solarstrahlung| W/m²      | `solarradiation`       |
| Blitze Heute  | Anzahl    | `lightning_num`        |
| Blitz Distanz | km        | `lightning`            |

Daten werden unter `/data/weather.json` (Docker-Volume) persistiert und überleben Neustarts.
