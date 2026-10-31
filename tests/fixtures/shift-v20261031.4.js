// Extracted from the original successful-version source read at 2026-10-31T05:36:29.939Z
export function physicalCode(event,shiftProfile='standard'){
  // Use the explicit left/right location when a browser/IME reports a generic
  // Shift code. Never infer the side merely from shiftKey or the output glyph.
  if(event.key==='Shift'||event.keyCode===16||['ShiftLeft','ShiftRight'].includes(event.code)){
    if(event.location===1)return 'ShiftLeft';
    if(event.location===2)return 'ShiftRight';
    if(!['ShiftLeft','ShiftRight'].includes(event.code))return shiftProfile==='unlocated-right'?'ShiftRight':'ShiftUnknown';
  }
  return event.code;
}
export function isCorrect(target,code,pressed,shiftKey=false){
  const left=pressed.has('ShiftLeft'),right=pressed.has('ShiftRight');
  return code===target.code && (target.shift ? pressed.has(target.shift) && !(target.shift==='ShiftLeft'?right:left) : !left&&!right&&!shiftKey);
}
