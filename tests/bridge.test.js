const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../webroot/core.js'),{createExecutor}=require('../webroot/bridge.js');
test('spawn quotes the complete shell program and handles real event order',async()=>{
 const callbacks={},host={spawn(command,args,options,name){
  assert.equal(command,'/system/bin/sh');assert.deepEqual(JSON.parse(args),['-c',C.shellQuote("printf '%s' 'a;$(id)'")]);assert.equal(options,'{}');
  const handler=callbacks[name];handler.stdout.emit('data','one');handler.stdout.emit('data','two');handler.stderr.emit('data','warning');handler.emit('exit',1);handler.emit('error',{message:'late error'});
 }};
 assert.deepEqual(await createExecutor(host,{callbacks})("printf '%s' 'a;$(id)'"),{code:1,out:'one\ntwo',err:'warning'});assert.equal(Object.keys(callbacks).length,0);
});
test('legacy exec handles callbacks and rejects malformed exit codes',async()=>{
 for(const code of [null,undefined,'bad',-1,256]){
  const callbacks={},host={exec(cmd,opts,name){callbacks[name](code,'are [en-US]','')}};
  await assert.rejects(createExecutor(host,{callbacks})('read'),/无效退出码/);
 }
});
test('mutation timeout reports uncertainty and ignores a late callback',async()=>{
 const callbacks={};let timer,handler,uncertain=0;
 const run=createExecutor({spawn(c,a,o,n){handler=callbacks[n]}},{callbacks,onUncertain:()=>uncertain++,setTimer:f=>(timer=f,1),clearTimer:()=>{}});
 const pending=run('write',{mutation:true});timer();await assert.rejects(pending,/超时/);
 handler.stdout.emit('data','late');handler.emit('exit',0);assert.equal(uncertain,1);assert.equal(Object.keys(callbacks).length,0);
});
test('read timeouts do not pretend to be uncertain writes; output overflow fails closed',async()=>{
 const callbacks={};let timer,uncertain=0;
 const run=createExecutor({spawn(){}},{callbacks,onUncertain:()=>uncertain++,setTimer:f=>(timer=f,1),clearTimer:()=>{}});
 const result=run('read');timer();await assert.rejects(result,/超时/);assert.equal(uncertain,0);
 const host={spawn(c,a,o,n){callbacks[n].stdout.emit('data','too long');callbacks[n].emit('exit',0)}};
 await assert.rejects(createExecutor(host,{callbacks,maxOutput:3})('read'),/超过限制/);
});
test('Android read failures and unexpected package/user/locale cannot verify success',async()=>{
 assert.equal(C.parseLocaleOutput('Locales for com.x.app for user 0 are [not_a_locale]').ok,false);
 assert.equal(C.parseLocaleOutput('Locales for com.x.app for user 10 are [en-US]','com.x.app','0').ok,false);
 assert.equal(C.parseLocaleOutput('Locales for com.x.other for user 0 are [en-US]','com.x.app','0').ok,false);
 const line=fs.readFileSync('webroot/app.js','utf8').split('\n').find(l=>l.startsWith('async function readLocale('));
 const ctx={C,checkPlatform(){},localeCommand(){return'read'},execAsync:async()=>({code:1,out:'Locales for com.x.app for user 0 are [en-US]',err:'error'})};
 vm.createContext(ctx);vm.runInContext(line,ctx);assert.equal((await ctx.readLocale('com.x.app','0')).ok,false);
});
