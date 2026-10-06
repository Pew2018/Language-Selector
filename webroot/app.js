(function(){
"use strict";
const C=window.LSCore,P=window.LSPresentation;
const DATA="/data/adb/language_selector_ksu_data";
const CONFIG=DATA+"/config.v1";
const $=id=>document.getElementById(id);
const storage={getItem:key=>{try{return localStorage.getItem(key)}catch(_){return null}},setItem:(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}}};
const S={apps:[],selected:null,configs:{schemaVersion:1,autoApplyOnBoot:false,apps:[]},page:"apps",search:"",showSystem:false,loading:false,loadGeneration:0,errors:[],operation:"",bootRaw:"",configValid:false,configError:"",operationState:null,refreshing:false,diagnosing:false,localeLoading:false,localeFailures:0,detailRead:0,restoring:null,lastAction:null,showIcons:storage.getItem("language_selector.showAppIcons")!=="false",showNames:storage.getItem("language_selector.showAppNames")!=="false",localeQuery:"",user:null,sdk:null};
const BUNDLED_LOCALES=("af ar az be bg bn bs ca cs cy da de el en es et eu fa fi fil fr ga gl gu he hi hr hu hy id is it ja ka kk km kn ko lo lt lv mk ml mn mr ms mt my nb ne nl nn no pa pl pt ro ru sk sl sq sr sv sw ta te th uk ur uz vi zh zh-Hans zh-Hant en-US en-GB en-AU en-CA en-IN en-NZ en-SG en-ZA es-ES es-MX es-AR es-CO es-CL es-US fr-FR fr-CA fr-BE fr-CH pt-BR pt-PT zh-CN zh-TW zh-HK zh-SG zh-Hans-CN zh-Hant-TW zh-Hant-HK ja-JP ko-KR de-DE de-AT de-CH it-IT nl-NL nl-BE ru-RU uk-UA ar-EG ar-SA hi-IN bn-BD bn-IN pa-IN ta-IN ta-LK te-IN ur-PK fa-IR id-ID ms-MY th-TH vi-VN fil-PH tr-TR pl-PL cs-CZ sk-SK hu-HU ro-RO bg-BG el-GR he-IL sv-SE da-DK nb-NO fi-FI").split(" ");
let busy=false,initialized=false,uncertain=false;
function updateBusy(){
 document.querySelectorAll("#appIconsSwitch,#appNamesSwitch").forEach(b=>b.disabled=!initialized||S.loading);
 document.querySelectorAll(".locale-option").forEach(b=>b.disabled=busy||!S.configValid||uncertain||S.refreshing);
 $("autoSwitch").disabled=busy||!initialized||uncertain||!S.configValid||S.refreshing;
 $("restoreDefault").disabled=busy||!S.configValid||uncertain||S.refreshing||!S.selected?.locale?.ok||S.selected.locale.followSystem;
 $("refresh").disabled=S.refreshing||S.loading||busy;$("diagnosticsRefresh").disabled=S.diagnosing||busy;
 $("recoverOperation").disabled=busy||S.diagnosing;
 const warning=!S.configValid?"⚠ "+(S.configError?P.errorText(S.configError):"正在检查配置，暂不能修改语言。"):uncertain?"⚠ 有待恢复操作，已暂停写入。请在运行状态页核对。":"";
 document.querySelectorAll("[data-config-status]").forEach(node=>{node.hidden=!warning;node.textContent=warning});
}
async function mutation(run){if(busy||!initialized||uncertain||!S.configValid)return;busy=true;updateBusy();try{await run()}finally{busy=false;updateBusy();LSUI.bind()}}
let seq=0,DEVICE_LOCALES=[],LOCALE_CATALOG_SOURCE="离线备用语言列表";
function api(){return typeof window.ksu==="object"&&window.ksu}
function parseNative(v){if(Array.isArray(v))return v;if(typeof v==="string"){try{return JSON.parse(v)}catch(e){throw Error("KernelSU API returned invalid JSON")}}return []}
function execAsync(command,options){const run=LSBridge.createExecutor(api(),{callbacks:window,onUncertain:()=>{uncertain=true;updateBusy()}});return run(command,options)}
const CONTROL="/data/adb/modules/language_selector_ksu/control.sh";
async function backend(action,args=[],writing=false){if(!C.validUserId(S.user))throw Error("当前用户不可用，请刷新");const r=await execAsync("sh "+C.shellQuote(CONTROL)+" "+[action,S.user,...args].map(C.shellQuote).join(" "),{mutation:writing});if(r.code!==0)throw Error(r.err||r.out||"模块操作失败");return r.out}
async function acceptConfig(text){S.configs=C.parseInternal(text);S.configValid=true;$("autoSwitch").setAttribute("aria-checked",String(S.configs.autoApplyOnBoot));S.apps.forEach(updateLocaleRow);if(S.selected)syncDetailState(S.selected);updateBusy()}
function command(parts){return parts.join(" ")}
function getUser(){return execAsync("am get-current-user").then(r=>{const u=r.out.trim();if(r.code!==0||!C.validUserId(u))throw Error("Unable to determine current Android user");return u})}
function localeCommand(action,pkg,user,tag){if(!C.validPackage(pkg))throw Error("Invalid package name");if(!C.validUserId(user))throw Error("Invalid Android user");const q=C.shellQuote;let p=["cmd","locale",action,q(pkg),"--user",q(user)];if(action==="set-app-locales"&&tag!==undefined){if(tag!==""&&!C.validLocale(tag))throw Error("Invalid BCP-47 Locale tag");if(tag!=="")p.push("--locales",q(tag))}return command(p)}
function checkPlatform(){const sdk=S.sdk;if(sdk===null||sdk<33)throw Error("Android 13 or later is required")}
async function readLocale(pkg,userOverride){try{checkPlatform();const user=userOverride===undefined?await getUser():userOverride;const r=await execAsync(localeCommand("get-app-locales",pkg,user));const parsed=C.parseLocaleOutput(r.out,pkg,user);if(r.code!==0)return{ok:false,reason:/not found|unknown command|not recognized/i.test(r.err+r.out)?"command-unavailable":parsed.reason,raw:r.err||r.out};if(!parsed.ok)return{ok:false,reason:parsed.reason,raw:parsed.raw};if(parsed.ok&&!parsed.followSystem)parsed.localeTags=r.out.trim().match(/\[([^\]]*)\]$/)[1].split(",").map(t=>t.trim());return parsed}catch(e){return{ok:false,reason:/Android 13/i.test(e.message)?"unsupported":/user/i.test(e.message)?"user-unavailable":"command-unavailable",raw:e.message}}}
function statusText(x){return P.readingText(x)}
function nativeList(){return C.packageNamesFromBridge(api())}
async function loadLocaleCatalog(){try{const r=await execAsync("cmd locale list-device-locales 2>&1");const tags=C.parseDeviceLocales(r.out);if(tags.length){DEVICE_LOCALES=tags;LOCALE_CATALOG_SOURCE="设备语言列表（"+tags.length+"）";if(S.page==="detail")renderLocales();return}}catch(e){}DEVICE_LOCALES=[];LOCALE_CATALOG_SOURCE="离线备用列表（"+BUNDLED_LOCALES.length+"）";if(S.page==="detail")renderLocales()}
async function loadConfig(){S.configValid=false;S.configError="";S.operationState=null;try{S.user=await getUser();const version=await execAsync("getprop ro.build.version.sdk");if(version.code!==0||!/^\d+$/.test(version.out.trim()))throw Error("无法核对 Android 版本");S.sdk=Number(version.out.trim());checkPlatform();await acceptConfig(await backend("read"));const state=(await backend("state")).trim();if(!["ready","pending"].includes(state))throw Error("无效操作状态");S.operationState=state;uncertain=state==="pending";$("recoverOperation").hidden=!uncertain}catch(e){S.configValid=false;S.configError=e.message;recordError("Config: "+e.message);$("listStatus").textContent=P.errorText(e)}updateBusy()}
async function saveConfig(next){if(!S.configValid||uncertain)throw Error("配置不可用或存在未完成操作，已禁止保存");const normalized=C.normalizeConfig(next);await acceptConfig(await backend("auto",[normalized.autoApplyOnBoot?"1":"0"],true));storage.setItem("language_selector.saved."+S.user,new Date().toLocaleString())}
let snackTimer=null;
function announce(text){const t=$("toast");clearTimeout(snackTimer);t.textContent=text;t.classList.add("show");snackTimer=setTimeout(()=>t.classList.remove("show"),3200)}
function showDialog(title,message,actions){LSUI.showDialog(title,message,actions.map(a=>({...a,run:a.run?()=>mutation(a.run):undefined})))}
function languageValue(host,tags,followSystem=false){
 host.replaceChildren();for(const tag of followSystem?[null]:Array.isArray(tags)?tags:[tags]){
 const value=document.createElement("div");value.className="language-value";const main=document.createElement("div");main.textContent=followSystem?"跟随系统":langLabel(tag);value.append(main);
 if(!followSystem&&main.textContent!==tag){const code=document.createElement("small");code.className="language-code";code.textContent=tag;value.append(code)}host.append(value)}
}
function syncDetailState(app){
 if(S.selected!==app)return;
 const actual=app.locale,entry=S.configs.apps.find(x=>x.packageName===app.packageName);
 const state=P.detailState(app,entry);
 $("currentLocaleGroup").hidden=!state.showCurrent;$("configuredLocaleGroup").hidden=!state.showConfigured;
 if(state.showCurrent)languageValue($("currentLocale"),P.actualTags(actual),actual.followSystem);
 if(state.showConfigured)languageValue($("configuredLocale"),entry.localeTag,entry.followSystem);
 $("detailState").textContent=state.text;$("detailState").hidden=!state.text;$("detailState").dataset.status=state.kind;
 const following=actual?.ok&&actual.followSystem;
 $("followSystemStatus").hidden=!following||S.restoring===app;$("restoreDefault").hidden=!!following&&S.restoring!==app;
 $("restoreDefault").querySelector("span").textContent=S.restoring===app?"正在恢复…":"恢复跟随系统";
 const identity=S.showNames?(app.appLabel||app.packageName):app.packageName;
 $("detailSummary").textContent=identity+" · 当前："+(actual?.ok?statusText(actual):"尚未确认");
 renderLocales();updateBusy();
}
async function refreshAppLocale(app,user=S.user){
 const serial=(app.readSerial||0)+1;app.readSerial=serial;app.checking=true;app.locale=null;updateLocaleRow(app);
 const result=await readLocale(app.packageName,user);
 if(app.readSerial!==serial)return null;
 app.locale=result;app.checking=false;updateLocaleRow(app);
 if(!result.ok)recordError(app.packageName+": "+result.raw);
 return result;
}
function renderDetail(app){
 S.selected=app;S.page="detail";syncProgressVisibility();$("appsPage").classList.add("hidden");$("detailPage").classList.remove("hidden");$("settingsPage").classList.add("hidden");$("diagnosticsPage").classList.add("hidden");$("back").classList.remove("hidden");$("refresh").classList.remove("hidden");$("title").textContent="Language Selector";
 const head=$("appHeader");head.replaceChildren();const icon=S.showIcons?makeAppIcon(app):null,copy=document.createElement("div"),name=document.createElement("div");name.className="app-name";name.textContent=S.showNames?(app.appLabel||app.packageName):app.packageName;
 copy.append(name);if(S.showNames){const pkg=document.createElement("div");pkg.className="package";pkg.textContent=app.packageName;copy.append(pkg)}if(icon)head.append(icon);head.append(copy);
 document.querySelector(".bottom-nav").hidden=true;$("actionStatus").hidden=true;syncDetailState(app);void refreshAppLocale(app);
}
function openDetail(app){LSUI.navigate("detail",app);renderDetail(app)}
function langLabel(tag){return P.languageName(tag)}
function renderLocales(){
 const q=S.localeQuery.trim().toLowerCase(),catalog=DEVICE_LOCALES.length?DEVICE_LOCALES:BUNDLED_LOCALES,common=C.commonLocales(catalog),app=S.selected,entry=app&&S.configs.apps.find(x=>x.packageName===app.packageName);
 let matches=0;
 for(const id of ["commonLocales","localeList"]){
  const host=$(id);host.replaceChildren();const list=id==="commonLocales"?common:catalog.filter(t=>!common.includes(t));
  const tags=[...new Set(list)].filter(C.validLocale).filter(t=>!q||t.toLowerCase().includes(q)||langLabel(t).toLowerCase().includes(q));matches+=tags.length;
  $(id==="commonLocales"?"commonHeading":"allHeading").hidden=q?!tags.length:false;
  for(const tag of tags){
   const b=document.createElement("button");b.type="button";b.className="locale-option";
   const copy=document.createElement("span");copy.className="locale-copy";const title=document.createElement("span");title.textContent=langLabel(tag);copy.append(title);
   if(title.textContent!==tag){const sub=document.createElement("small");sub.textContent=tag;copy.append(sub)}
   const current=app?.locale?.ok&&!app.locale.followSystem&&P.actualTags(app.locale).some(t=>C.sameLocale(t,tag)),configured=entry&&!entry.followSystem&&C.sameLocale(entry.localeTag,tag),marks=document.createElement("span");marks.className="locale-marks";
   if(current){const mark=document.createElement("span");mark.className="current-mark";mark.textContent="✓ 当前";marks.append(mark)}
   if(configured){const mark=document.createElement("span");mark.className="configured-mark";mark.textContent="已配置";marks.append(mark)}
   b.append(copy,marks);b.dataset.localeTag=tag;b.setAttribute("aria-pressed",String(!!current));b.onclick=()=>applyLocale(tag);host.append(b);
  }
 }
 if(!matches){$("allHeading").hidden=true;$("commonHeading").hidden=true;appendEmpty($("localeList"),q?"未找到匹配的语言":"暂无可用语言",q?"localeSearch":null)}
 LSUI.bind();updateBusy();
}
function appendEmpty(host,message,inputId){
 const empty=document.createElement("div");empty.className="empty-state";const text=document.createElement("p");text.textContent=message;empty.append(text);
 if(inputId){const clear=document.createElement("button");clear.type="button";clear.className="text-action";clear.textContent="清除搜索";clear.onclick=()=>$(inputId+"Clear").click();empty.append(clear)}host.append(empty);
}
async function applyLocale(tag){const app=S.selected;if(!app||!C.validLocale(tag))return;showDialog("应用语言","将 "+langLabel(tag)+" 设置到 "+app.packageName+"？应用可能需要重新启动才能显示变化。",[{label:"取消"},{label:"应用",run:async()=>{await performLocale(app,tag)}}])}
async function restoreDefault(){
 const app=S.selected;if(!app||!app.locale?.ok||app.locale.followSystem)return;
 await mutation(async()=>{S.restoring=app;syncDetailState(app);try{await performLocale(app,null)}finally{S.restoring=null;syncDetailState(app)}});
}
function showAction(text,error=false,app=null){
 if(app&&S.selected!==app)return;
 $("actionStatus").hidden=false;$("actionStatus").textContent=(error?"⚠ ":"")+text;$("actionStatus").dataset.error=String(error);
}
async function performLocale(app,tag){
 let submitted=false;app.readSerial=(app.readSerial||0)+1;
 showAction(tag===null?"正在恢复…":"正在保存并应用…",false,app);announce(tag===null?"正在恢复…":"正在应用…");
 try{
  if(!S.configValid||uncertain)throw Error("配置不可用，已禁止修改");checkPlatform();
  if(await getUser()!==S.user)throw Error("Android 用户已切换，请刷新");
  submitted=true;await acceptConfig(await backend("locale",[app.packageName,tag===null?"@system":tag],true));
  const actual=await refreshAppLocale(app);storage.setItem("language_selector.saved."+S.user,new Date().toLocaleString());
  const matched=actual?.ok&&(tag===null?actual.followSystem:!actual.followSystem&&P.actualTags(actual).length===1&&C.sameLocale(actual.localeTag,tag));
  S.operation=matched?(tag===null?"已恢复跟随系统":"已生效："+langLabel(tag)):"配置已保存，当前设置尚未确认";
  storage.setItem("language_selector.operation."+S.user,S.operation+" · "+app.packageName);
  storage.setItem("language_selector.operationTime."+S.user,new Date().toISOString());
  showAction(S.operation,!matched,app);announce(S.operation);S.lastAction={ok:!!matched,text:S.operation};
 }catch(e){
  recordError(e.message);S.lastAction={ok:false,text:P.errorText(e)};
  if(submitted){try{const state=(await backend("state")).trim();S.operationState=["ready","pending"].includes(state)?state:null;uncertain=state!=="ready"}catch(_){S.operationState=null;uncertain=true}}
  $("recoverOperation").hidden=S.operationState!=="pending";await refreshAppLocale(app);
  showAction(P.errorText(e),true,app);announce(P.errorText(e));
  storage.setItem("language_selector.operation."+S.user,"未完成："+P.errorText(e)+" · "+app.packageName);
  storage.setItem("language_selector.operationTime."+S.user,new Date().toISOString());
 }finally{syncDetailState(app);updateBusy()}
}
function recordError(x){S.errors.unshift(new Date().toISOString()+" "+x);S.errors=S.errors.slice(0,30);storage.setItem("language_selector.errors",JSON.stringify(S.errors))}
// Icons are loaded only for visible rows (or the selected app), never before first render.
let iconObserver=null,iconTimer=null;
const iconQueue=new Map();
function makeAppIcon(app,lazy=false){
 const img=document.createElement("img");img.className="app-icon";img.alt="";img.width=40;img.height=40;
 img.onerror=()=>{img.onerror=null;img.classList.add("icon-unavailable");img.src="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="4" fill="#757575"/><path fill="#eeeeee" d="M10 10h8v8h-8zm12 0h8v8h-8zM10 22h8v8h-8zm12 0h8v8h-8z"/></svg>')};
 if(app.icon)img.src=app.icon;
 else if(lazy&&typeof IntersectionObserver==="function"){
  if(!iconObserver)iconObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){iconObserver.unobserve(e.target);queueIcon(e.target,e.target._app)}},{root:$("main"),rootMargin:"120px"});
  img._app=app;iconObserver.observe(img);
 }else queueIcon(img,app);
 return img;
}
function queueIcon(img,app){
 if(!S.showIcons||!app)return;iconQueue.set(img,app);
 if(iconTimer===null)iconTimer=setTimeout(flushIcons,0);
}
function flushIcons(){
 iconTimer=null;const batch=[...iconQueue.entries()].slice(0,12);batch.forEach(([img])=>iconQueue.delete(img));
 const live=batch.filter(([img,app])=>S.showIcons&&img.isConnected&&S.apps.includes(app));
 if(live.length){
  const host=api();let icons=new Map();
  try{if(host&&typeof host.getPackagesIcons==="function")icons=new Map(parseNative(host.getPackagesIcons(JSON.stringify([...new Set(live.map(([,app])=>app.packageName))]),48)).map(x=>[x.packageName,iconData(x.icon)]))}catch(e){S.errors.push("Icons: "+e.message)}
  for(const [img,app]of live){if(!S.showIcons||!img.isConnected)continue;app.icon=icons.get(app.packageName)||app.icon;if(app.icon)img.src=app.icon;else img.src="ksu://icon/"+encodeURIComponent(app.packageName)}
 }
 if(iconQueue.size)iconTimer=setTimeout(flushIcons,0);
}
function iconData(value){if(typeof value!=="string"||value.length>262144)return"";const raw=value.replace(/^data:image\/png;base64,/,"");return /^[A-Za-z0-9+/]+={0,2}$/.test(raw)?"data:image/png;base64,"+raw:""}
async function yieldTask(){return new Promise(resolve=>setTimeout(resolve,0))}
function parsePmPackages(output){return C.packageNamesFromPm(output)}
async function shellPackageList(){const user=await getUser(),q=C.shellQuote;async function run(flag){return execAsync("cmd package list packages --user "+q(user)+" "+flag+" 2>&1")}let system=[],userApps=[];const sr=await run("-s"),ur=await run("-3");if(sr.code===0)system=parsePmPackages(sr.out);if(ur.code===0)userApps=parsePmPackages(ur.out);if(!system.length&&!userApps.length){const all=await run("");if(all.code!==0)throw Error(all.err||all.out||"Package Manager could not list installed apps");return parsePmPackages(all.out).map(packageName=>({packageName,isSystem:false}))}const systemSet=new Set(system);return [...new Set([...system,...userApps])].map(packageName=>({packageName,isSystem:systemSet.has(packageName)}))}
async function loadApps(){if(S.loading)return;const generation=++S.loadGeneration;S.loading=true;S.localeLoading=false;updateBusy();setProgress(null);$("listStatus").textContent="正在加载已安装应用…";$("appList").replaceChildren();try{let names=nativeList(),shellEntries=null;if(!names||S.user!=="0"||!S.showNames){shellEntries=await shellPackageList();names=shellEntries.map(x=>x.packageName)}const unique=[...new Set(names.filter(C.validPackage))];if(!unique.length){$("listStatus").textContent="未返回已安装应用，请检查 Manager 的 Shell 权限。";S.apps=[];setProgress(false);return}
const all=[];if(S.showNames&&api()&&typeof ksu.getPackagesInfo==="function"){for(let i=0;i<unique.length;i+=50){const batch=unique.slice(i,i+50);try{const infos=parseNative(ksu.getPackagesInfo(JSON.stringify(batch)));if(Array.isArray(infos))all.push(...infos.filter(x=>!x.error))}catch(e){S.errors.push("Some app labels could not be read: "+e.message)}if(i===0)$("listStatus").textContent="正在读取应用信息…";setProgress(Math.min(i+50,unique.length),unique.length);await yieldTask()}}
const infoMap=new Map(all.map(x=>[x.packageName,x])),systemMap=new Map((shellEntries||[]).map(x=>[x.packageName,x.isSystem]));S.apps=unique.map(pkg=>{const x=infoMap.get(pkg)||{};return{packageName:pkg,appLabel:typeof x.appLabel==="string"?x.appLabel.slice(0,256):pkg,isSystem:typeof x.isSystem==="boolean"?x.isSystem:!!systemMap.get(pkg),icon:"",locale:null,checking:false,readSerial:0}});S.localeLoading=true;setProgress(0,S.apps.length);$("listStatus").textContent="正在读取语言设置…";renderApps();const apps=S.apps;void(async()=>{let user=null,userError=null;try{user=await getUser();if(user!==S.user)throw Error("Android user changed; refresh")}catch(e){userError=e}let i=0,at=0;async function worker(){while(at<apps.length){
 if(generation!==S.loadGeneration)return;const item=apps[at++],serial=(item.readSerial||0)+1;item.readSerial=serial;item.checking=true;updateLocaleRow(item);
 const result=userError?{ok:false,reason:"user-unavailable",raw:userError.message}:await readLocale(item.packageName,user);
 if(generation!==S.loadGeneration)return;
 if(item.readSerial===serial){item.locale=result;item.checking=false;updateLocaleRow(item)}
 i++;if(i%15===0||i===apps.length)setProgress(i,apps.length);await yieldTask()
}}await Promise.all(Array.from({length:6},worker));if(generation===S.loadGeneration){S.localeFailures=apps.filter(x=>!x.locale?.ok).length;S.localeLoading=false;setProgress(false);showListSummary()}})().catch(e=>{if(generation!==S.loadGeneration)return;S.localeLoading=false;setProgress(false);$("listStatus").textContent="语言设置读取中断："+P.errorText(e);recordError(e.message)})}catch(e){setProgress(false);S.localeLoading=false;$("listStatus").textContent="无法加载应用："+P.errorText(e);S.errors.unshift(e.message);recordError("App list: "+e.message)}finally{S.loading=false;updateBusy()}}
function syncProgressVisibility(){
 document.documentElement.dataset.progressPaused=String(document.hidden||S.page!=="apps");
}
function setProgress(value,total){
 const progress=$("listProgress"),count=$("listCount"),active=value!==false;
 progress.hidden=!active;progress.dataset.running=String(active);$("appList").setAttribute("aria-busy",String(active));
 count.hidden=!active||!Number.isFinite(total)||total<=0||!Number.isFinite(value);
 count.textContent=count.hidden?"":value+" / "+total;
 // Indeterminate animation is independent of these real counts.
 progress.removeAttribute("aria-valuenow");syncProgressVisibility();
}
document.addEventListener("visibilitychange",syncProgressVisibility);
window.addEventListener("pagehide",()=>{document.documentElement.dataset.progressPaused="true"});
window.addEventListener("pageshow",syncProgressVisibility);
function visibleApps(){const q=$("search").value.trim().toLowerCase();return C.sortAppsByLocale(S.apps,S.configs.apps).filter(a=>(S.showSystem||!a.isSystem)&&(!q||(S.showNames&&a.appLabel.toLowerCase().includes(q))||a.packageName.toLowerCase().includes(q)))}
function showListSummary(){if(S.loading||S.localeLoading)return;const count=visibleApps().length;$("listStatus").textContent="已加载 "+S.apps.length+" 个应用 · 当前显示 "+count+" 个"+(S.localeFailures?" · "+S.localeFailures+" 个语言设置无法读取":"")}
let reorderFrame=null;
function scheduleAppOrder(){
 if(reorderFrame!==null)return;reorderFrame=requestAnimationFrame(()=>{
 reorderFrame=null;const host=$("appList"),rows=[...host.querySelectorAll(".app-row")],byPackage=new Map(rows.map(row=>[row.dataset.packageName,row])),ordered=visibleApps(),count=ordered.filter(app=>C.moduleLocale(app,S.configs.apps)).length;
 let configuredHeading=host.querySelector('[data-app-group="configured"]'),otherHeading=host.querySelector('[data-app-group="other"]');
 if(count&&!configuredHeading){configuredHeading=document.createElement("h3");configuredHeading.className="app-group-title";configuredHeading.dataset.appGroup="configured"}
 if(!count){configuredHeading?.remove();configuredHeading=null}
 const rest=ordered.length-count;
 if(count&&rest&&!otherHeading){otherHeading=document.createElement("h3");otherHeading.className="app-group-title";otherHeading.dataset.appGroup="other"}
 if(!count||!rest){otherHeading?.remove();otherHeading=null}
 if(configuredHeading)configuredHeading.textContent="已配置 · "+count;if(otherHeading)otherHeading.textContent="其他应用 · "+rest;
 const nodes=[];if(configuredHeading)nodes.push(configuredHeading);
 ordered.forEach((app,i)=>{if(i===count&&otherHeading)nodes.push(otherHeading);if(byPackage.has(app.packageName))nodes.push(byPackage.get(app.packageName))});
 if(nodes.every((node,i)=>host.children[i]===node))return;
 const scroll=$("main").scrollTop,focus=document.activeElement;nodes.forEach((node,i)=>{if(host.children[i]!==node)host.insertBefore(node,host.children[i]||null)});if(focus?.isConnected&&document.activeElement!==focus)focus.focus({preventScroll:true});$("main").scrollTop=scroll;
 });
}
function decorateLocaleRow(row,app){
 const state=P.configuredState(app,S.configs.apps),host=row.querySelector(".locale-state");row.classList.toggle("module-configured",state.configured);host.dataset.status=state.kind;host.replaceChildren();
 const text=document.createElement("span");text.className="state-text";text.textContent=state.text;host.append(text);
 if(state.note){const note=document.createElement("span");note.className="state-note";note.textContent=state.note;host.append(note)}
}
function updateLocaleRow(app){const row=[...$("appList").querySelectorAll(".app-row")].find(node=>node.dataset.packageName===app.packageName);if(row)decorateLocaleRow(row,app);if(S.selected===app)syncDetailState(app);scheduleAppOrder()}
function renderApps(){
 iconObserver?.disconnect();const host=$("appList");host.replaceChildren();const list=visibleApps();
 if(!list.length){appendEmpty(host,S.apps.length?"未找到匹配的应用":"暂无可用应用",$("search").value?"search":null);showListSummary();return}
 for(const app of list){
 const b=document.createElement("button");b.type="button";b.className="app-row";b.dataset.packageName=app.packageName;const img=S.showIcons?makeAppIcon(app,true):null,copy=document.createElement("div");copy.className="app-copy";
 const name=document.createElement("div");name.className="app-name";name.textContent=S.showNames?app.appLabel:app.packageName;copy.append(name);
 if(S.showNames){const pkg=document.createElement("div");pkg.className="package";pkg.textContent=app.packageName;copy.append(pkg)}
 const state=document.createElement("div");state.className="locale-state";copy.append(state);if(img)b.append(img);b.append(copy);decorateLocaleRow(b,app);b.onclick=()=>openDetail(app);host.append(b);
 }
 scheduleAppOrder();showListSummary();LSUI.bind();updateBusy();
}
function renderCurrentStatus(commandAvailable){
 const title=$("currentStatusTitle"),message=$("currentStatusMessage");let warning=false;
 if(!S.configValid){warning=true;title.textContent="配置检查未通过";message.textContent=P.errorText(S.configError)}
 else if(S.operationState==="pending"){warning=true;title.textContent="有待恢复操作";message.textContent="此前的语言操作尚未确认。核对会读取当前 Android 设置并保存结果，不会重新执行语言修改。"}
 else if(S.operationState===null||uncertain){warning=true;title.textContent="操作状态无法确认";message.textContent="请刷新状态，确认是否需要核对待恢复操作。"}
 else if(!commandAvailable){warning=true;title.textContent="语言接口暂不可用";message.textContent="当前检测未确认语言读写能力，请查看环境与原始日志。"}
 else{title.textContent="当前可设置应用语言";message.textContent="配置与操作状态检查通过。仅能核对 Android 的语言设置，无法检测应用界面。"}
 $("currentStatus").dataset.warning=String(warning);$("currentStatusTitle").dataset.icon=warning?"⚠":"";
 $("recoverOperation").hidden=S.operationState!=="pending";
}
async function loadDiagnostics(){
 if(S.diagnosing||busy)return;S.diagnosing=true;updateBusy();
 try{
 await loadConfig();const host=$("diagnostics");host.replaceChildren();let sys="",cmd="";
 try{const r=await execAsync("getprop ro.build.version.release");if(r.code===0)sys=r.out.trim()}catch(e){recordError(e.message)}
 try{const r=await execAsync("command -v cmd >/dev/null 2>&1 || { printf unavailable; exit; }; help=$(cmd locale help 2>&1); case \"$help\" in *get-app-locales*) case \"$help\" in *set-app-locales*) printf available;; *) printf unavailable;; esac;; *) printf unavailable;; esac");if(r.code===0)cmd=r.out.trim()}catch(e){recordError(e.message)}
 const bridge=api(),rootAPI=bridge&&(typeof bridge.spawn==="function"||typeof bridge.exec==="function");
 const rows=[["当前 Android 用户",S.user||"无法确认"],["待恢复操作",S.operationState===null?"无法确认":S.operationState==="pending"?"需要核对":"无"],["Android",sys?sys+" (API "+S.sdk+")":"无法确认"],["KernelSU Next 接口",rootAPI?"可用":"不可用"],["应用列表接口",C.packageNamesFromBridge(bridge)?"可用":"使用系统包管理器"],["图标读取",bridge&&typeof bridge.getPackagesIcons==="function"?"可用":"宿主图标回退"],["cmd locale",cmd==="available"?"可用":"不可用"],["语言列表",LOCALE_CATALOG_SOURCE],["配置检查",S.configValid?"通过":"未通过"],["上次保存",storage.getItem("language_selector.saved."+S.user)||"暂无记录"]];
 for(const [k,v]of rows){const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=k;dd.textContent=v;host.append(dt,dd)}
 renderCurrentStatus(cmd==="available");const raw=[];
 try{const out=await backend("status");S.bootRaw=out;raw.push(out);const history=P.bootResult(out);
 $("operationStatus").textContent="上次启动："+history.title+(history.finished?"\n执行时间："+history.finished:history.started?"\n开始时间："+history.started:"\n执行时间：无记录")+(history.message?"\n"+history.message:"");
 if(history.success!==null&&history.failed!==null&&history.summary!=="completed")$("operationStatus").textContent+="\n已记录：成功 "+history.success+"，失败 "+history.failed;
 }catch(e){recordError(e.message);$("operationStatus").textContent="无法读取上次开机执行记录。当前状态与历史结果分别显示。";raw.push("Boot status read error: "+e.message)}
 const operation=storage.getItem("language_selector.operation."+S.user),time=storage.getItem("language_selector.operationTime."+S.user);
 if(operation)$("operationStatus").textContent+="\n最近手动执行："+operation+"\n执行时间："+(time||"未记录");
 let persisted=[];try{const values=JSON.parse(storage.getItem("language_selector.errors")||"[]");if(Array.isArray(values))persisted=values.filter(x=>typeof x==="string")}catch(_){}
 const errors=[...new Set([...S.errors,...persisted])];if(errors.length)raw.push("Recent WebUI errors:\n"+errors.join("\n"));
 $("rawStatus").textContent=raw.join("\n\n")||"暂无原始日志";
 }finally{S.diagnosing=false;updateBusy()}
}
async function copyLogs(){
 const text=$("rawStatus").textContent;if(!text)return;
 try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw Error("Clipboard unavailable");announce("日志已复制")}
 catch(_){const input=document.createElement("textarea");input.className="sr-only";input.value=text;document.body.append(input);input.select();let ok=false;try{ok=document.execCommand("copy")}catch(_){}input.remove();$("copyLogs").focus({preventScroll:true});announce(ok?"日志已复制":"无法复制，请长按日志选取。")}
}
let searchScroll=0,searchViewport=0,keyboardSeen=false;
function setDetailSearch(active){
 const page=$("detailPage");if(page.classList.contains("searching")===active)return;
 if(active){searchViewport=window.visualViewport?.height||innerHeight;keyboardSeen=false;searchScroll=$("main").scrollTop;page.classList.add("searching");$("detailSummary").hidden=false;requestAnimationFrame(()=>$("localeSearch").scrollIntoView({block:"nearest"}))}
 else{page.classList.remove("searching");$("detailSummary").hidden=true;if(S.page==="detail")requestAnimationFrame(()=>{$("main").scrollTop=searchScroll})}
}
function installTapFeedback(){LSUI.bind()}
function addNav(){
LSUI.init({page:page=>{S.page=page;syncProgressVisibility();if(page!=="detail")setDetailSearch(false);if(page==="apps"&&initialized&&!S.apps.length&&!S.loading)void loadApps()},detail:pkg=>{const app=S.apps.find(x=>x.packageName===pkg)||S.selected;if(!app||app.packageName!==pkg)return false;renderDetail(app);return true},diagnostics:loadDiagnostics,error:e=>{recordError(e.message);announce(P.errorText(e))}});
$("refresh").onclick=async()=>{if(S.refreshing||busy||S.loading)return;S.refreshing=true;updateBusy();try{await loadConfig();if(S.page==="detail"&&S.selected)await refreshAppLocale(S.selected);else await loadApps()}finally{S.refreshing=false;updateBusy()}};
$("copyLogs").onclick=copyLogs;
$("wrapLogs").onclick=()=>{const wrap=$("wrapLogs").getAttribute("aria-pressed")!=="true";$("wrapLogs").setAttribute("aria-pressed",String(wrap));$("rawStatus").classList.toggle("wrap",wrap)};
$("localeSearch").addEventListener("focus",()=>setDetailSearch(true));
$("localeSearch").addEventListener("pointerdown",()=>setDetailSearch(true),{passive:true});
window.visualViewport?.addEventListener("resize",()=>{if(!$("detailPage").classList.contains("searching"))return;const height=window.visualViewport.height;if(height<searchViewport-120)keyboardSeen=true;else if(keyboardSeen&&height>=searchViewport-80)setDetailSearch(false)});
$("detailPage").addEventListener("focusout",()=>setTimeout(()=>{if(!document.activeElement?.closest(".language-picker"))setDetailSearch(false)},0));
function syncAppDisplay(){for(const [id,on]of [["appIconsSwitch",S.showIcons],["appNamesSwitch",S.showNames]])$(id).setAttribute("aria-checked",String(on));$("search").placeholder=S.showNames?"应用名称或包名":"包名"}
syncAppDisplay();
$("appIconsSwitch").onclick=()=>{S.showIcons=!S.showIcons;storage.setItem("language_selector.showAppIcons",String(S.showIcons));syncAppDisplay();renderApps()};
$("appNamesSwitch").onclick=async()=>{S.showNames=!S.showNames;storage.setItem("language_selector.showAppNames",String(S.showNames));syncAppDisplay();renderApps();await loadApps()};
function bindSearch(id,changed){
 const input=$(id),clear=$(id+"Clear");let composing=false;
 const sync=()=>{clear.hidden=!input.value};
 input.addEventListener("compositionstart",()=>{composing=true});
 input.addEventListener("compositionend",()=>{composing=false;sync();changed()});
 input.addEventListener("input",event=>{sync();if(!composing&&!event.isComposing)changed()});
 clear.addEventListener("pointerdown",event=>event.preventDefault());
 clear.onclick=()=>{input.value="";composing=false;sync();input.focus({preventScroll:true});changed()};
 sync();
}
bindSearch("search",renderApps);
bindSearch("localeSearch",()=>{S.localeQuery=$("localeSearch").value;renderLocales()});
$("systemSwitch").onclick=()=>{S.showSystem=!S.showSystem;$("systemSwitch").setAttribute("aria-checked",String(S.showSystem));renderApps()};
$("restoreDefault").onclick=restoreDefault;
$("recoverOperation").onclick=()=>LSUI.showDialog("核对待恢复操作","读取当前 Android 语言设置并保存核对结果，不会重新执行此前的语言修改。",[{label:"取消"},{label:"核对",run:async()=>{if(busy)return;busy=true;updateBusy();try{await acceptConfig(await backend("recover",[],true));uncertain=false;$("recoverOperation").hidden=true;announce("已按当前设置完成核对");await loadConfig();await loadApps()}catch(e){announce(P.errorText(e));recordError(e.message)}finally{busy=false;updateBusy()}}}]);
$("autoSwitch").onclick=()=>mutation(async()=>{const next={...S.configs,autoApplyOnBoot:!S.configs.autoApplyOnBoot};try{await saveConfig(next);announce(next.autoApplyOnBoot?"已开启开机应用":"已关闭开机应用")}catch(e){announce(P.errorText(e));recordError(e.message)}});
}
async function init(){
addNav();updateBusy();const slow=setTimeout(()=>window.LSReady(),6000);
try{await loadConfig();await loadLocaleCatalog();$("autoSwitch").setAttribute("aria-checked",String(S.configs.autoApplyOnBoot));await loadApps();}
finally{clearTimeout(slow);initialized=true;updateBusy();window.LSReady();}
}
document.addEventListener("DOMContentLoaded",init);
})();
