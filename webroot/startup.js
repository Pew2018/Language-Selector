(() => {
  const root=document.documentElement;
  try {
    const mode=localStorage.getItem('ls.theme')||'system';
    root.dataset.theme=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
    root.style.colorScheme=root.dataset.theme;
    root.dataset.cardGroups=String(localStorage.getItem('ls.cards')==='true');
  } catch (_) {}
  window.LSReady=()=>{root.dataset.loading='false';window.LSInitialized=true;};
  setTimeout(()=>{if(window.LSInitialized)return;const host=document.getElementById('loading');if(!host)return;host.textContent='WebUI 初始化失败，请重新加载。';const retry=document.createElement('button');retry.type='button';retry.className='text-action';retry.textContent='重新加载';retry.onclick=()=>location.reload();host.append(retry);window.TouchFeedback?.bind(host);},10000);
  addEventListener('error',()=>{window.LSStartupError=true;});
  addEventListener('unhandledrejection',()=>{window.LSStartupError=true;});
})();
