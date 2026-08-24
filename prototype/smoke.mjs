import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport:{width:420,height:900} });
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
pg.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text()); });

await pg.goto('file://' + process.cwd() + '/ai-rush-prototype.html');
const log = [];
const title = t => log.push(t);

await pg.click('#tGo');
await pg.waitForSelector('.hud:not([hidden])');
title('start → hud visible');

// ── L01: the red one is correct ──────────────────────────────
await pg.waitForSelector('#c-go');
const noCls = await pg.getAttribute('#c-no','class');
const goCls = await pg.getAttribute('#c-go','class');
title(`L01 mounted · Cancel=${noCls} Continue=${goCls}`);
// prove the fail path swaps styling, then swaps back
await pg.click('#c-no');
title(`L01 after Cancel · Cancel=${await pg.getAttribute('#c-no','class')} Continue=${await pg.getAttribute('#c-go','class')}`);
await pg.waitForTimeout(550);
title(`L01 450ms later · Cancel=${await pg.getAttribute('#c-no','class')} Continue=${await pg.getAttribute('#c-go','class')}`);
await pg.click('#c-go');

// ── L02: one digit per cell, clicking between each ───────────
await pg.waitForSelector('#otp');
title('L02 mounted');
// first prove the bug: type the whole code into one cell
await pg.click('.otp-cell[data-i="0"]');
await pg.keyboard.type('481516');
const stuffed = await pg.textContent('.otp-cell[data-i="0"] span');
title(`L02 typed whole code → cell0 = "${stuffed}" (len ${stuffed.length})`);
await pg.click('#go');
title(`L02 stuffed submit rejected · err = "${(await pg.textContent('#err')).trim()}"`);
// now the honest solve
for (let i=0;i<6;i++){ await pg.click(`.otp-cell[data-i="${i}"]`); await pg.keyboard.type('481516'[i]); }
await pg.click('#go');

// ── L12: skip (fader drags covered by manual test) ───────────
await pg.waitForSelector('#tel');
title('L12 mounted');
await pg.click('#skipBtn');

// ── L11: canvas runner — confirm it mounts + animates ────────
await pg.waitForSelector('#cv');
const f1 = await pg.evaluate(() => document.querySelector('#cv').toDataURL().length);
await pg.waitForTimeout(400);
const f2 = await pg.evaluate(() => document.querySelector('#cv').toDataURL().length);
title(`L11 mounted · canvas animating = ${f1 !== f2}`);
await pg.click('#skipBtn');

// ── L37: gear train, solved left→right with the +/- buttons ──
await pg.waitForSelector('#pin');
const before = await pg.evaluate(() =>
  [...document.querySelectorAll('.dial')].map(d => d.querySelectorAll('.dial-n')[1].textContent).join(''));
title(`L37 mounted · start ${before}`);
for (let i=0;i<4;i++){
  for (let n=0;n<10;n++){
    const cur = await pg.evaluate(i => document.querySelectorAll('.dial')[i].querySelectorAll('.dial-n')[1].textContent, i);
    if (cur === '4729'[i]) break;
    await pg.click(`.dial[data-i="${i}"] button[data-d="1"]`);
  }
}
const after = await pg.evaluate(() =>
  [...document.querySelectorAll('.dial')].map(d => d.querySelectorAll('.dial-n')[1].textContent).join(''));
title(`L37 left→right solve → ${after} (target 4729)`);
await pg.click('#go');

// ── L36: the honest form ─────────────────────────────────────
await pg.waitForSelector('#si-go');
title('L36 mounted');
await pg.click('#si-go');
title(`L36 empty submit · email err = "${(await pg.textContent('#e-email')).trim()}" (no flash/shake by design)`);
await pg.fill('#si-email','someone@example.com');
await pg.fill('#si-pw','hunter2!');
await pg.click('#si-eye');
title(`L36 reveal toggle → type=${await pg.getAttribute('#si-pw','type')}`);
await pg.click('#si-go');

// ── tally ────────────────────────────────────────────────────
await pg.waitForSelector('#ts');
await pg.waitForTimeout(2000);
title(`TALLY · score ${await pg.textContent('#ts')}`);
const rows = await pg.$$eval('.tally-row', r => r.map(x => x.textContent.replace(/\s+/g,' ')));
rows.forEach(r => log.push('   ' + r));

console.log(log.join('\n'));
console.log(errs.length ? '\n!! ERRORS:\n' + errs.join('\n') : '\nno page errors');
await b.close();
