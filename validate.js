const fs = require('fs');
const html = fs.readFileSync('/home/claude/demo.html', 'utf8');
let match = html.match(/<script>([\s\S]*)<\/script>/)[1];

class FakeEl {
  constructor(){
    this.children = [];
    this.classList = {
      _set: new Set(),
      add(c){ this._set.add(c); },
      remove(c){ this._set.delete(c); },
      toggle(c, v){ if (v) this._set.add(c); else this._set.delete(c); },
      contains(c){ return this._set.has(c); }
    };
    this.dataset = {};
    this.style = {};
  }
  appendChild(c){ this.children.push(c); }
  set textContent(v){ this._text = v; }
  get textContent(){ return this._text; }
  querySelectorAll(){ return []; }
  querySelector(){ return new FakeEl(); }
  addEventListener(){}
  setAttribute(){}
  getTotalLength(){ return 300; }
  getPointAtLength(){ return { x: 0, y: 0 }; }
  get offsetHeight(){ return 100; }
  getBoundingClientRect(){ return { top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 }; }
}
const ids = {};
global.document = {
  getElementById(id){ if (!ids[id]) ids[id] = new FakeEl(); return ids[id]; },
  createElement(){ return new FakeEl(); },
  querySelectorAll(){ return []; },
  querySelector(){ return new FakeEl(); }
};
global.window = global;
global.window.addEventListener = function(){};
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 999;

// strip the final step() kickoff so we only validate data, not run the player loop
match = match.replace(/\nstep\(\);\s*$/, '\n//step();');

const validation = `
console.log('Loaded OK. MESSAGES length:', MESSAGES.length);
let pollOptLen = null;
MESSAGES.forEach((m, idx) => {
  if (m.type === 'poll') { pollOptLen = m.options.length; }
  if (m.pollVotes) {
    if (m.pollVotes.length !== pollOptLen) {
      console.log('MISMATCH at idx', idx, 'pollVotes len', m.pollVotes.length, 'expected', pollOptLen, m.text || m.question);
    }
  }
});
const allDays = new Set();
CALENDARS.June.rows.forEach(r => r.forEach(v => { if (v) allDays.add('June' + v); }));
CALENDARS.July.rows.forEach(r => r.forEach(v => { if (v) allDays.add('July' + v); }));
let month = 'June';
MESSAGES.forEach((m, idx) => {
  if (m.type === 'transition' && m.toMonth) month = m.toMonth;
  if (m.type === 'calendarFlip') month = m.month;
  if (m.day !== undefined) {
    const key = month + String(m.day).padStart(2, '0');
    if (!allDays.has(key)) console.log('MISSING DAY in grid:', key, 'at idx', idx);
  }
});
console.log('Day-grid check complete.');
`;

try {
  eval(match + validation);
} catch (e) {
  console.log('RUNTIME ERROR:', e.message);
}
