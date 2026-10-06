(function(root,factory){const value=factory(typeof module==="object"&&module.exports?require("./core.js"):root.LSCore);if(typeof module==="object"&&module.exports)module.exports=value;root.LSPresentation=value})(typeof globalThis!=="undefined"?globalThis:this,C=>{
"use strict";
function languageName(tag){
 const fixed={"zh-CN":"中文（简体，中国）","zh-Hans-CN":"中文（简体，中国）","zh-TW":"中文（繁体，台湾）","zh-Hant-TW":"中文（繁体，台湾）","zh-Hans":"中文（简体）","zh-Hant":"中文（繁体）"};
 if(fixed[tag])return fixed[tag];if(!C.validLocale(tag))return String(tag||"");
 try{const locale=new Intl.Locale(tag),base=new Intl.DisplayNames(["zh-CN"],{type:"language"}).of(locale.language);if(!base||base===locale.language)return tag;const extra=[];if(locale.script)extra.push(new Intl.DisplayNames(["zh-CN"],{type:"script"}).of(locale.script));if(locale.region)extra.push(new Intl.DisplayNames(["zh-CN"],{type:"region"}).of(locale.region));return extra.length?base+"（"+extra.join("，")+"）":base}catch(_){return tag}
}
function actualTags(actual){return actual?.ok&&!actual.followSystem?(actual.localeTags||[actual.localeTag]).filter(C.validLocale):[]}
function detailState(app,entry){
 const actual=app.locale,known=actual?.ok===true,tags=actualTags(actual),matched=known&&!!entry&&(entry.followSystem?actual.followSystem:!actual.followSystem&&tags.length===1&&C.sameLocale(tags[0],entry.localeTag));
 return{showCurrent:known,showConfigured:!!entry&&!matched,kind:matched?"verified":entry&&known?"mismatch":!known?"unknown":"current",text:matched?"✓ 与配置一致":entry&&known?"当前设置与配置不一致":!known?(app.checking?(entry?"正在确认是否生效…":"正在读取语言设置…"):"无法确认是否生效"):entry?"":"未在模块中配置"};
}
function readingText(actual){if(!actual)return"正在读取语言设置…";if(!actual.ok)return"无法读取语言设置";return actual.followSystem?"跟随系统":actualTags(actual).map(languageName).join("、")}
function configuredState(app,settings){
 const target=C.moduleLocale(app,settings);
 if(!target)return{kind:!app.locale?"loading":!app.locale.ok?"unknown":"current",text:readingText(app.locale),note:"",configured:false};
 const saved="已配置："+languageName(target.localeTag);
 if(!app.locale)return{kind:app.checking?"checking":"saved",text:saved,note:app.checking?"正在确认是否生效…":"尚未确认是否生效",configured:true};
 if(!app.locale.ok)return{kind:"unknown",text:"无法确认是否生效",note:saved,configured:true};
 if(!app.locale.followSystem&&actualTags(app.locale).length===1&&C.sameLocale(app.locale.localeTag,target.localeTag))return{kind:"verified",text:"已生效："+languageName(target.localeTag),note:"",configured:true};
 return{kind:"mismatch",text:"未生效 · 当前："+readingText(app.locale),note:saved,configured:true};
}
function errorText(error){
 const value=String(error?.message||error||"");
 const rules=[
 [/Android user changed|用户已切换|foreground user/i,"检测到 Android 用户变化，请刷新状态。"],
 [/Cannot read Android user|determine current Android user|Invalid foreground user/i,"无法确认当前 Android 用户，请刷新状态。"],
 [/Another module operation is active/i,"其他操作正在执行，请稍后刷新状态。"],
 [/File locking|Bad file descriptor/i,"无法获取配置锁，已停止写入。请查看原始日志。"],
 [/Root context|异步执行 API|执行 API/i,"KernelSU Next 接口不可用，请检查 Manager。"],
 [/Unsafe|Invalid configuration|Invalid package entry|Duplicate package|config header|configuration headers|Unsupported schema|Configuration too large|Cannot read configuration/i,"配置检查未通过，已停止写入。请查看原始日志。"],
 [/pending|unfinished|未完成|未确认|需核对|reconcile|journal/i,"操作尚未确认，请到运行状态页核对待恢复操作。"],
 [/timeout|超时/i,"读取或执行超时，请刷新状态确认结果。"],
 [/Locale verification mismatch/i,"当前语言设置与目标不一致，请刷新后确认。"],
 [/Locale write failed/i,"语言设置未完成，请核对当前语言设置。"],
 [/Cannot save|save failed|保存失败/i,"配置保存失败，请查看原始日志。"],
 [/Android 13|Android version/i,"需要 Android 13 或更高版本，且须能确认系统版本。"]];
 for(const [pattern,text]of rules)if(pattern.test(value))return text;
 return /[\u3400-\u9fff]/.test(value)&&!/[A-Za-z]{5,}/.test(value.replace(/Android|KernelSU|Next|Manager|API/g,""))?value:"操作未能完成，请查看原始日志。";
}
function bootResult(raw){
 const fields={};for(const line of String(raw||"").split(/\r?\n/)){const i=line.indexOf("=");if(i>0)fields[line.slice(0,i)]=line.slice(i+1)}
 const summary=fields.summary||"",success=/^\d+$/.test(fields.success||"")?Number(fields.success):null,failed=/^\d+$/.test(fields.failed||"")?Number(fields.failed):null;
 let title="暂无开机执行记录",message="";
 if(summary==="boot apply disabled"){title="开机应用已关闭";message="该次启动未执行已保存的语言配置。"}
 else if(summary==="completed"){title="开机应用已完成";message="成功 "+(success??"未知")+"，失败 "+(failed??"未知")+"。"}
 else if(/Android user changed/i.test(summary)){title="开机应用已中断";message="执行时检测到 Android 用户变化，已停止继续应用。刷新状态只重新检测，不会重试。"}
 else if(/Unfinished|unfinished/i.test(summary)){title="开机应用未完成";message="有语言操作等待核对，请查看当前待恢复状态。"}
 else if(/not ready/i.test(summary)){title="开机应用未执行";message="等待语言服务就绪超时。"}
 else if(/deadline/i.test(summary)){title="开机应用已中断";message="达到执行时间限制，已停止继续应用。"}
 else if(summary){title="开机应用未完成";message=errorText(summary);}
 return{title,message,finished:fields.finished||"",started:fields.started||"",success,failed,summary};
}
return{languageName,readingText,configuredState,detailState,actualTags,errorText,bootResult};
});
