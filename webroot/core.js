(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.LSCore=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const PKG=/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;
const LOCALE=/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
function validPackage(v){return typeof v==="string"&&v.length<=255&&PKG.test(v)}
function validUserId(v){return typeof v==="string"&&/^\d+$/.test(v)}
function validLocale(v){if(typeof v!=="string"||v.length>63||!LOCALE.test(v)||v.startsWith("-"))return false;try{return typeof Intl==="undefined"||typeof Intl.getCanonicalLocales!=="function"||Intl.getCanonicalLocales(v).length===1}catch(e){return false}}
function normalizeConfig(v){if(!v||typeof v!=="object"||Array.isArray(v))throw Error("JSON root must be an object");if(v.schemaVersion!==1)throw Error("Unsupported schemaVersion: "+String(v.schemaVersion));if(typeof v.autoApplyOnBoot!=="boolean")throw Error("autoApplyOnBoot must be boolean");if(!Array.isArray(v.apps))throw Error("apps must be an array");const seen=new Set(),apps=[];for(const item of v.apps){if(!item||typeof item!=="object"||!validPackage(item.packageName))throw Error("Invalid package name");if(seen.has(item.packageName))throw Error("Duplicate package: "+item.packageName);seen.add(item.packageName);if(item.followSystem!==true&&(!validLocale(item.localeTag)))throw Error("Invalid Locale tag for "+item.packageName);apps.push({packageName:item.packageName,followSystem:item.followSystem===true,localeTag:item.followSystem===true?null:item.localeTag})}return{schemaVersion:1,autoApplyOnBoot:v.autoApplyOnBoot,apps}}
function toInternal(c){const n=normalizeConfig(c),lines=["schema=1","auto="+(n.autoApplyOnBoot?"1":"0")];for(const a of n.apps)lines.push("app="+a.packageName+"|"+(a.followSystem?"@system":a.localeTag));return lines.join("\n")+"\n"}
function parseInternal(text){if(typeof text!=="string"||!text.startsWith("schema=1\n"))throw Error("Missing or incompatible config header");const lines=text.trimEnd().split(/\r?\n/),obj={schemaVersion:1,autoApplyOnBoot:false,apps:[]};let schema=false,auto=false;for(const line of lines){if(line==="schema=1"){if(schema)throw Error("Duplicate schema");schema=true}else if(line==="auto=0"||line==="auto=1"){if(auto)throw Error("Duplicate auto flag");auto=true;obj.autoApplyOnBoot=line==="auto=1"}else if(line.startsWith("app=")){const p=line.slice(4),i=p.indexOf("|");if(i<1||i===p.length-1)throw Error("Malformed app entry");const locale=p.slice(i+1);obj.apps.push({packageName:p.slice(0,i),followSystem:locale==="@system",localeTag:locale==="@system"?null:locale})}else throw Error("Unknown config line")}if(!schema||!auto)throw Error("Missing required config fields");return normalizeConfig(obj)}
function shellQuote(s){return "'"+String(s).replace(/'/g,"'\"'\"'")+"'"} 
function parseLocaleOutput(stdout){const m=String(stdout).match(/are\s+\[([^\]]*)\]/i);if(!m)return{ok:false,reason:/Unknown package/i.test(stdout)?"package-unavailable":"read-failed",raw:String(stdout)};const tags=m[1].trim();return tags?{ok:true,followSystem:false,localeTag:tags.split(",")[0].trim(),raw:String(stdout)}:{ok:true,followSystem:true,localeTag:null,raw:String(stdout)}}
function parseDeviceLocales(output){const seen=new Set(),result=[];for(const line of String(output||"").split(/\r?\n/)){const tag=line.trim();if(!validLocale(tag))continue;let canonical=tag;try{if(typeof Intl!=="undefined"&&typeof Intl.getCanonicalLocales==="function")canonical=Intl.getCanonicalLocales(tag)[0]}catch(e){continue}if(!seen.has(canonical)){seen.add(canonical);result.push(canonical)}}return result}
function packageNamesFromBridge(bridge){
 if(!bridge||typeof bridge!=="object")return null;
 const parse=value=>{if(Array.isArray(value))return value;if(typeof value==="string"){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:null}catch(e){return null}}return null};
 const clean=values=>[...new Set(values.filter(validPackage))];
 try{if(typeof bridge.listPackages==="function"){const names=parse(bridge.listPackages("all"));if(names){const filtered=clean(names);if(filtered.length)return filtered}}}catch(e){}
 try{if(typeof bridge.listAllPackages==="function"){const names=parse(bridge.listAllPackages());if(names){const filtered=clean(names);if(filtered.length)return filtered}}}catch(e){}
 try{if(typeof bridge.listUserPackages==="function"&&typeof bridge.listSystemPackages==="function"){const users=parse(bridge.listUserPackages()),systems=parse(bridge.listSystemPackages());if(users&&systems){const filtered=clean([...users,...systems]);if(filtered.length)return filtered}}}catch(e){}
 return null
}
function packageNamesFromPm(output){return cleanPackages(String(output||"").split(/\r?\n/).map(line=>line.trim().replace(/^package:/,"")))}
function cleanPackages(values){return [...new Set(values.filter(validPackage))]}
return{validPackage,validUserId,validLocale,normalizeConfig,toInternal,parseInternal,shellQuote,parseLocaleOutput,parseDeviceLocales,packageNamesFromBridge,packageNamesFromPm}
});
