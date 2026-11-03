const { app, BrowserWindow, shell, ipcMain, session, net } = require("electron");
const path = require("path");
const crypto = require("crypto");

const APP_URL = "https://tuskfizzy.github.io/TUSK_Check-in/";
const CHECKIN_URL = "https://act.hoyolab.com/ys/event/signin-sea-v3/index.html";
const DAILY_NOTE_URL = "https://bbs-api-os.hoyolab.com/game_record/genshin/api/dailyNote";

function isTracker(event) {
  try {
    const url = new URL(event.senderFrame.url);
    return url.origin === "https://tuskfizzy.github.io" && url.pathname.startsWith("/TUSK_Check-in/");
  } catch { return false; }
}
function partitionFor(profileId) {
  if (typeof profileId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(profileId)) {
    throw new Error("Invalid tracker profile.");
  }
  return "persist:tuskfizzy-hoyolab-" + profileId;
}
function openHoYoLab(profileId, target) {
  const win = new BrowserWindow({
    width: 1050, height: 780, minWidth: 600, minHeight: 500,
    title: "HoYoLAB — TUSKFiZZY", autoHideMenuBar: true,
    webPreferences: {
      partition: partitionFor(profileId),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  win.loadURL(target);
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" &&
          (u.hostname === "hoyolab.com" || u.hostname.endsWith(".hoyolab.com") ||
           u.hostname === "hoyoverse.com" || u.hostname.endsWith(".hoyoverse.com"))) {
        return { action: "allow" };
      }
    } catch {}
    shell.openExternal(url);
    return { action: "deny" };
  });
}
const ENKA_CACHE = new Map();
function makeDS() {
 const t=Math.floor(Date.now()/1000), alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
 const r=Array.from(crypto.randomBytes(6),b=>alphabet[b%alphabet.length]).join("");
 const salt="6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
 return t+","+r+","+crypto.createHash("md5").update("salt="+salt+"&t="+t+"&r="+r).digest("hex");
}
ipcMain.handle("enka:profile",async(event,uid)=>{
 if(!isTracker(event))throw new Error("Untrusted tracker page.");
 if(!/^\d{9,10}$/.test(String(uid||"")))throw new Error("Enter a valid 9- or 10-digit Genshin UID.");
 const cached=ENKA_CACHE.get(uid);if(cached&&cached.expiresAt>Date.now())return {...cached.data,cached:true};
 let response;
 try {
  response=await net.fetch("https://enka.network/api/uid/"+encodeURIComponent(uid)+"/",{
   method:"GET",headers:{"Accept":"application/json","User-Agent":"Mozilla/5.0 TUSKFiZZY Genshin Profile Viewer"},
   signal:AbortSignal.timeout(20000)
  });
 } catch(error) {
  const reason=error&&error.cause&&error.cause.message?error.cause.message:(error&&error.message?error.message:"network connection failed");
  throw new Error("Could not connect to Enka.Network. Check your internet connection, VPN/DNS, or try again later. Details: "+reason);
 }
 if(!response.ok){if(response.status===404)throw new Error("Enka.Network could not find this UID. Check the UID and server.");if(response.status===429)throw new Error("Enka.Network rate limit reached. Wait before refreshing.");if(response.status===424)throw new Error("Enka.Network is temporarily unavailable during a game update.");throw new Error("Enka.Network request failed ("+response.status+").")}
 let raw;
 try{raw=await response.json()}catch(error){throw new Error("Enka.Network returned an unreadable response. Try again later.")}
 if(!raw||!raw.playerInfo)throw new Error("Enka.Network returned incomplete profile data. Make sure your in-game character showcase is public.");
 const ttl=Math.max(60,Math.min(Number(raw.ttl)||300,86400));
 const data={uid:String(uid),playerInfo:raw.playerInfo,avatarInfoList:Array.isArray(raw.avatarInfoList)?raw.avatarInfoList:[],ttl,fetchedAt:Date.now(),cached:false};
 ENKA_CACHE.set(uid,{data,expiresAt:Date.now()+ttl*1000});return data;
});
ipcMain.handle("hoyo:battle-chronicle",async(event,args)=>{
 if(!isTracker(event))throw new Error("Untrusted tracker page.");
 const {profileId,uid,server}=args||{},partition=partitionFor(profileId);
 if(!/^\d{8,10}$/.test(String(uid||"")))throw new Error("Enter a valid Genshin UID.");
 if(!["os_asia","os_usa","os_euro","os_cht"].includes(server))throw new Error("Select a valid Genshin server.");
 const url=new URL("https://bbs-api-os.hoyolab.com/game_record/genshin/api/index");
 url.searchParams.set("server",server);url.searchParams.set("role_id",String(uid));
 const response=await session.fromPartition(partition).fetch(url.toString(),{method:"GET",credentials:"include",headers:{
  "DS":makeDS(),"x-rpc-app_version":"2.71.1","x-rpc-client_type":"5","x-rpc-language":"en-us","Referer":"https://www.hoyolab.com/","Accept":"application/json"
 }});
 if(!response.ok)throw new Error("HoYoLAB Battle Chronicle request failed ("+response.status+").");
 const result=await response.json();if(result.retcode!==0||!result.data)throw new Error(result.message||"HoYoLAB did not return Battle Chronicle data. Sign in to the correct account and check Battle Chronicle visibility.");
 return {...result.data,fetchedAt:Date.now()};
});
ipcMain.handle("hoyo:connect", (event, profileId) => {
  if (!isTracker(event)) throw new Error("Untrusted tracker page.");
  openHoYoLab(profileId, "https://www.hoyolab.com/");
  return true;
});
ipcMain.handle("hoyo:checkin", (event, profileId) => {
  if (!isTracker(event)) throw new Error("Untrusted tracker page.");
  openHoYoLab(profileId, CHECKIN_URL);
  return true;
});
ipcMain.handle("hoyo:daily-note", async (event, args) => {
  if (!isTracker(event)) throw new Error("Untrusted tracker page.");
  const { profileId, uid, server } = args || {};
  const partition = partitionFor(profileId);
  if (!/^\d{8,10}$/.test(String(uid || ""))) throw new Error("Enter a valid Genshin UID.");
  if (!["os_asia", "os_usa", "os_euro", "os_cht"].includes(server)) throw new Error("Select a valid Genshin server.");

  const ds = makeDS();
  const url = new URL(DAILY_NOTE_URL);
  url.searchParams.set("server", server);
  url.searchParams.set("role_id", String(uid));

  const ses = session.fromPartition(partition);
  const response = await ses.fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers: {
      "DS": ds,
      "x-rpc-app_version": "2.71.1",
      "x-rpc-client_type": "5",
      "x-rpc-language": "en-us",
      "Referer": "https://www.hoyolab.com/",
      "Accept": "application/json"
    }
  });
  if (!response.ok) throw new Error("HoYoLAB request failed (" + response.status + "). Check your connection and sign-in, then try again.");
  
  const result = await response.json();
  if (result.retcode !== 0 || !result.data) {
    throw new Error(result.message || "HoYoLAB did not return Daily Note data. Check the UID, server, account login, and enable Real-Time Notes in HoYoLAB Battle Chronicle settings.");
  }
  const d = result.data;
  return {
    resin: Number(d.current_resin || 0),
    maxResin: Number(d.max_resin || 160),
    recoverySeconds: Number(d.resin_recovery_time || 0),
    commissions: Number(d.finished_task_num || 0),
    totalCommissions: Number(d.total_task_num || 4),
    extraRewardClaimed: Boolean(d.is_extra_task_reward_received),
    expeditions: Number(d.current_expedition_num || 0),
    maxExpeditions: Number(d.max_expedition_num || 5),
    fetchedAt: Date.now()
  };
});

ipcMain.handle("wish:import", async (event, rawUrl) => {
 if (!isTracker(event)) throw new Error("Untrusted tracker page.");
 let supplied;
 try { supplied = new URL(String(rawUrl || "")); } catch { throw new Error("Paste a valid wish-history URL."); }
 if (supplied.protocol !== "https:" || !/(^|\.)hoyoverse\.com$|(^|\.)mihoyo\.com$/i.test(supplied.hostname) || !/gacha/i.test(supplied.pathname)) {
  throw new Error("This does not look like a supported HoYoverse Genshin wish-history URL.");
 }
 const region = supplied.searchParams.get("region") || "";
 const api = new URL(supplied.toString());
 api.hostname = /^cn_/i.test(region) ? "public-operation-hk4e.mihoyo.com" : "public-operation-hk4e-sg.hoyoverse.com";
 api.pathname = "/gacha_info/api/getGachaLog";
 api.hash = "";
 const all = [];
 const types = ["100","200","301","302","500"];
 for (const type of types) {
  let endId = "0";
  for (let page = 1; page <= 100; page++) {
   const requestUrl = new URL(api.toString());
   requestUrl.searchParams.set("lang", "en");
   requestUrl.searchParams.set("gacha_type", type);
   requestUrl.searchParams.set("size", "20");
   requestUrl.searchParams.set("page", String(page));
   requestUrl.searchParams.set("end_id", endId);
   let response;
   try { response = await net.fetch(requestUrl.toString(), { method: "GET", headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0 TUSKFiZZY Wish History Importer" }, signal: AbortSignal.timeout(20000) }); }
   catch (error) { throw new Error("Could not connect to HoYoverse wish history. Check your connection and try again."); }
   if (!response.ok) throw new Error("HoYoverse wish-history request failed (" + response.status + ").");
   const payload = await response.json();
   if (Number(payload.retcode) !== 0) throw new Error(payload.message || "HoYoverse rejected the wish-history link. It may have expired.");
   const list = payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
   if (!list.length) break;
   all.push(...list);
   const nextId = String(list[list.length - 1].id || "");
   if (!nextId || nextId === endId || list.length < 20) break;
   endId = nextId;
  }
 }
 if (!all.length) throw new Error("No wish records were returned. Check that Wish History has loaded and the copied link is current.");
 return { list: all };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 560, height: 900, minWidth: 380, minHeight: 620,
    title: "TUSKFiZZY", autoHideMenuBar: true,
    backgroundColor: "#100e18",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  win.loadURL(APP_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) win.loadURL(url);
    else shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
