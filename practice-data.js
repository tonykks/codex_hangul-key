export const base = Object.fromEntries([
  ['Q','ㅂ'],['W','ㅈ'],['E','ㄷ'],['R','ㄱ'],['T','ㅅ'],['Y','ㅛ'],['U','ㅕ'],['I','ㅑ'],['O','ㅐ'],['P','ㅔ'],
  ['A','ㅁ'],['S','ㄴ'],['D','ㅇ'],['F','ㄹ'],['G','ㅎ'],['H','ㅗ'],['J','ㅓ'],['K','ㅏ'],['L','ㅣ'],
  ['Z','ㅋ'],['X','ㅌ'],['C','ㅊ'],['V','ㅍ'],['B','ㅠ'],['N','ㅜ'],['M','ㅡ']
].map(([k,v])=>['Key'+k,v]));
Object.assign(base,{Semicolon:';',Comma:',',Period:'.',Slash:'/',Space:' ',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Quote:"'"});
for(let i=0;i<10;i++)base['Digit'+i]=String(i);
export const shifted = {KeyQ:'ㅃ',KeyW:'ㅉ',KeyE:'ㄸ',KeyR:'ㄲ',KeyT:'ㅆ',KeyO:'ㅒ',KeyP:'ㅖ',Semicolon:':',Comma:'<',Period:'>',Slash:'?',Backquote:'~',Minus:'_',Equal:'+',BracketLeft:'{',BracketRight:'}',Backslash:'|',Quote:'"',Digit1:'!',Digit2:'@',Digit3:'#',Digit4:'$',Digit5:'%',Digit6:'^',Digit7:'&',Digit8:'*',Digit9:'(',Digit0:')'};
const specs = [
  ['기본자리 왼손','FDSA','left'],['기본자리 오른손',['KeyJ','KeyK','KeyL','Semicolon'],'right'],
  ['윗자리 왼손','REWQ','left'],['윗자리 오른손','UIOP','right'],
  ['아랫자리 왼손','VCXZ','left'],['아랫자리 오른손',['KeyM','Comma','Period','Slash'],'right'],
  ['가운데자리 왼쪽 열','GTB','left'],['가운데자리 오른쪽 열','HYN','right'],
  ['Shift + 왼손 윗자리','QWERT','left',true],['Shift + 오른손 윗자리','YUIOP','right',true]
];
const fingers = {KeyA:3,KeyQ:3,KeyZ:3,KeyS:2,KeyW:2,KeyX:2,KeyD:1,KeyE:1,KeyC:1,KeyL:2,KeyO:2,Period:2,KeyK:1,KeyI:1,Comma:1,KeyP:3,Semicolon:3,Slash:3};
export const sets=specs.map(([name,keys,hand,shift=false],i)=>({id:i+1,name,hand,shift,keys:(typeof keys==='string'?[...keys].map(k=>'Key'+k):keys).map(code=>({id:`${i+1}:${code}`,code,char:shift?(shifted[code]||base[code]):base[code],hand,finger:fingers[code]||0,shift:shift?(hand==='left'?'ShiftRight':'ShiftLeft'):null}))}));
export const tracks=[1,2,3,4].map(n=>({name:`Track ${n}`,src:`music/track${n}.mp3`}));
export const keyboardRows=[
 ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal','Backspace'],
 ['Tab',...'QWERTYUIOP'.split('').map(k=>'Key'+k),'BracketLeft','BracketRight','Backslash'],
 ['CapsLock',...'ASDFGHJKL'.split('').map(k=>'Key'+k),'Semicolon','Quote','Enter'],
 ['ShiftLeft',...'ZXCVBNM'.split('').map(k=>'Key'+k),'Comma','Period','Slash','ShiftRight'],
 ['ControlLeft','MetaLeft','AltLeft','Space','Lang1','AltRight','ControlRight']
];
export function keyLabel(code){return code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):({Semicolon:';',Comma:',',Period:'.',Slash:'/',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Quote:"'",Backspace:'⌫',Tab:'Tab',CapsLock:'Caps',Enter:'Enter',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl',MetaLeft:'OS',AltLeft:'Alt',AltRight:'Alt',Space:'Space',Lang1:'한/영'})[code]||code;}
