const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync,spawn}=require('node:child_process');
process.umask(0o077);
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ls-security-')),data=path.join(root,'data'),bin=path.join(root,'bin'),log=path.join(root,'calls'),actual=path.join(root,'actual'),user=path.join(root,'user');
 fs.mkdirSync(data);fs.mkdirSync(bin);fs.writeFileSync(actual,'en-US');fs.writeFileSync(user,'0');
 const put=(name,body)=>{fs.writeFileSync(path.join(bin,name),'#!/bin/sh\n'+body);fs.chmodSync(path.join(bin,name),0o700)};
 put('am','cat '+JSON.stringify(user));
 put('getprop','case "$1" in ro.build.version.sdk) echo 36;; sys.boot_completed) echo 1;; esac');
 put('cmd','printf "%s\\n" "$*" >> '+JSON.stringify(log)+'\ncase "$1 $2" in "locale help") echo "set-app-locales get-app-locales";; "locale set-app-locales") if [ "$6" = --locales ]; then printf "%s" "$7" > '+JSON.stringify(actual)+'; else : > '+JSON.stringify(actual)+'; fi;; "locale get-app-locales") echo "Locales for $3 for user $5 are [$(cat '+JSON.stringify(actual)+')]";; esac');
 const env={...process.env,LS_DATA_DIR:data,PATH:bin+':'+process.env.PATH};
 const shell=process.env.LS_TEST_SHELL||'sh',prefix=process.env.LS_TEST_SHELL?['sh']:[];
 const run=(...args)=>spawnSync(shell,[...prefix,'control.sh',...args],{env,encoding:'utf8',timeout:15000});
 const cfg=path.join(data,'config.v1');fs.writeFileSync(cfg,'schema=1\nauto=0\napp=com.example.keep|fr-FR\n');
 return{root,data,bin,log,actual,user,cfg,put,env,run,shell,prefix,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('corrupt configuration blocks writes without replacing original',()=>{const f=fixture();try{const bad='schema=99\nauto=1\n';fs.writeFileSync(f.cfg,bad);const r=f.run('locale','0','com.example.app','ja-JP');assert.notEqual(r.status,0);assert.equal(fs.existsSync(f.log),false);assert.equal(fs.readFileSync(f.cfg,'utf8'),bad)}finally{f.cleanup()}});
test('single-entry mutations preserve latest unrelated entries and isolate users',()=>{const f=fixture();try{
 assert.equal(f.run('locale','0','com.example.app','ja-JP').status,0);assert.match(fs.readFileSync(f.cfg,'utf8'),/com.example.keep\|fr-FR/);
 fs.writeFileSync(f.user,'10');const r=f.run('read','10');assert.equal(r.status,0);assert.doesNotMatch(r.stdout,/com.example.keep/);
 assert.equal(f.run('locale','10','com.example.app','zh-Hans-CN').status,0);assert.match(fs.readFileSync(f.cfg,'utf8'),/com.example.app\|ja-JP/);
 assert.match(fs.readFileSync(path.join(f.data,'users/10/config.v1'),'utf8'),/zh-Hans-CN/);
 assert.notEqual(f.run('locale','0','com.example.app','en-US').status,0);
}finally{f.cleanup()}});
test('configuration, directory and lock links are rejected; old temp links are untouched',()=>{for(const which of ['config','directory','lock','oldtemp']){const f=fixture();try{
 const victim=path.join(f.root,'victim');fs.writeFileSync(victim,'SENTINEL');
 if(which==='config'){fs.unlinkSync(f.cfg);fs.symlinkSync(victim,f.cfg)}
 if(which==='directory'){fs.renameSync(f.data,f.data+'-real');fs.symlinkSync(f.data+'-real',f.data)}
 if(which==='lock')fs.symlinkSync(victim,path.join(f.data,'state.lock'));
 if(which==='oldtemp')fs.symlinkSync(victim,f.cfg+'.tmp');
 const r=f.run('auto','0','1');assert.equal(r.status===0,which==='oldtemp');assert.equal(fs.readFileSync(victim,'utf8'),'SENTINEL');
}finally{f.cleanup()}}});
test('unsafe file permissions and malicious arguments fail before locale writes',()=>{const f=fixture();try{
 fs.chmodSync(f.cfg,0o666);assert.notEqual(f.run('auto','0','1').status,0);fs.chmodSync(f.cfg,0o600);
 for(const args of [['locale','0','com.example.app;id','en-US'],['locale','0','com.example.app','en;id'],['read','00'],['unknown','0']])assert.notEqual(f.run(...args).status,0);
 assert.equal(fs.existsSync(f.log),false);
}finally{f.cleanup()}});
test('interrupted writes remain pending across invocation; recovery never repeats set',()=>{const f=fixture();try{
 f.put('cmd','printf "%s\\n" "$*" >> '+JSON.stringify(f.log)+'\nif [ "$2" = set-app-locales ]; then printf ja-JP > '+JSON.stringify(f.actual)+'; exit 1; fi\necho "Locales for $3 for user $5 are [$(cat '+JSON.stringify(f.actual)+')]"');
 assert.notEqual(f.run('locale','0','com.example.app','ja-JP').status,0);assert.equal(f.run('state','0').stdout,'pending');
 assert.notEqual(f.run('auto','0','1').status,0);
 const before=fs.readFileSync(f.log,'utf8').match(/set-app-locales/g).length;
 assert.equal(f.run('recover','0').status,0);assert.equal(f.run('state','0').stdout,'ready');
 assert.equal(fs.readFileSync(f.log,'utf8').match(/set-app-locales/g).length,before);
 assert.match(fs.readFileSync(f.cfg,'utf8'),/com.example.app\|ja-JP/);
}finally{f.cleanup()}});
test('boot uses its validated snapshot when original file changes',()=>{const f=fixture();try{
 fs.writeFileSync(f.cfg,'schema=1\nauto=1\napp=com.example.original|en-US\n');
 f.put('getprop','case "$1" in ro.build.version.sdk) printf "schema=99\\nauto=0\\napp=com.example.unvalidated|fr-FR\\n" > '+JSON.stringify(f.cfg)+'; echo 36;; sys.boot_completed) echo 1;; esac');
 const r=spawnSync(f.shell,[...f.prefix,'boot-completed.sh'],{env:f.env,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);
 const calls=fs.readFileSync(f.log,'utf8');assert.match(calls,/set-app-locales com.example.original/);assert.doesNotMatch(calls,/unvalidated/);
}finally{f.cleanup()}});
test('kernel lock survives neither process exit nor an obsolete boot.lock directory',()=>{const f=fixture();try{fs.mkdirSync(path.join(f.data,'boot.lock'));assert.equal(f.run('auto','0','1').status,0);assert.equal(f.run('auto','0','0').status,0)}finally{f.cleanup()}});
test('boot accepts Chinese script aliases and reversed help command order',()=>{const f=fixture();try{
 fs.writeFileSync(f.cfg,'schema=1\nauto=1\napp=com.example.app|zh-Hans-CN\n');
 f.put('cmd','case "$2" in help) echo "set-app-locales get-app-locales";; get-app-locales) echo "Locales for $3 for user $5 are [zh-CN]";; esac');
 const r=spawnSync(f.shell,[...f.prefix,'boot-completed.sh'],{env:f.env,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);
 assert.match(fs.readFileSync(path.join(f.data,'boot-status.txt'),'utf8'),/success=1/);assert.equal(fs.existsSync(path.join(f.data,'pending.v1')),false);
}finally{f.cleanup()}});
test('concurrent clients serialize and preserve both app updates',async()=>{const f=fixture();try{
 const run=pkg=>new Promise(resolve=>{const child=spawn(f.shell,[...f.prefix,'control.sh','locale','0',pkg,'ja-JP'],{env:f.env});let err='';child.stderr.on('data',x=>err+=x);child.on('close',code=>resolve({code,err}))});
 const result=await Promise.all([run('com.example.one'),run('com.example.two')]);result.forEach(r=>assert.equal(r.code,0,r.err));
 const text=fs.readFileSync(f.cfg,'utf8');assert.match(text,/com.example.one\|ja-JP/);assert.match(text,/com.example.two\|ja-JP/);assert.match(text,/com.example.keep\|fr-FR/);
}finally{f.cleanup()}});
test('hanging locale commands time out and retain a recoverable journal',()=>{const f=fixture();try{
 f.put('cmd','if [ "$2" = set-app-locales ]; then /bin/sleep 30; else echo "Locales for $3 for user $5 are [en-US]"; fi');
 const start=Date.now(),r=f.run('locale','0','com.example.app','ja-JP');assert.notEqual(r.status,0);assert.ok(Date.now()-start<12000);assert.equal(f.run('state','0').stdout,'pending');
 assert.equal(f.run('recover','0').status,0);assert.match(fs.readFileSync(f.cfg,'utf8'),/com.example.app\|en-US/);
}finally{f.cleanup()}});
