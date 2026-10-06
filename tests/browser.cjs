// Development browser smoke test. No real root commands; all host APIs mocked.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('webroot'),server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  if(process.env.LS_SCREENSHOT_DIR)fs.mkdirSync(process.env.LS_SCREENSHOT_DIR,{recursive:true});
  const context=await browser.newContext({viewport:{width:412,height:860},...(process.env.LS_SCREENSHOT_DIR?{recordVideo:{dir:process.env.LS_SCREENSHOT_DIR,size:{width:412,height:860}}}:{})}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.mockCommands=[];window.mockInfoCalls=0;window.mockIconCalls=0;window.mockLocale='';window.mockLocales={'com.example.music':'fr-FR','com.example.reader':'zh-CN'};window.mockConfig='schema=1\nauto=0\napp=com.example.reader|zh-Hans-CN\n';window.mockDelay=0;if(sessionStorage.getItem('mockConfig'))window.mockConfig=sessionStorage.getItem('mockConfig');if(sessionStorage.getItem('mockLocales'))window.mockLocales=JSON.parse(sessionStorage.getItem('mockLocales'));
   const icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#42A5F5"/></svg>');
   function execute(cmd,options,cb){window.mockCommands.push(cmd);let out='',code=0,err='';const op=/control\.sh' '(\w+)' '([0-9]+)'(?: '([^']*)')?(?: '([^']*)')?/.exec(cmd);
    if(op){const [,action,user,pkg,tag]=op;if(action==='locale'&&window.mockWriteFailure){sessionStorage.setItem('mockPending','true');code=1;err='Locale write failed; reconcile current state';sessionStorage.setItem('mockConfig',mockConfig);setTimeout(()=>window[cb]?.(code,out,err),3);return}if(!mockConfig.startsWith('schema=1')&&action!=='status'){code=1;err='Invalid configuration'}else if(action==='read')out=mockConfig;else if(action==='state')out=sessionStorage.getItem('mockPending')==='true'?'pending':'ready';else if(action==='status')out=window.mockBoot||'summary=boot apply disabled\nsuccess=0\nfailed=0\n';else if(action==='locale'){mockLocale=tag==='@system'?'':tag;mockLocales[pkg]=mockLocale;mockConfig=mockConfig.split('\n').filter(l=>!l.startsWith('app='+pkg+'|')).join('\n').trimEnd()+'\napp='+pkg+'|'+tag+'\n';out=mockConfig}else if(action==='auto'){mockConfig=mockConfig.replace(/^auto=[01]$/m,'auto='+pkg);out=mockConfig}else if(action==='recover'){sessionStorage.setItem('mockPending','false');out=mockConfig}}
    else if(cmd.includes('cmd package list packages'))out=cmd.includes(' -s')?'package:com.android.settings':cmd.includes(' -3')?'package:com.example.music\npackage:com.example.reader':'package:com.android.settings\npackage:com.example.music\npackage:com.example.reader';else if(cmd==='am get-current-user')out='0';else if(cmd==='getprop ro.build.version.sdk')out='36';else if(cmd.includes('cmd locale help'))out='available';else if(cmd.includes('list-device-locales'))out='en-US\nja-JP\nzh-Hans-CN\nzh-Hant-TW';else if(cmd.includes('get-app-locales')){const pkg=/get-app-locales '([^']+)'/.exec(cmd)?.[1]||'com.example.reader';if(window.mockReadFailure===pkg){code=1;err='Locale service read failed'}else out='Locales for '+pkg+' for user 0 are ['+(mockLocales[pkg]||'')+']'}else if(cmd.includes('getprop'))out='16\n36';
    sessionStorage.setItem('mockConfig',mockConfig);sessionStorage.setItem('mockLocales',JSON.stringify(mockLocales));setTimeout(()=>window[cb]?.(code,out,err),cmd.includes('get-app-locales')?(window.mockReadDelay||window.mockDelay||3):(window.mockDelay||3));
   }
   window.ksu={listPackages:()=>window.mockNoNative?null:JSON.stringify(['com.example.music','com.example.reader','com.android.settings']),getPackagesInfo:names=>(window.mockInfoCalls++,JSON.stringify(JSON.parse(names).map(packageName=>({packageName,appLabel:({'com.example.reader':'阅读器','com.example.music':'Music Player','com.android.settings':'系统设置'})[packageName],isSystem:packageName.startsWith('com.android.')})))),getPackagesIcons:names=>(window.mockIconCalls++,JSON.stringify(JSON.parse(names).map(packageName=>({packageName,icon})))),exec:execute,
    spawn(command,args,options,name){const program=JSON.parse(args)[1],cmd=program.slice(1,-1).replaceAll(String.fromCharCode(39,34,39,34,39),String.fromCharCode(39)),callback=name+'_mock';const handler=window[name];window[callback]=(code,out,err)=>{if(out)handler.stdout.emit('data',out);if(err)handler.stderr.emit('data',err);handler.emit('exit',code);if(code)handler.emit('error',{message:err});delete window[callback]};execute(cmd,options,callback);}
   };
  });
  await page.goto(url);await page.waitForSelector('html[data-loading="false"]');await page.waitForSelector('.app-row');
  await page.waitForFunction(()=>document.querySelector('.app-row .locale-state')?.dataset.status==='verified');
  assert.equal(await page.locator('[data-app-group="configured"]').textContent(),'已配置 · 1');
  assert.equal(await page.locator('.app-row').count(),2);await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
  assert.match(await page.locator('.app-row').first().locator('.locale-state').textContent(),/已生效：中文（简体，中国）/);
  await page.waitForFunction(()=>document.querySelector('.app-row .locale-state')?.textContent.includes('已生效'));
  // Observe real CSS animation over a complete cycle; counts never drive its geometry.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{mockReadDelay=5000});
  await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('listCount').textContent==='0 / 3');
  assert.equal(await page.getAttribute('#listProgress','aria-valuenow'),null);
  assert.equal(await page.locator('#listCount').textContent(),'0 / 3');
  assert.equal(await page.$eval('#listStatus',e=>getComputedStyle(e,'::before').content),'none');
  const motion=await page.evaluate(async()=>{
   const samples=[],start=performance.now();let previous=start,maxGap=0;
   await new Promise(resolve=>{function frame(now){maxGap=Math.max(maxGap,now-previous);previous=now;const a=document.querySelector('.primary-bar'),b=document.querySelector('.secondary-bar');samples.push({t:now-start,primary:getComputedStyle(a).transform,secondary:getComputedStyle(b).transform,scale1:getComputedStyle(a.firstElementChild).transform,scale2:getComputedStyle(b.firstElementChild).transform});if(now-start<2200)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
   return{samples,maxGap,source:'Headless Chromium animation observation; not device performance'};
  });
  assert.ok(new Set(motion.samples.map(s=>s.primary)).size>20);assert.ok(new Set(motion.samples.map(s=>s.scale1)).size>20);
  assert.ok(new Set(motion.samples.map(s=>s.secondary)).size>20);assert.ok(new Set(motion.samples.map(s=>s.scale2)).size>20);
  if(process.env.LS_SCREENSHOT_DIR){fs.writeFileSync(path.join(process.env.LS_SCREENSHOT_DIR,'progress-motion-observation.json'),JSON.stringify(motion,null,2));await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'progress-running.png')});}
  await page.click('[data-page=settings]');assert.equal(await page.$eval('.primary-bar',e=>getComputedStyle(e).animationPlayState),'paused');
  await page.click('[data-page=apps]');assert.equal(await page.$eval('.primary-bar',e=>getComputedStyle(e).animationPlayState),'running');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.$eval('.primary-bar',e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await page.$eval('.primary-bar',e=>getComputedStyle(e).animationPlayState),'running');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.$eval('.primary-bar',e=>getComputedStyle(e).animationName),'none');
  assert.match(await page.locator('#listStatus').textContent(),/正在读取/);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.getElementById('listProgress').hidden);
  assert.equal(await page.getAttribute('#appList','aria-busy'),'false');assert.equal(await page.locator('#listCount').isVisible(),false);
  // A new refresh supersedes old reads. Unknown package counts remain absent.
  await page.evaluate(()=>{mockReadDelay=600;mockNoNative=true;mockDelay=150});
  await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('listStatus').textContent.includes('正在加载'));
  assert.equal(await page.locator('#listCount').isVisible(),false);assert.equal(await page.locator('#listProgress').isVisible(),true);
  await page.waitForFunction(()=>document.getElementById('listStatus').textContent.includes('正在读取语言'));
  await page.evaluate(()=>{mockReadDelay=0;mockNoNative=false;mockDelay=3});await page.click('#refresh');
  await page.waitForFunction(()=>document.getElementById('listProgress').hidden);await page.waitForTimeout(700);
  assert.match(await page.locator('#listStatus').textContent(),/当前显示/);
  await page.focus('#search');
  assert.equal(await page.$eval('#search',e=>getComputedStyle(e).outlineStyle),'none');
  if(process.env.LS_SCREENSHOT_DIR){fs.mkdirSync(process.env.LS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'apps-light-focused.png')});}
  const initialWrites=await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27(locale|auto|recover)\x27/.test(c)).length);
  await page.click('[data-page=settings]');await page.click('#appearanceLink');await page.click('#themeChoice');await page.getByRole('radio',{name:'深色模式'}).click();await page.waitForSelector('.dialog',{state:'detached'});assert.equal(await page.getAttribute('html','data-theme'),'dark');
  await page.click('#cardsSwitch');await page.click('#toolbarSwitch');await page.click('#accentLink');await page.click('[data-color="#2196F3"]');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--primary-surface')),'#0066AD');
  for(const width of [320,360,412,760]){await page.setViewportSize({width,height:860});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.LS_SCREENSHOT_DIR){fs.mkdirSync(process.env.LS_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'accent-dark-'+width+'.png')});}}
  await page.click('#back');await page.waitForSelector('#appearancePage:not(.hidden)');await page.click('#back');await page.waitForSelector('#settingsPage:not(.hidden)');
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27(locale|auto|recover)\x27/.test(c)).length),initialWrites);
  await page.click('[data-page=apps]');await page.locator('.app-row').first().click();await page.waitForSelector('#detailPage:not(.hidden)');assert.equal(await page.locator('.bottom-nav').isVisible(),false);
  await page.waitForFunction(()=>document.getElementById('detailState').textContent==='✓ 与配置一致');
  assert.equal(await page.locator('#configuredLocaleGroup').isVisible(),false);
  assert.equal(await page.locator('#currentLocaleGroup').isVisible(),true);
  assert.equal(await page.$eval('#restoreDefault',e=>getComputedStyle(e).borderTopWidth),'0px');
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'detail-consistent.png')});
  assert.match(await page.locator('#commonLocales').textContent(),/中文（简体，中国）/);assert.match(await page.locator('#commonLocales').textContent(),/中文（繁体，台湾）/);
  await page.locator('.locale-option').filter({hasText:'ja-JP'}).click();await page.waitForSelector('[role=dialog]');await page.keyboard.press('Escape');await page.waitForSelector('.dialog',{state:'detached'});assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length),0);
  await page.locator('.locale-option').filter({hasText:'ja-JP'}).click();await page.getByRole('button',{name:'应用',exact:true}).click();await page.waitForFunction(()=>mockCommands.some(c=>c.includes("control.sh' 'locale'")));await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);assert.equal(await page.evaluate(()=>mockLocale),'ja-JP');
  const count=await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length);await page.goForward();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length),count);
  await page.click('#back');await page.waitForSelector('#appsPage:not(.hidden)');
  assert.equal(await page.locator('.app-row').first().getAttribute('data-package-name'),'com.example.reader');
  await page.locator('.app-row').first().click();await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);
  await page.evaluate(()=>{mockDelay=100});await page.click('#restoreDefault');
  await page.waitForFunction(()=>document.getElementById('restoreDefault').textContent.includes('正在恢复'));
  assert.equal(await page.locator('#restoreDefault').isDisabled(),true);
  const restoringCount=await page.evaluate(()=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length);
  await page.evaluate(()=>document.getElementById('restoreDefault').click());
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length),restoringCount);
  await page.evaluate(()=>{mockDelay=3});await page.waitForSelector('#followSystemStatus:not([hidden])');await page.click('#back');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.music');
  assert.equal(await page.locator('[data-app-group="configured"]').count(),0);
  await page.reload();await page.waitForSelector('html[data-loading="false"]');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.music');
  await page.fill('#search','music');assert.equal(await page.locator('.app-row').count(),1);await page.click('#searchClear');assert.equal(await page.locator('.app-row').count(),2);
  assert.equal(await page.$eval('#search',e=>e===document.activeElement),true);
  await page.evaluate(()=>{const input=document.getElementById('search');input.dispatchEvent(new CompositionEvent('compositionstart'));input.value='reader';input.dispatchEvent(new InputEvent('input',{isComposing:true}));});
  assert.equal(await page.locator('.app-row').count(),2);
  await page.evaluate(()=>document.getElementById('search').dispatchEvent(new CompositionEvent('compositionend')));
  assert.equal(await page.locator('.app-row').count(),1);
  await page.click('#searchClear');
  // Saving a language immediately returns this app above unrelated native locales.
  await page.locator('[data-package-name="com.example.reader"]').click();
  await page.locator('.locale-option').filter({hasText:'ja-JP'}).click();await page.getByRole('button',{name:'应用',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);
  await page.click('#back');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
  assert.match(await page.locator('.app-row').first().locator('.locale-state').textContent(),/已生效：/);
  await page.reload();await page.waitForSelector('html[data-loading="false"]');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
  await page.evaluate(()=>{localStorage.setItem('language_selector.errors','broken json');localStorage.setItem('language_selector.theme','dark');});
  await page.reload();await page.waitForSelector('html[data-loading="false"]');
  await page.setViewportSize({width:412,height:860});await page.focus('#search');
  assert.match(await page.locator('.app-row').first().locator('.locale-state').textContent(),/日语（日本）/);
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'apps-dark-focused.png')});
  await page.click('[data-page=settings]');await page.click('#diagnosticsLink');
  await page.waitForFunction(()=>document.getElementById('operationStatus').textContent.includes('开机应用已关闭'));
  assert.match(await page.locator('#diagnostics').textContent(),/cmd locale可用/);
  await page.click('#rawLogs summary');await page.click('#wrapLogs');assert.equal(await page.getAttribute('#wrapLogs','aria-pressed'),'true');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.click('#copyLogs');
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await page.locator('#rawStatus').textContent());
  await page.evaluate(()=>{window.mockBoot='started=2026-10-06T10:00:00+0800\nfinished=2026-10-06T10:00:02+0800\nsuccess=2\nfailed=0\nsummary=Invalid configuration: Android user changed; refresh before continuing\n'});
  await page.click('#diagnosticsRefresh');await page.waitForFunction(()=>document.getElementById('operationStatus').textContent.includes('开机应用已中断'));
  assert.match(await page.locator('#currentStatusTitle').textContent(),/当前可设置/);assert.match(await page.locator('#rawStatus').textContent(),/Android user changed/);
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'diagnostics-history.png')});
  await page.click('#back');await page.waitForSelector('#settingsPage:not(.hidden)');await page.click('[data-page=apps]');
  // Confirmed pointer up creates geometry; scroll and reduced motion suppress it.
  await page.waitForTimeout(550);
  await page.evaluate(()=>{const b=document.getElementById('systemSwitch');b.dispatchEvent(new PointerEvent('pointerdown',{isPrimary:true,button:0,pointerId:5,clientX:10,clientY:10}));b.dispatchEvent(new PointerEvent('pointerup',{isPrimary:true,button:0,pointerId:5,clientX:10,clientY:10}));});assert.equal(await page.locator('.tap-ripple').count(),1);await page.waitForTimeout(550);assert.equal(await page.locator('.tap-ripple').count(),0);
  await page.evaluate(()=>{const b=document.getElementById('systemSwitch');b.dispatchEvent(new PointerEvent('pointerdown',{isPrimary:true,button:0,pointerId:8,clientX:10,clientY:10}));b.dispatchEvent(new PointerEvent('pointercancel',{isPrimary:true,pointerId:8}));b.dispatchEvent(new PointerEvent('pointerup',{isPrimary:true,button:0,pointerId:8,clientX:10,clientY:10}));});
  assert.equal(await page.locator('.tap-ripple').count(),0);
  await page.evaluate(()=>{const b=document.getElementById('systemSwitch'),main=document.getElementById('main');main.scrollTop=0;b.dispatchEvent(new PointerEvent('pointerdown',{isPrimary:true,button:0,pointerId:9,clientX:10,clientY:10}));main.scrollTop=20;b.dispatchEvent(new PointerEvent('pointerup',{isPrimary:true,button:0,pointerId:9,clientX:10,clientY:40}));main.scrollTop=0;});
  assert.equal(await page.locator('.tap-ripple').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('#systemSwitch');assert.equal(await page.locator('.tap-ripple').count(),0);
  // Independent display switches persist, skip native work, preserve priority and detail behavior.
  await page.click('[data-page=settings]');await page.click('#appIconsSwitch');
  assert.equal(await page.getAttribute('#appIconsSwitch','aria-checked'),'false');
  await page.click('#appNamesSwitch');assert.equal(await page.getAttribute('#appNamesSwitch','aria-checked'),'false');
  for(const [icons,names]of [[false,false],[false,true],[true,false],[true,true]]){
   await page.evaluate(({icons,names})=>{localStorage.setItem('language_selector.showAppIcons',String(icons));localStorage.setItem('language_selector.showAppNames',String(names));},{icons,names});
   await page.reload();await page.waitForSelector('html[data-loading="false"]');await page.waitForSelector('.app-row');
   await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
   assert.equal(await page.locator('.app-row .app-icon').count(),icons?2:0);
   assert.equal(await page.locator('.app-row .package').count(),names?2:0);
   assert.equal(await page.locator('.app-row').first().locator('.app-name').textContent(),names?'阅读器':'com.example.reader');
   assert.match(await page.locator('.app-row').first().locator('.locale-state').textContent(),/已生效：/);
   if(!names)assert.equal(await page.evaluate(()=>mockInfoCalls),0);
   if(icons)await page.waitForFunction(()=>mockIconCalls>0);else assert.equal(await page.evaluate(()=>mockIconCalls),0);
   await page.fill('#search','阅读器');assert.equal(await page.locator('.app-row').count(),names?1:0);
   await page.click('#searchClear');await page.fill('#search','reader');assert.equal(await page.locator('.app-row').count(),1);await page.click('#searchClear');
   await page.locator('[data-package-name="com.example.reader"]').click();await page.waitForSelector('#detailPage:not(.hidden)');
   assert.equal(await page.locator('#appHeader .app-icon').count(),icons?1:0);
   assert.equal(await page.locator('#appHeader .package').count(),names?1:0);
   await page.click('#back');
   if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'display-'+Number(icons)+'-'+Number(names)+'.png')});
   await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('listStatus').textContent.includes('当前显示'));
   if(!icons)assert.equal(await page.evaluate(()=>mockIconCalls),0);
   if(!names)assert.equal(await page.evaluate(()=>mockInfoCalls),0);
  }
  // Current and configured targets, pending/read-failure states, keyboard-height simulation and failed writes.
  await page.setViewportSize({width:412,height:860});
  await page.evaluate(()=>{mockReadDelay=250;mockLocales['com.example.reader']='en-US'});
  await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('[data-package-name="com.example.reader"] .locale-state')?.dataset.status==='checking');
  assert.doesNotMatch(await page.locator('[data-package-name="com.example.reader"] .locale-state').textContent(),/已生效/);
  assert.equal(await page.$eval('[data-package-name="com.example.reader"] .state-text',e=>getComputedStyle(e,'::before').content),'none');
  await page.waitForFunction(()=>document.querySelector('[data-package-name="com.example.reader"] .locale-state')?.dataset.status==='mismatch');
  await page.locator('[data-package-name="com.example.reader"]').click();await page.waitForFunction(()=>!document.getElementById('currentLocaleGroup').hidden&&document.getElementById('detailState').textContent.includes('不一致'));
  assert.match(await page.locator('#configuredLocale').textContent(),/日语/);
  assert.equal(await page.locator('#configuredLocaleGroup').isVisible(),true);assert.match(await page.locator('#detailState').textContent(),/不一致/);
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'detail-mismatch.png')});
  assert.equal(await page.locator('[data-locale-tag="en-US"] .current-mark').count(),1);
  assert.equal(await page.locator('[data-locale-tag="ja-JP"] .configured-mark').count(),1);
  await page.focus('#localeSearch');assert.equal(await page.locator('#appHeader').isVisible(),false);
  await page.setViewportSize({width:412,height:420});await page.fill('#localeSearch','no-matching-language');
  assert.match(await page.locator('#localeList').textContent(),/未找到匹配的语言/);
  assert.equal(await page.$eval('#localeSearch',e=>e===document.activeElement),true);
  await page.locator('#localeList').getByRole('button',{name:'清除搜索'}).click();assert.equal(await page.inputValue('#localeSearch'),'');
  assert.equal(await page.$eval('#localeSearch',e=>e===document.activeElement),true);
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'detail-search-height-simulation.png')});
  await page.setViewportSize({width:412,height:860});
  await page.evaluate(()=>document.getElementById('localeSearch').blur());await page.waitForSelector('#appHeader',{state:'visible'});
  await page.evaluate(()=>{mockReadDelay=0;mockReadFailure='com.example.reader'});await page.click('#refresh');
  await page.waitForFunction(()=>document.getElementById('detailState').textContent.includes('无法确认是否生效'));
  assert.equal(await page.locator('.current-mark').count(),0);
  await page.evaluate(()=>{mockReadFailure=null;mockWriteFailure=true});await page.click('#refresh');await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);
  const beforeFail=await page.evaluate(()=>mockConfig);
  await page.click('#restoreDefault');await page.waitForFunction(()=>document.getElementById('actionStatus').dataset.error==='true');
  assert.equal(await page.evaluate(()=>mockConfig),beforeFail);assert.match(await page.locator('#currentLocale').textContent(),/英语/);
  assert.equal(await page.locator('#followSystemStatus').isVisible(),false);
  await page.evaluate(()=>sessionStorage.removeItem('mockPending'));await page.click('#refresh');await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);
  const failedWriteStart=await page.evaluate(()=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length);
  await page.locator('[data-locale-tag="zh-Hans-CN"]').click();await page.getByRole('button',{name:'应用',exact:true}).click();
  await page.waitForFunction(start=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length>start,failedWriteStart);
  await page.waitForFunction(()=>document.getElementById('actionStatus').dataset.error==='true'&&document.querySelector('.locale-option').disabled);
  assert.equal(await page.evaluate(()=>mockConfig),beforeFail);
  assert.match(await page.locator('#currentLocale').textContent(),/英语/);
  assert.doesNotMatch(await page.locator('#detailState').textContent(),/已生效/);
  assert.equal(await page.locator('.locale-option').first().isDisabled(),true);
  await page.evaluate(()=>{mockWriteFailure=false;sessionStorage.removeItem('mockPending')});await page.click('#back');await page.reload();await page.waitForSelector('html[data-loading="false"]');
  await page.evaluate(()=>{mockReadDelay=300});await page.click('#refresh');await page.waitForSelector('.app-row');
  await page.fill('#search','reader');assert.equal(await page.locator('.app-row').count(),1);assert.equal(await page.locator('[data-app-group="configured"]').textContent(),'已配置 · 1');
  await page.click('#searchClear');await page.waitForFunction(()=>document.getElementById('listProgress').hidden);
  await page.evaluate(()=>{mockReadDelay=0;mockReadFailure='com.example.reader'});await page.click('#refresh');
  await page.waitForFunction(()=>document.getElementById('listStatus').textContent.includes('1 个语言设置无法读取'));assert.equal(await page.locator('#listProgress').isVisible(),false);
  await page.evaluate(()=>{mockReadFailure=null;mockReadDelay=0;mockLocales['com.example.reader']='ja-JP'});
  await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('[data-package-name="com.example.reader"] .locale-state')?.dataset.status==='verified');
  // Multiple Android overrides retain order; configuration remains one validated code.
  await page.locator('[data-package-name="com.example.reader"]').click();await page.waitForFunction(()=>document.getElementById('detailState').textContent==='✓ 与配置一致');
  await page.evaluate(()=>{mockReadDelay=300;mockLocales['com.example.reader']='ja-JP,en-US'});
  await page.click('#refresh');await page.waitForFunction(()=>document.getElementById('detailState').textContent.includes('正在确认'));
  assert.equal(await page.locator('#currentLocaleGroup').isVisible(),false);assert.equal(await page.locator('#configuredLocaleGroup').isVisible(),true);
  await page.waitForFunction(()=>document.querySelectorAll('#currentLocale .language-value').length===2);
  assert.match(await page.locator('#currentLocale').textContent(),/日语.*英语/s);assert.equal(await page.locator('.current-mark').count(),2);
  assert.match(await page.locator('#detailState').textContent(),/不一致/);
  await page.evaluate(()=>{mockReadDelay=0;mockLocales['com.example.reader']='ja-JP'});await page.click('#back');
  // Actual system keyboard and native APIs still require a device; this simulates only viewport height.
  // Reload must retain unfinished state; reconciliation performs no locale write.
  await page.evaluate(()=>sessionStorage.setItem('mockPending','true'));await page.reload();await page.waitForSelector('html[data-loading="false"]');
  assert.equal(await page.locator('.app-row').first().isDisabled(),false);
  await page.click('[data-page=settings]');await page.click('#diagnosticsLink');await page.click('#recoverOperation');await page.getByRole('button',{name:'核对',exact:true}).click();await page.waitForSelector('#recoverOperation',{state:'hidden'});
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length),0);
  await page.waitForFunction(()=>!document.getElementById('autoSwitch').disabled);
  // Damaged configuration remains read-only and is never silently overwritten.
  await page.evaluate(()=>sessionStorage.setItem('mockConfig','schema=99\\nauto=1\\n'));await page.reload();await page.waitForSelector('html[data-loading="false"]');
  await page.locator('.app-row').first().click();await page.waitForSelector('#detailPage:not(.hidden)');
  assert.equal(await page.locator('#restoreDefault').isDisabled(),true);assert.equal(await page.locator('.locale-option').first().isDisabled(),true);
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control[.]sh' '(locale|auto|recover)'/.test(c)).length),0);
  await page.click('#back');await page.click('[data-page=settings]');await page.click('#diagnosticsLink');
  await page.waitForFunction(()=>document.getElementById('diagnostics').textContent.includes('无法确认'));
  assert.match(await page.locator('#rawStatus').textContent(),/Config: Invalid configuration/);
  await page.click('#back');await page.click('#appearanceLink');await page.click('#themeChoice');await page.getByRole('radio',{name:'跟随系统',exact:true}).click();await page.waitForSelector('.dialog',{state:'detached'});
  await page.emulateMedia({colorScheme:'light'});assert.equal(await page.getAttribute('html','data-theme'),'light');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.click('#back');await page.click('[data-page=apps]');
  await page.locator('.app-row').first().click();await page.waitForSelector('#detailPage:not(.hidden)');
  await page.evaluate(()=>{const name=document.querySelector('#appHeader .app-name');name.textContent='非常长的应用名称 · Language Selector 测试应用';const pkg=document.querySelector('#appHeader .package');if(pkg)pkg.textContent='com.example.'+'longpackage'.repeat(10);document.getElementById('detailPage').style.fontSize='22px';document.querySelectorAll('#detailPage .app-name,#detailPage .current-locale,#detailPage .locale-copy').forEach(e=>e.style.fontSize='22px')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const targets=await page.locator('#restoreDefault,#localeSearchClear').evaluateAll(nodes=>nodes.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert.ok(targets[0].height>=48); // CSS pixels only; real dp/zoom needs a device.
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'detail-large-text.png')});
  await context.close();assert.deepEqual(errors,[]);console.log('Browser smoke passed: themes, colors, 4 widths, navigation, dialogs, safe mutations, ripple and reduced motion.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
