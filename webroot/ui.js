/* Presentation, history and dialogs. No privileged commands in this file. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),root=document.documentElement;
  const read=(key,fallback)=>{try{return localStorage.getItem('ls.'+key)||fallback;}catch(_){return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem('ls.'+key,String(value));}catch(_){}};
  const media=matchMedia('(prefers-color-scheme: dark)');
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const oneplus=[['OnePlus Blue','#42A5F5'],['Golden','#CC6F4E'],['Lemon Yellow','#E6A545'],['Grass Green','#7DC22F'],['Charm Purple','#9575CD'],['Sky Blue','#26C6DA'],['Vigour Red','#F06292'],['Fashion Pink','#BA68C8']];
  const material=[['Blue','#2196F3'],['Teal','#009688'],['Green','#4CAF50'],['Red','#F44336'],['Orange','#FF9800'],['Purple','#9C27B0'],['Cyan','#00BCD4'],['Indigo','#3F51B5'],['Pink','#E91E63'],['Blue Grey','#607D8B'],['Deep Orange','#FF5722'],['Light Green','#8BC34A']];
  let mode=read('theme','system'),seed=read('accent','#42A5F5').toUpperCase();
  if(!['system','light','dark'].includes(mode))mode='system';
  if(!/^#[0-9A-F]{6}$/.test(seed))seed='#42A5F5';
  function appearance(){
    const dark=mode==='dark'||(mode==='system'&&media.matches),p=LSColors.generateThemePalette(seed,dark);
    root.dataset.theme=dark?'dark':'light';root.style.colorScheme=root.dataset.theme;
    document.body.classList.toggle('dark',dark);
    const cards=read('cards','false')==='true',toolbar=read('toolbar','false')==='true',sections=read('sections','false')==='true',icons=read('icons','false')==='true';
    root.dataset.cardGroups=String(cards);root.dataset.accentToolbar=String(toolbar);root.dataset.accentSectionLabels=String(sections);root.dataset.accentNavigationIcons=String(icons&&!toolbar);
    const tokens={'--accent':seed,'--accentInk':p.accentInk,'--accent-ink':p.accentInk,'--control-accent':p.controlAccent,'--control-accent-strong':p.controlStrong,'--primary-surface':p.primarySurface,'--on-primary':p.onPrimary,'--action-fill':p.actionPrimary,'--on-accent':p.onActionPrimary,'--action-primary-pressed':p.actionPrimaryPressed,'--action-tonal':p.actionSecondary,'--on-action-tonal':p.onActionSecondary,'--action-tonal-pressed':p.actionSecondaryPressed,'--switch-on-track':p.switchTrack,'--switch-on-thumb':p.switchThumb,'--bottom-active-icon':p.navIcon,'--bottom-active-label':p.navLabel,'--system-status-bg':toolbar?p.primarySurface:dark?'#121212':'#FFFFFF'};
    for(const [name,value]of Object.entries(tokens))root.style.setProperty(name,value);
    for(const [id,value]of [['cardsSwitch',cards],['toolbarSwitch',toolbar],['sectionsSwitch',sections],['iconsSwitch',icons]])$(id).setAttribute('aria-checked',String(value));
    $('themeChoice').textContent={system:'跟随系统',light:'浅色模式',dark:'深色模式'}[mode];
    $('accentValue').textContent=[...oneplus,...material].find(x=>x[1]===seed)?.[0]||seed;
    document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===seed)));
    for(const [id,color]of [['theme-color',tokens['--system-status-bg']],['status-bar-color',tokens['--system-status-bg']],['navigation-bar-color',dark?'#121212':'#FFFFFF']])$(id).setAttribute('content',color);
  }
  let adapter,current='apps',scrolls={},dialog=null,dialogSerial=0,closing=false,afterClose=null;
  const primary=new Set(['apps','settings']);
  const pages=['apps','detail','settings','appearance','accent','diagnostics'];
  function capture(){if(history.state?.ls)history.replaceState({...history.state,scroll:$('main').scrollTop},'',location.href);scrolls[current]=$('main').scrollTop;}
  function render(page,scroll=0){
    if(!pages.includes(page))page='apps';
    if(document.activeElement?.matches('input,textarea'))document.activeElement.blur();
    root.style.removeProperty('--app-viewport-height');
    current=page;for(const id of pages)$(id+'Page').classList.toggle('hidden',id!==page);
    $('back').classList.toggle('hidden',primary.has(page));document.querySelector('.bottom-nav').hidden=!primary.has(page);
    $('refresh').classList.toggle('hidden',!['apps','detail'].includes(page));$('title').textContent='Language Selector';
    document.querySelectorAll('.nav-button').forEach(b=>{const active=b.dataset.page===page;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    adapter?.page(page);$('main').scrollTop=scroll;
    if(page==='accent'){$('hexInput').value=seed;$('hexError').textContent='';$('hexInput').removeAttribute('aria-invalid');}
  }
  function navigate(page,app){
    if(dialog||closing)return;
    capture();const state={ls:true,page,scroll:primary.has(page)?scrolls[page]||0:0};
    if(app)state.packageName=app.packageName;
    if(primary.has(page))history.replaceState(state,'','#'+page);else history.pushState(state,'','#'+page);
    render(page,state.scroll);
  }
  function sync(){
    const state=history.state;
    if(dialog&&!state?.dialog){finishDialog();return;}
    // A answered dialog is never revived by browser Forward.
    if(state?.dialog){history.replaceState({...state,dialog:undefined},'','#'+state.page);}
    const page=state?.ls?state.page:location.hash.slice(1);
    if(page==='detail'&&!adapter?.detail(state?.packageName)){render('apps');return;}
    render(page,state?.scroll||0);
  }
  function finishDialog(){
    if(!dialog||closing)return;
    closing=true;const d=dialog;dialog=null;
    window.TouchFeedback.closeDialog(d.scrim,()=>{
      $('dialogHost').replaceChildren();$('main').style.overflow='';closing=false;
      if(d.focus?.isConnected)d.focus.focus({preventScroll:true});
      const run=afterClose;afterClose=null;
      if(run)Promise.resolve().then(run).catch(error=>adapter?.error(error));
    });
  }
  function closeDialog(run){
    if(!dialog||closing||dialog.finishing)return;
    dialog.finishing=true;afterClose=run||null;
    setTimeout(()=>{if(history.state?.dialog===dialog?.id)history.back();else finishDialog();},reduced()?0:150);
  }
  function showDialog(title,message,actions,choices){
    if(dialog||closing)return;
    capture();const focus=document.activeElement,host=$('dialogHost');host.replaceChildren();
    const scrim=document.createElement('div');scrim.className='dialog-scrim';
    const panel=document.createElement('div');panel.className='dialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','dialogTitle');panel.setAttribute('aria-describedby','dialogDescription');
    const h=document.createElement('h2');h.id='dialogTitle';h.textContent=title;
    const p=document.createElement('p');p.id='dialogDescription';p.textContent=message;panel.append(h,p);
    if(choices){const list=document.createElement('div');list.setAttribute('role','radiogroup');list.setAttribute('aria-label',title);for(const choice of choices){const b=document.createElement('button');b.type='button';b.className='option';b.setAttribute('role','radio');b.setAttribute('aria-checked',String(choice.selected));const label=document.createElement('span');label.textContent=choice.label;const radio=document.createElement('span');radio.className='radio';radio.setAttribute('aria-hidden','true');b.append(label,radio);b.onclick=()=>{if(dialog?.finishing)return;list.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(x===b)));choice.select();closeDialog();};list.append(b);}panel.append(list);}
    const row=document.createElement('div');row.className='dialog-actions';
    for(const action of actions){const b=document.createElement('button');b.type='button';b.className='dialog-button';b.textContent=action.label;b.onclick=()=>closeDialog(action.run);row.append(b);}panel.append(row);scrim.append(panel);host.append(scrim);
    const id=++dialogSerial;dialog={id,scrim,focus,finishing:false};
    history.pushState({...history.state,dialog:id},'',location.href);
    $('main').style.overflow='hidden';window.TouchFeedback.bind(host);window.TouchFeedback.openDialog(scrim);
    scrim.onclick=e=>{if(e.target===scrim)closeDialog();};
    panel.querySelector('[aria-checked=true],button')?.focus({preventScroll:true});
  }
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(dialog){event.preventDefault();closeDialog();}else if(!primary.has(current)){event.preventDefault();history.back();}}
    if(event.key!=='Tab'||!dialog)return;
    const items=[...dialog.scrim.querySelectorAll('button:not(:disabled)')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  function init(next){
    adapter=next;history.scrollRestoration='manual';
    history.replaceState({ls:true,page:'apps',scroll:0},'','#apps');
    addEventListener('popstate',sync);addEventListener('hashchange',()=>{if(!closing)sync();});
    $('back').onclick=()=>history.back();document.querySelectorAll('.nav-button').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
    $('appearanceLink').onclick=()=>navigate('appearance');$('accentLink').onclick=()=>navigate('accent');$('diagnosticsLink').onclick=()=>{navigate('diagnostics');adapter.diagnostics();};$('diagnosticsRefresh').onclick=()=>adapter.diagnostics();
    $('themeChoice').onclick=()=>showDialog('显示模式','选择 WebUI 的显示模式。',[{label:'取消'}],['system','light','dark'].map(value=>({label:{system:'跟随系统',light:'浅色模式',dark:'深色模式'}[value],selected:mode===value,select:()=>{mode=value;write('theme',mode);appearance();}})));
    for(const [id,key]of [['cardsSwitch','cards'],['toolbarSwitch','toolbar'],['sectionsSwitch','sections'],['iconsSwitch','icons']])$(id).onclick=()=>{write(key,read(key,'false')!=='true');appearance();};
    for(const [id,colors]of [['oneplusColors',oneplus],['materialColors',material]])for(const [label,color]of colors){const b=document.createElement('button');b.type='button';b.className='swatch-item';b.dataset.color=color;b.setAttribute('aria-label',label+' '+color);const swatch=document.createElement('span');swatch.className='swatch';swatch.style.setProperty('--swatch',color);swatch.style.setProperty('--swatch-ink',LSColors.foregroundForRgb(LSColors.rgbForHex(color)).color);swatch.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=label;b.append(swatch,text);b.onclick=()=>{seed=color;write('accent',seed);$('hexInput').value=seed;$('hexError').textContent='';$('hexInput').setAttribute('aria-invalid','false');appearance();};$(id).append(b);}
    $('hexInput').oninput=()=>{const input=$('hexInput'),position=input.selectionStart;let value=input.value.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,6);input.value='#'+value;input.setSelectionRange(Math.min(position,input.value.length),Math.min(position,input.value.length));const valid=value.length===6;input.setAttribute('aria-invalid',String(!valid));$('hexError').textContent=valid?'':'请输入 6 位 HEX 颜色值';if(valid){seed=input.value;write('accent',seed);appearance();}};
    media.addEventListener('change',appearance);
    if(location.hostname==='mui.kernelsu.org'&&window.ksu?.enableInsets){const link=document.createElement('link');link.rel='stylesheet';link.href='/internal/insets.css';document.head.append(link);root.dataset.edgeToEdge='true';}
    const viewport=()=>{if(document.activeElement?.matches('input,textarea')){root.style.setProperty('--app-viewport-height',Math.max(180,window.visualViewport?.height||innerHeight)+'px');document.activeElement.scrollIntoView({block:'nearest'});}else root.style.removeProperty('--app-viewport-height');};
    window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);document.addEventListener('focusin',viewport);document.addEventListener('focusout',()=>setTimeout(viewport,0));
    appearance();render('apps');window.TouchFeedback.bind();
  }
  window.LSUI={init,navigate,showDialog,appearance,bind:()=>window.TouchFeedback.bind()};
})();
