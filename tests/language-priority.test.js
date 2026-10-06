const test=require('node:test'),assert=require('node:assert/strict'),C=require('../webroot/core.js');
test('module preferences precede native languages while loading and after validation',()=>{
 const native={packageName:'com.x.native',locale:{ok:true,followSystem:false,localeTag:'fr-FR'}};
 const saved={packageName:'com.x.saved',locale:null},other={packageName:'com.x.other',locale:null};
 const config=[{packageName:saved.packageName,followSystem:false,localeTag:'zh-Hans-CN'}];
 assert.deepEqual(C.sortAppsByLocale([native,other,saved],config),[saved,native,other]);
 saved.locale={ok:true,followSystem:false,localeTag:'zh-CN'};
 assert.deepEqual(C.sortAppsByLocale([native,other,saved],config),[saved,native,other]);
 saved.locale={ok:false};assert.equal(C.moduleLocale(saved,config),config[0]);
 config[0].followSystem=true;
 assert.deepEqual(C.sortAppsByLocale([native,other,saved],config),[native,other,saved]);
 assert.equal(C.moduleLocale(saved,config),null);
 config[0].followSystem=false;config[0].localeTag='invalid_tag';
 assert.deepEqual(C.sortAppsByLocale([native,other,saved],config),[native,other,saved]);
});
test('script aliases compare without mistaking a different language or region',()=>{
 assert.equal(C.sameLocale('zh-CN','zh-Hans-CN'),true);
 assert.equal(C.sameLocale('zh-TW','zh-Hant-TW'),true);
 assert.equal(C.sameLocale('zh-CN','zh-TW'),false);
 assert.equal(C.sameLocale('en-US','en-GB'),false);
 assert.equal(C.sameLocale(null,'zh-CN'),false);
});
test('dedicated languages lead, preserving order and excluding defaults/unknown/failures',()=>{
 const a={packageName:'com.x.a',locale:{ok:true,followSystem:true}},b={packageName:'com.x.b',locale:{ok:true,followSystem:false,localeTag:'ja-JP'}},c={packageName:'com.x.c',locale:null},d={packageName:'com.x.d',locale:{ok:false,followSystem:false,localeTag:'en-US'}},e={packageName:'com.x.e',locale:{ok:true,followSystem:false,localeTag:'zh-CN'}},f={packageName:'com.x.f',locale:{ok:true,followSystem:false,localeTag:''}};
 const input=[a,b,c,d,e,f];assert.deepEqual(C.sortAppsByLocale(input),[b,e,a,c,d,f]);assert.deepEqual(input,[a,b,c,d,e,f]);
 b.locale={ok:true,followSystem:true};assert.deepEqual(C.sortAppsByLocale(input),[e,a,b,c,d,f]);
});
test('Chinese common languages survive missing catalogs and script aliases',()=>{
 assert.deepEqual(C.commonLocales([]),['zh-CN','zh-TW']);
 assert.deepEqual(C.commonLocales(['en-US','ja-JP']),['en-US','zh-CN','zh-TW','ja-JP']);
 assert.deepEqual(C.commonLocales(['en-US','zh-Hans-CN','zh-Hant-TW']),['en-US','zh-Hans-CN','zh-Hant-TW']);
 assert.deepEqual(C.commonLocales(['zh-Hans','zh-Hant']),['zh-Hans','zh-Hant']);
 assert.deepEqual(C.commonLocales(['zh-CN','zh-Hans-CN','zh-TW','zh-Hant-TW']),['zh-CN','zh-TW']);
 assert.deepEqual(C.commonLocales(['zh-HK']),['zh-CN','zh-TW']);
});
