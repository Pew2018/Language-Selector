const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../webroot/colors.js');
const contrast=(a,b)=>C.contrastRatio(C.relativeLuminance(C.rgbForHex(a)),C.relativeLuminance(C.rgbForHex(b)));
test('classic semantic palette preserves seeds and accessible normal/pressed colors',()=>{
 const colors=['#2196F3','#42A5F5','#CC6F4E','#E6A545','#7DC22F','#9575CD','#26C6DA','#F06292','#BA68C8','#009688','#4CAF50','#F44336','#FF9800','#9C27B0','#00BCD4','#3F51B5','#E91E63','#607D8B','#FF5722','#8BC34A','#FFFFFF','#000000'];
 for(let i=0;i<512;i++)colors.push('#'+((i*2654435761)>>>0).toString(16).slice(-6).padStart(6,'0').toUpperCase());
 for(const seed of colors)for(const dark of [false,true]){
  const p=C.generateThemePalette(seed,dark);assert.equal(p.seed,seed);
  for(const [a,b]of [[p.actionPrimary,p.onActionPrimary],[p.actionPrimaryPressed,p.onActionPrimary],[p.actionSecondary,p.onActionSecondary],[p.actionSecondaryPressed,p.onActionSecondary]])assert.ok(contrast(a,b)>=4.5,seed+' '+a+' '+b);
  for(const bg of dark?['#212121','#202020','#121212']:['#FFFFFF','#FAFAFA','#EEEEEE']){assert.ok(contrast(p.accentInk,bg)>=4.5);assert.ok(contrast(p.controlAccent,bg)>=3);}
 }
 assert.equal(C.generateThemePalette('#2196F3',false).primarySurface,'#1976D2');assert.equal(C.generateThemePalette('#2196F3',true).primarySurface,'#0066AD');
});
test('all UI assets local, custom dialogs and two real primary tabs',()=>{
 const html=fs.readFileSync('webroot/index.html','utf8'),js=fs.readFileSync('webroot/ui.js','utf8'),feedback=fs.readFileSync('webroot/feedback.js','utf8');
 assert.doesNotMatch(html,/backupPage|exportBtn|previewImport|jsonBox|<select|\b(?:src|href)="https?:/);assert.equal((html.match(/data-page=/g)||[]).length,2);
 for(const name of ['startup.js','core.js','colors.js','feedback.js','ui.js','app.js','style.css','classic.css'])assert.ok(fs.existsSync('webroot/'+name));
 assert.match(js,/history\.replaceState/);assert.match(js,/history\.pushState/);assert.match(js,/aria-modal/);assert.match(js,/role','radiogroup/);
 assert.match(feedback,/WeakSet/);assert.match(feedback,/WeakMap/);assert.match(feedback,/pointercancel/);assert.match(feedback,/Math\.abs\(scroll-tap\.scroll\)>2/);assert.match(feedback,/radius\*2/);assert.doesNotMatch(feedback,/preventDefault|setPointerCapture/);
});

test('startup and list share a local square-ended MDC indeterminate component',()=>{
 const html=fs.readFileSync('webroot/index.html','utf8'),css=fs.readFileSync('webroot/progress.css','utf8'),classic=fs.readFileSync('webroot/classic.css','utf8');
 assert.match(html,/href="progress[.]css[?]v=0[.]1[.]5"/);
 assert.equal((html.match(/class="ls-progress__bar ls-progress__primary"/g)||[]).length,2);
 assert.equal((html.match(/class="ls-progress__bar ls-progress__secondary"/g)||[]).length,2);
 assert.doesNotMatch(html,/<progress\b/);
 assert.match(css,/height:4px/);assert.match(css,/transform-origin:center/);assert.match(css,/2s infinite linear/);
 assert.match(css,/prefers-reduced-motion/);assert.match(classic,/#loading:after\{content:none\}/);
 assert.doesNotMatch(css,/linear-gradient|setInterval/);
 assert.match(css,/cubic-bezier\([.]152313,[.]196432,[.]648374,1[.]004315\)/);
});
