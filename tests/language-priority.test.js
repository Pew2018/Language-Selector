const test=require('node:test'),assert=require('node:assert/strict'),C=require('../webroot/core.js');
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
