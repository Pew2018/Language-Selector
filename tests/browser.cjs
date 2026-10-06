// Development browser smoke test. No real root commands; all host APIs mocked.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('webroot'),server=http.createServer((req,res)=>{const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:412,height:860}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.mockCommands=[];window.mockLocale='';window.mockLocales={'com.example.music':'fr-FR','com.example.reader':'zh-CN'};window.mockConfig='schema=1\nauto=0\napp=com.example.reader|zh-Hans-CN\n';window.mockDelay=0;if(sessionStorage.getItem('mockConfig'))window.mockConfig=sessionStorage.getItem('mockConfig');if(sessionStorage.getItem('mockLocales'))window.mockLocales=JSON.parse(sessionStorage.getItem('mockLocales'));
   const icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#42A5F5"/></svg>');
   function execute(cmd,options,cb){window.mockCommands.push(cmd);let out='',code=0,err='';const op=/control\.sh' '(\w+)' '([0-9]+)'(?: '([^']*)')?(?: '([^']*)')?/.exec(cmd);
    if(op){const [,action,user,pkg,tag]=op;if(!mockConfig.startsWith('schema=1')&&action!=='status'){code=1;err='Invalid configuration'}else if(action==='read')out=mockConfig;else if(action==='state')out=sessionStorage.getItem('mockPending')==='true'?'pending':'ready';else if(action==='status')out='summary=boot apply disabled\nsuccess=0\nfailed=0\n';else if(action==='locale'){mockLocale=tag==='@system'?'':tag;mockLocales[pkg]=mockLocale;mockConfig=mockConfig.split('\n').filter(l=>!l.startsWith('app='+pkg+'|')).join('\n').trimEnd()+'\napp='+pkg+'|'+tag+'\n';out=mockConfig}else if(action==='auto'){mockConfig=mockConfig.replace(/^auto=[01]$/m,'auto='+pkg);out=mockConfig}else if(action==='recover'){sessionStorage.setItem('mockPending','false');out=mockConfig}}
    else if(cmd==='am get-current-user')out='0';else if(cmd==='getprop ro.build.version.sdk')out='36';else if(cmd.includes('cmd locale help'))out='available';else if(cmd.includes('list-device-locales'))out='en-US\nja-JP\nzh-Hans-CN\nzh-Hant-TW';else if(cmd.includes('get-app-locales')){const pkg=cmd.includes('com.example.music')?'com.example.music':'com.example.reader';out='Locales for '+pkg+' for user 0 are ['+(mockLocales[pkg]||'')+']'}else if(cmd.includes('getprop'))out='16\n36';
    sessionStorage.setItem('mockConfig',mockConfig);sessionStorage.setItem('mockLocales',JSON.stringify(mockLocales));setTimeout(()=>window[cb]?.(code,out,err),window.mockDelay||3);
   }
   window.ksu={listPackages:()=>JSON.stringify(['com.example.music','com.example.reader','com.android.settings']),getPackagesInfo:names=>JSON.stringify(JSON.parse(names).map(packageName=>({packageName,appLabel:({'com.example.reader':'阅读器','com.example.music':'Music Player','com.android.settings':'系统设置'})[packageName],isSystem:packageName.startsWith('com.android.')}))),getPackagesIcons:names=>JSON.stringify(JSON.parse(names).map(packageName=>({packageName,icon}))),exec:execute,
    spawn(command,args,options,name){const program=JSON.parse(args)[1],cmd=program.slice(1,-1).replaceAll(String.fromCharCode(39,34,39,34,39),String.fromCharCode(39)),callback=name+'_mock';const handler=window[name];window[callback]=(code,out,err)=>{if(out)handler.stdout.emit('data',out);if(err)handler.stderr.emit('data',err);handler.emit('exit',code);if(code)handler.emit('error',{message:err});delete window[callback]};execute(cmd,options,callback);}
   };
  });
  await page.goto(url);await page.waitForSelector('html[data-loading="false"]');await page.waitForSelector('.app-row');
  assert.equal(await page.locator('.app-row').count(),2);await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
  assert.match(await page.locator('.app-row').first().locator('.module-setting').textContent(),/已在模块中设置为 中文（简体，中国）/);
  await page.waitForFunction(()=>document.querySelector('.app-row .locale-state')?.textContent.includes('一致'));
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
  assert.match(await page.locator('#commonLocales').textContent(),/中文（简体，中国）/);assert.match(await page.locator('#commonLocales').textContent(),/中文（繁体，台湾）/);
  await page.locator('.locale-option').filter({hasText:'ja-JP'}).click();await page.waitForSelector('[role=dialog]');await page.keyboard.press('Escape');await page.waitForSelector('.dialog',{state:'detached'});assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length),0);
  await page.locator('.locale-option').filter({hasText:'ja-JP'}).click();await page.getByRole('button',{name:'应用',exact:true}).click();await page.waitForFunction(()=>mockCommands.some(c=>c.includes("control.sh' 'locale'")));await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);assert.equal(await page.evaluate(()=>mockLocale),'ja-JP');
  const count=await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length);await page.goForward();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control\.sh\x27 \x27locale\x27/.test(c)).length),count);
  await page.click('#back');await page.waitForSelector('#appsPage:not(.hidden)');
  assert.equal(await page.locator('.app-row').first().getAttribute('data-package-name'),'com.example.reader');
  await page.locator('.app-row').first().click();await page.click('#restoreDefault');await page.getByRole('button',{name:'恢复',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('restoreDefault').disabled);await page.click('#back');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.music');
  assert.equal(await page.locator('.module-setting:visible').count(),0);
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
  assert.match(await page.locator('.app-row').first().locator('.module-setting').textContent(),/已在模块中设置为/);
  await page.reload();await page.waitForSelector('html[data-loading="false"]');await page.waitForFunction(()=>document.querySelector('.app-row')?.dataset.packageName==='com.example.reader');
  await page.evaluate(()=>{localStorage.setItem('language_selector.errors','broken json');localStorage.setItem('language_selector.theme','dark');});
  await page.reload();await page.waitForSelector('html[data-loading="false"]');
  await page.setViewportSize({width:412,height:860});await page.focus('#search');
  assert.match(await page.locator('.app-row').first().locator('.module-setting').textContent(),/日语（日本）/);
  if(process.env.LS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.LS_SCREENSHOT_DIR,'apps-dark-focused.png')});
  await page.click('[data-page=settings]');await page.click('#diagnosticsLink');
  await page.waitForFunction(()=>document.getElementById('operationStatus').textContent.includes('开机应用已关闭'));
  assert.match(await page.locator('#diagnostics').textContent(),/cmd locale可用/);
  await page.click('#back');await page.waitForSelector('#settingsPage:not(.hidden)');await page.click('[data-page=apps]');
  // Confirmed pointer up creates geometry; scroll and reduced motion suppress it.
  await page.waitForTimeout(550);
  await page.evaluate(()=>{const b=document.getElementById('systemSwitch');b.dispatchEvent(new PointerEvent('pointerdown',{isPrimary:true,button:0,pointerId:5,clientX:10,clientY:10}));b.dispatchEvent(new PointerEvent('pointerup',{isPrimary:true,button:0,pointerId:5,clientX:10,clientY:10}));});assert.equal(await page.locator('.tap-ripple').count(),1);await page.waitForTimeout(550);assert.equal(await page.locator('.tap-ripple').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.click('#systemSwitch');assert.equal(await page.locator('.tap-ripple').count(),0);
  // Reload must retain unfinished state; reconciliation performs no locale write.
  await page.evaluate(()=>sessionStorage.setItem('mockPending','true'));await page.reload();await page.waitForSelector('html[data-loading="false"]');
  assert.equal(await page.locator('.app-row').first().isDisabled(),true);
  await page.click('[data-page=settings]');await page.click('#diagnosticsLink');await page.click('#recoverOperation');await page.getByRole('button',{name:'核对',exact:true}).click();await page.waitForSelector('#recoverOperation',{state:'hidden'});
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>c.includes("control.sh' 'locale'")).length),0);
  // Damaged configuration remains read-only and is never silently overwritten.
  await page.evaluate(()=>sessionStorage.setItem('mockConfig','schema=99\\nauto=1\\n'));await page.reload();await page.waitForSelector('html[data-loading="false"]');
  await page.locator('.app-row').first().click();await page.waitForSelector('#detailPage:not(.hidden)');
  assert.equal(await page.locator('#restoreDefault').isDisabled(),true);assert.equal(await page.locator('.locale-option').first().isDisabled(),true);
  assert.equal(await page.evaluate(()=>mockCommands.filter(c=>/control[.]sh' '(locale|auto|recover)'/.test(c)).length),0);
  assert.deepEqual(errors,[]);console.log('Browser smoke passed: themes, colors, 4 widths, navigation, dialogs, safe mutations, ripple and reduced motion.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
