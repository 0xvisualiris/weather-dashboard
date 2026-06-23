const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app         = express();
const PORT        = 3000;
const DATA_FILE   = '/data/weather.json';
const DAILY_FILE  = '/data/daily.json';

const STATION_LAT = 50.237;
const STATION_LON = 9.158;
const BRIGHTSKY   = 'https://api.brightsky.dev';

// ── Logging ───────────────────────────────────────────────────
function ts() { return new Date().toISOString().replace('T',' ').slice(0,19); }
function log(tag, msg)  { console.log(`[${tag.padEnd(9)}] ${ts()} ${msg}`); }
const logOk  = (t,m) => log(t, `✓ ${m}`);
const logErr = (t,m) => log(t, `✗ ${m}`);
const logWarn= (t,m) => log(t, `⚠ ${m}`);
const logInfo= (t,m) => log(t, `→ ${m}`);

// ── Unit converters ───────────────────────────────────────────
const toC   = f    => f    != null ? Math.round((parseFloat(f)-32)*5/9*10)/10 : null;
const toKmh = mph  => mph  != null ? Math.round(parseFloat(mph)*1.60934*10)/10 : null;
const toMm  = inch => inch != null ? Math.round(parseFloat(inch)*25.4*10)/10 : null;
const toHpa = inhg => inhg != null ? Math.round(parseFloat(inhg)*33.8639*10)/10 : null;
const toNum = v    => v    != null ? parseFloat(v) : null;
const toInt = v    => v    != null ? parseInt(v,10) : null;
const DIR16 = ['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const degToDir = d => d!=null ? DIR16[Math.round(d/22.5)%16] : '';
const field = (obj,...keys) => { for(const k of keys){const v=obj[k];if(v!==undefined&&v!=='')return v;} return null; };

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let latestData=null, dataHistory=[], dailySummaries=[], dayAccum=null;

function getDateStr() { return new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Berlin'}); }

function newAccum(date) {
  return {date,n:0,tempSum:0,tempMin:null,tempMax:null,humiSum:0,windSum:0,windMax:0,
          rainMax:0,uvSum:0,solarSum:0,solarMax:0,pressSum:0,pressMin:null,pressMax:null,lightning:0};
}
function addToAccum(a,d) {
  a.n++;
  if(d.outdoor.temp!=null){a.tempSum+=d.outdoor.temp;a.tempMin=a.tempMin===null?d.outdoor.temp:Math.min(a.tempMin,d.outdoor.temp);a.tempMax=a.tempMax===null?d.outdoor.temp:Math.max(a.tempMax,d.outdoor.temp);}
  if(d.outdoor.humidity!=null)a.humiSum+=d.outdoor.humidity;
  if(d.wind.speed!=null){a.windSum+=d.wind.speed;a.windMax=Math.max(a.windMax,d.wind.speed);}
  if(d.rain.daily!=null)a.rainMax=Math.max(a.rainMax,d.rain.daily);
  if(d.solar.uv!=null)a.uvSum+=d.solar.uv;
  if(d.solar.radiation!=null){a.solarSum+=d.solar.radiation;a.solarMax=Math.max(a.solarMax,d.solar.radiation);}
  if(d.pressure?.relative!=null){a.pressSum+=d.pressure.relative;a.pressMin=a.pressMin===null?d.pressure.relative:Math.min(a.pressMin,d.pressure.relative);a.pressMax=a.pressMax===null?d.pressure.relative:Math.max(a.pressMax,d.pressure.relative);}
  if(d.lightning.count!=null)a.lightning=Math.max(a.lightning,d.lightning.count);
}
function finalizeAccum(a) {
  if(!a||a.n===0)return null;
  return {date:a.date,outTemp:+(a.tempSum/a.n).toFixed(1),outTempMin:a.tempMin,outTempMax:a.tempMax,
          outHumi:Math.round(a.humiSum/a.n),windSpeed:+(a.windSum/a.n).toFixed(1),windSpeedMax:a.windMax,
          rainDaily:a.rainMax,uvIndex:+(a.uvSum/a.n).toFixed(1),solarRad:Math.round(a.solarSum/a.n),
          solarRadMax:a.solarMax,pressure:+(a.pressSum/a.n).toFixed(1),pressureMin:a.pressMin,
          pressureMax:a.pressMax,lightningCount:a.lightning};
}
function saveDailySummaries() {
  try{fs.writeFileSync(DAILY_FILE,JSON.stringify(dailySummaries));}
  catch(e){logErr('Daily',`Speicherfehler: ${e.message}`);}
}

// ── Ecowitt push ──────────────────────────────────────────────
app.post('/data/report/', (req,res) => {
  const r=req.body, today=getDateStr();
  latestData={
    timestamp:new Date().toISOString(),
    outdoor:{temp:toC(field(r,'tempf')),humidity:toInt(field(r,'humidity'))},
    wind:{speed:toKmh(field(r,'windspeedmph')),gust:toKmh(field(r,'windgustmph')),maxDailyGust:toKmh(field(r,'maxdailygust')),direction:toInt(field(r,'winddir'))},
    rain:{rate:toMm(field(r,'rainratein','rain_rate','rainrate')),event:toMm(field(r,'eventrainin','rain_event')),hourly:toMm(field(r,'hourlyrainin','rain_hour')),daily:toMm(field(r,'dailyrainin','rain_day','rain_daily')),weekly:toMm(field(r,'weeklyrainin','rain_week')),monthly:toMm(field(r,'monthlyrainin','rain_month')),total:toMm(field(r,'totalrainin','rain_total'))},
    solar:{radiation:field(r,'solarradiation')!=null?Math.round(parseFloat(field(r,'solarradiation'))):null,uv:toNum(field(r,'uv'))},
    pressure:{relative:toHpa(field(r,'baromrelin','barometrelin')),absolute:toHpa(field(r,'baromabsin','barometreabs'))},
    lightning:{count:toInt(field(r,'lightning_num')),distance:toInt(field(r,'lightning')),lastTime:field(r,'lightning_time')?new Date(parseInt(field(r,'lightning_time'),10)*1000).toISOString():null},
  };
  // Log all key values on one line
  const d=latestData;
  const parts=[
    d.outdoor.temp!=null?`Temp:${d.outdoor.temp}°C`:null,
    d.outdoor.humidity!=null?`Humi:${d.outdoor.humidity}%`:null,
    d.wind.speed!=null?`Wind:${d.wind.speed}km/h ${degToDir(d.wind.direction)}`:null,
    d.rain.rate!=null?`Rain:${d.rain.rate}mm/h`:null,
    d.pressure?.relative!=null?`Druck:${d.pressure.relative}hPa`:null,
    d.solar.uv!=null?`UV:${d.solar.uv}`:null,
  ].filter(Boolean);
  logOk('Ecowitt', parts.join('  '));
  if((d.lightning.count??0)>0) logWarn('Ecowitt',`Blitz: ${d.lightning.count}x · ${d.lightning.distance??'?'}km`);
  if((d.rain.rate??0)>2.5)     logWarn('Ecowitt',`Starkregen: ${d.rain.rate}mm/h · Heute: ${d.rain.daily??0}mm`);

  // Daily accumulator
  if(!dayAccum){dayAccum=newAccum(today);}
  else if(dayAccum.date!==today){
    const summary=finalizeAccum(dayAccum);
    if(summary){
      dailySummaries=dailySummaries.filter(s=>s.date!==summary.date);
      dailySummaries.push(summary);
      dailySummaries.sort((a,b)=>a.date.localeCompare(b.date));
      saveDailySummaries();
      logOk('Daily',`Abschluss ${summary.date}: Ø${summary.outTemp}°C  Max:${summary.outTempMax}°C  Min:${summary.outTempMin}°C  Regen:${summary.rainDaily}mm  Blitze:${summary.lightningCount}  n:${dayAccum.n}  Tage gesamt:${dailySummaries.length}`);
    }
    dayAccum=newAccum(today);
  }
  addToAccum(dayAccum,latestData);
  dataHistory.push({...latestData});
  if(dataHistory.length>288)dataHistory.shift();
  try{fs.writeFileSync(DATA_FILE,JSON.stringify({latest:latestData,history:dataHistory,dayAccum}));}
  catch(e){logErr('Ecowitt',`Speicherfehler: ${e.message}`);}
  res.send('OK');
});

// ── API endpoints ─────────────────────────────────────────────
app.get('/api/weather',(_req,res)=>{
  if(!latestData)return res.status(503).json({error:'No data'});
  res.json({...latestData,today:{tempMin:dayAccum?.tempMin??null,tempMax:dayAccum?.tempMax??null,solarMax:dayAccum?.solarMax??null,rainTotal:dayAccum?.rainMax??null,pressureMin:dayAccum?.pressMin??null,pressureMax:dayAccum?.pressMax??null}});
});
app.get('/api/sparklines',(_req,res)=>{
  res.json(dataHistory.map(d=>({t:d.outdoor.temp,h:d.outdoor.humidity,w:d.wind.speed,r:d.rain.rate,u:d.solar.uv,s:d.solar.radiation,l:d.lightning.count,p:d.pressure?.relative??null})));
});
app.get('/api/history',(_req,res)=>res.json(dataHistory.slice(-48)));
app.get('/api/daily',(req,res)=>{
  const{from,to}=req.query;
  let result=[...dailySummaries];
  if(dayAccum&&dayAccum.n>0){const p=finalizeAccum(dayAccum);if(p){result=result.filter(s=>s.date!==p.date);result.push(p);}}
  result.sort((a,b)=>a.date.localeCompare(b.date));
  if(from)result=result.filter(d=>d.date>=from);
  if(to)result=result.filter(d=>d.date<=to);
  res.json(result);
});

// ── Bright Sky proxy ──────────────────────────────────────────
async function bsFetch(url,tag) {
  const t0=Date.now();
  logInfo(tag,`GET ${url.replace(BRIGHTSKY,'brightsky.dev')}`);
  try{
    const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
    const ms=Date.now()-t0;
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    logOk(tag,`200 OK (${ms}ms)`);
    return{ok:true,data};
  }catch(e){
    logErr(tag,`${e.message} (${Date.now()-t0}ms)`);
    return{ok:false,error:e.message};
  }
}
app.get('/api/dwd/current',async(_req,res)=>{
  const{ok,data,error}=await bsFetch(`${BRIGHTSKY}/current_weather?lat=${STATION_LAT}&lon=${STATION_LON}`,'DWD-Curr');
  if(!ok)return res.status(502).json({error});
  const src=data.sources?.[0],w=data.weather;
  if(src&&w)logInfo('DWD-Curr',`Station:${src.station_name}  Temp:${w.temperature}°C  Wind:${w.wind_speed}km/h  Druck:${w.pressure_msl}hPa`);
  res.json(data);
});
app.get('/api/dwd/weather',async(req,res)=>{
  const{date,last_date}=req.query;
  const url=`${BRIGHTSKY}/weather?lat=${STATION_LAT}&lon=${STATION_LON}`+(date?`&date=${date}`:'')+( last_date?`&last_date=${last_date}`:'');
  const{ok,data,error}=await bsFetch(url,'DWD-Hist');
  if(!ok)return res.status(502).json({error});
  logInfo('DWD-Hist',`${data.weather?.length??0} Datenpunkte`);
  res.json(data);
});
app.get('/api/dwd/alerts',async(_req,res)=>{
  const{ok,data,error}=await bsFetch(`${BRIGHTSKY}/alerts?lat=${STATION_LAT}&lon=${STATION_LON}`,'DWD-Alert');
  if(!ok)return res.status(502).json({error});
  const now=new Date(),cut=new Date(now.getTime()+3600000);
  const active=(data.alerts||[]).filter(a=>{const s=new Date(a.onset??a.effective??0),e=new Date(a.expires??0);return s<=cut&&e>now;});
  if(active.length)active.forEach(a=>logWarn('DWD-Alert',`${a.event_de||a.event_en} (${a.severity}) bis ${(a.expires??'').slice(11,16)}`));
  else logInfo('DWD-Alert','Keine aktiven Warnungen');
  res.json(data);
});

// ── Startup ───────────────────────────────────────────────────
try{if(fs.existsSync(DATA_FILE)){const s=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));latestData=s.latest||null;dataHistory=s.history||[];dayAccum=s.dayAccum||null;logOk('Server',`weather.json: ${dataHistory.length} Messwerte geladen`);}}catch(e){logErr('Server',`weather.json: ${e.message}`);}
try{if(fs.existsSync(DAILY_FILE)){dailySummaries=JSON.parse(fs.readFileSync(DAILY_FILE,'utf8'));logOk('Server',`daily.json: ${dailySummaries.length} Tageszusammenfassungen geladen`);}}catch(e){logErr('Server',`daily.json: ${e.message}`);}

app.listen(PORT,()=>{
  logOk('Server', `Wetterstation Gründau · Port ${PORT}`);
  logInfo('Server',`Koordinaten: ${STATION_LAT}°N ${STATION_LON}°E (Gründau-Gettenbach)`);
  logInfo('Server',`Ecowitt-Push: POST /data/report/`);
  logInfo('Server',`DWD-Proxy: /api/dwd/{current,weather,alerts}`);
});
