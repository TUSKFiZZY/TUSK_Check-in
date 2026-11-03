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
