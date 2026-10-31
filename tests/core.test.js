import test from 'node:test';
import assert from 'node:assert/strict';
import {sets} from '../practice-data.js';
import {newSession,character,isCorrect,record,rows,exportText,filename,restore} from '../core.js';
import {translations} from '../translations.js';
test('A01: all ten sets in exact required order',()=>{
 assert.deepEqual(sets.map(s=>s.keys.map(k=>k.char).join('')),['ㄹㅇㄴㅁ','ㅓㅏㅣ;','ㄱㄷㅈㅂ','ㅕㅑㅐㅔ','ㅍㅊㅌㅋ','ㅡ,./','ㅎㅅㅠ','ㅗㅛㅜ','ㅃㅉㄸㄲㅆ','ㅛㅕㅑㅒㅖ']);
 assert.equal(sets[6].keys[2].hand,'left');assert.equal(sets[6].keys[2].finger,0);
});
test('A02 A03 A14 A15: 1003 inputs, wrong counts, partial row, target preservation, TXT',()=>{
 const s=newSession(),f=sets[0].keys[0],j=sets[1].keys[0];
 for(let n=0;n<1003;n++)record(s,f,n%5?'ㄹ':'ㅎ',Boolean(n%5),new Date('2026-10-24T01:19:00Z'));
 record(s,j,'ㅓ',true);s.endedAt='2026-10-24T02:20:00Z';
 assert.equal(rows(s.records[f.id]).length,51);assert.equal(rows(s.records[f.id])[50].length,3);
 assert.equal(s.records[f.id].filter(x=>!x.correct).length,201);
 const txt=exportText(s);assert.match(txt,/ㅎㄹㄹㄹㄹㅎㄹㄹㄹㄹㅎㄹㄹㄹㄹㅎㄹㄹㄹㄹ : -4/);assert.match(txt,/기본자리 오른손 "ㅓ"/);
 assert.equal(txt.split('\r\n').filter(l=>l.includes(' : -')).length,52);
 assert.equal(record(s,f,'ㄹ',true),false);assert.deepEqual(restore(JSON.stringify(s)),s);
 assert.match(filename(s),/^\d{8}_\d{4}\.txt$/);
});
test('A06 A08: independent jamo and punctuation, shift actual character',()=>{
 assert.equal(character('KeyF'),'ㄹ');assert.equal(character('KeyQ',true),'ㅃ');assert.equal(character('KeyY',true),'ㅛ');
 for(const [code,char] of [['Semicolon',';'],['Comma',','],['Period','.'],['Slash','/']])assert.equal(character(code),char);
 assert.equal(character('Backspace'),null);assert.equal(character('Enter'),null);assert.equal(character('ShiftLeft'),null);
});
test('A11: every shift target requires correct side including identical output vowels',()=>{
 for(const set of sets.slice(8))for(const key of set.keys){
  const opposite=key.shift==='ShiftLeft'?'ShiftRight':'ShiftLeft';
  assert.equal(isCorrect(key,key.code,new Set()),false);
  assert.equal(isCorrect(key,key.code,new Set([opposite]),true),false);
  assert.equal(isCorrect(key,key.code,new Set([key.shift]),true),true);
  assert.equal(isCorrect(key,key.code,new Set([key.shift,opposite]),true),false);
  assert.equal(isCorrect(key,'KeyA',new Set([key.shift]),true),false);
 }
 assert.equal(isCorrect(sets[0].keys[0],'KeyF',new Set()),true);
 assert.equal(isCorrect(sets[0].keys[0],'KeyF',new Set(['ShiftRight']),true),false);
});
test('start only on actual recorded input; corrupt data rejected',()=>{
 const s=newSession();assert.equal(s.startedAt,null);s.selected=sets[1].keys[0].id;assert.equal(s.startedAt,null);
 assert.deepEqual(restore(JSON.stringify(s)),s);
 for(const raw of ['null','{}','{"version":1}','not JSON'])assert.throws(()=>restore(raw));
});
test('A18: three complete dictionaries and ten stage titles',()=>{
 for(const lang of ['my','vi']){assert.deepEqual(Object.keys(translations[lang]).sort(),Object.keys(translations.ko).sort());assert.equal(translations[lang].sets.length,10);assert.equal(translations[lang].fingers.length,4);}
});
