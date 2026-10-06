(function(root,factory){const value=factory();if(typeof module==="object"&&module.exports)module.exports=value;root.LSBridge=value})(typeof globalThis!=="undefined"?globalThis:this,()=>{
"use strict";
let sequence=0;
function createExecutor(host,{callbacks=globalThis,onUncertain=()=>{},timeoutMs=30000,setTimer=setTimeout,clearTimer=clearTimeout,maxOutput=1048576}={}){
 return (command,{mutation=false}={})=>new Promise((resolve,reject)=>{
  if(!host||(typeof host.spawn!=="function"&&typeof host.exec!=="function"))return reject(Error("KernelSU Next 异步执行 API 不可用"));
  const name="__ls_cb_"+(++sequence);let done=false,size=0;const out=[],err=[];
  function finish(error,result){if(done)return;done=true;clearTimer(timer);delete callbacks[name];if(error)reject(error);else resolve(result)}
  const timer=setTimer(()=>{if(mutation)onUncertain();finish(Error("Root 命令超时；请在诊断页核对未完成操作，勿重复应用。"))},timeoutMs);
  function exit(value){
   if(!/^[0-9]{1,3}$/.test(String(value))||!Number.isInteger(Number(value))||Number(value)>255)return finish(Error("执行器返回无效退出码"));
   if(size>maxOutput)return finish(Error("执行器输出超过限制"));
   finish(null,{code:Number(value),out:out.join("\n"),err:err.join("\n")});
  }
  function append(target,data){if(done)return;if(typeof data!=="string")return finish(Error("执行器返回无效输出"));size+=data.length;if(size<=maxOutput)target.push(data)}
  if(typeof host.spawn==="function"){
   callbacks[name]={stdout:{emit:(event,data)=>{if(event==="data")append(out,data)}},stderr:{emit:(event,data)=>{if(event==="data")append(err,data)}},emit:(event,data)=>{if(event==="exit")exit(data);else if(event==="error")finish(Error(data?.message||"Root 命令启动失败"))}};
   const quoted="'"+String(command).replace(/'/g,"'\"'\"'")+"'";
   try{host.spawn("/system/bin/sh",JSON.stringify(["-c",quoted]),"{}",name)}catch(e){finish(e)}
  }else{
   callbacks[name]=(code,stdout,stderr)=>{if(done)return;append(out,stdout||"");append(err,stderr||"");exit(code)};
   try{host.exec(command,"{}",name)}catch(e){finish(e)}
  }
 });
}
return{createExecutor};
});
