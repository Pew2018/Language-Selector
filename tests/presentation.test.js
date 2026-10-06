const test=require('node:test'),assert=require('node:assert/strict'),P=require('../webroot/presentation.js');
const saved=[{packageName:'com.example.reader',followSystem:false,localeTag:'zh-Hans-CN'}];
const app=locale=>({packageName:'com.example.reader',locale});
test('saved, checking, verified, mismatched and unreadable settings remain distinct',()=>{
 assert.equal(P.configuredState(app(null),saved).kind,'saved');
 assert.equal(P.configuredState({...app(null),checking:true},saved).kind,'checking');
 const yes=P.configuredState(app({ok:true,followSystem:false,localeTag:'zh-CN'}),saved);assert.equal(yes.kind,'verified');assert.match(yes.text,/已生效/);
 const no=P.configuredState(app({ok:true,followSystem:false,localeTag:'en-US'}),saved);assert.equal(no.kind,'mismatch');assert.match(no.text,/当前/);
 assert.equal(P.configuredState(app({ok:false}),saved).text,'无法确认是否生效');
});
test('follow system requires an empty Android override and never compares system language',()=>{
 assert.equal(P.configuredState(app({ok:true,followSystem:true,localeTag:null}),[]).text,'跟随系统');
 assert.notEqual(P.configuredState(app({ok:true,followSystem:false,localeTag:'zh-CN'}),[]).text,'跟随系统');
 assert.equal(P.configuredState(app({ok:true,followSystem:true,localeTag:null}),saved).kind,'mismatch');
});
test('language labels avoid duplicate codes and handle unsupported display names',()=>{
 assert.equal(P.languageName('zh-Hans-CN'),'中文（简体，中国）');
 assert.equal(P.languageName('not a tag'),'not a tag');
 assert.equal(P.languageName('qaa'),'qaa');
});
test('boot history preserves interruption, timestamps and unknown counts without asserting current failure',()=>{
 const h=P.bootResult('started=2026-10-06T10:00:00+0800\nfinished=2026-10-06T10:00:02+0800\nsuccess=2\nfailed=0\nsummary=Invalid configuration: Android user changed; refresh before continuing\n');
 assert.equal(h.title,'开机应用已中断');assert.equal(h.success,2);assert.match(h.message,/不会重试/);assert.equal(h.finished,'2026-10-06T10:00:02+0800');
 assert.equal(P.bootResult('No boot apply has been recorded.').success,null);
 assert.equal(P.bootResult('summary=completed\nsuccess=0\nfailed=0\n').title,'开机应用已完成');
});
test('user errors are Chinese while the original error remains untouched',()=>{
 const raw='flock: Bad file descriptor';assert.match(P.errorText(raw),/配置锁/);assert.equal(raw,'flock: Bad file descriptor');
 assert.match(P.errorText('Android user changed; refresh before continuing'),/Android 用户变化/);
 assert.match(P.errorText('unexpected native exception'),/原始日志/);
});
