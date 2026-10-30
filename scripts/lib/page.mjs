// The card as a page.
//
// WHY THIS EXISTS. A reading is taken for somebody, and what was handed over
// was a screen of fixed-width text. Somebody who is not a programmer reads
// that once. The same numbers laid out — four situations down, five heights
// across, their own sentence under each — is the same reading and a different
// thing to receive.
//
// WHY IT IS A FILE AND NOT A CANVAS. Rendering surfaces belong to particular
// assistants: some have one, most do not, and a reading that only appears
// properly in one of them is a reading most people never see. A single file
// with nothing outside it in it opens in any browser, can be shown by whatever
// surface an assistant does have, and can be tested here. It loads no font, no
// stylesheet and no script from anywhere.
import { COLUMNS, NEED, PASS, DEPTH_BATCH, DEPTH_NEED } from './scale.mjs';
import { say, sitName, levelName } from './labels.mjs';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
/* The publisher's own values, copied in as values. The page is recognisable
   as the same family as mentor.farsurf.com without carrying a line of that
   site's code: four and a half thousand lines of stylesheet and script written
   for one conversation, a login wall and a price list have nothing to lay out
   here, and would disagree with the site the first time either changed.
   Their own sentences are set in the face with Han glyphs in it — a stack
   without one sets every Chinese character in the browser's last resort,
   visibly a different width, on the one line of the page that is theirs. */
:root{
  color-scheme:light dark;
  --paper:#FAF8F4; --card:#FFFFFF; --ink:#171717; --body:#44443F; --dim:#8A8A85;
  --line:#E6E6E2; --rule:#D9D5CC; --accent:#D8480B; --credit:#2A6B4F; --warn:#A11A1A;
  --dark:#171717; --dark-ink:#F5F2EC; --dark-dim:#A8A29A; --dark-line:#2C2822;
  --face:'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif;
  --own:'DM Mono',ui-monospace,'SFMono-Regular',Menlo,'PingFang SC','Microsoft YaHei','Noto Sans SC',monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#121211; --card:#1B1B19; --ink:#F2F2EE; --body:#E4E4DD; --dim:#9A9A93;
  --line:#2C2C29; --rule:#31312D; --accent:#FF6A2B; --credit:#6FD39B; --warn:#E4614F;
  --dark:#1B1B19; --dark-ink:#F2F2EE; --dark-dim:#9A9A93; --dark-line:#2C2C29;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--body);font:16px/1.6 var(--face);padding:2.5rem 1.25rem 5rem}
.wrap{max-width:46rem;margin:0 auto}
h1{font-size:1.5rem;line-height:1.2;margin:0 0 .2rem;color:var(--ink);letter-spacing:-.01em}
h2{font-family:var(--own);font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:2.8rem 0 .9rem;font-weight:500}
.sub{color:var(--dim);margin:0 0 2rem;font-family:var(--own);font-size:.8rem}
.level{background:var(--dark);color:var(--dark-ink);border-radius:.5rem;padding:1.3rem 1.4rem}
.level b{display:block;font-size:1.3rem;letter-spacing:-.01em}
.level p{margin:.5rem 0 0;color:var(--dark-dim);font-size:.9rem}
table{border-collapse:collapse;width:100%;font-family:var(--own);font-size:.86rem}
th,td{padding:.55rem .35rem;text-align:center;border-bottom:1px solid var(--line)}
th:first-child,td:first-child{text-align:left;font-family:var(--face);white-space:nowrap;color:var(--ink)}
thead th{color:var(--dim);font-weight:500;border-bottom:1px solid var(--rule)}
table.grid{border-collapse:separate;border-spacing:.3rem;table-layout:fixed}
table.grid th,table.grid td{border-bottom:0}
table.grid thead th{font-family:var(--face);color:var(--ink);font-weight:600;font-size:.8rem;text-align:center}
table.grid tbody th{width:5.5rem}
table.grid td{border:1px solid var(--line);border-radius:.45rem;background:var(--card);padding:.5rem .3rem;
  line-height:1.35;font-size:.76rem;color:var(--dim);vertical-align:middle}
table.grid td.rate{color:var(--ink)}
table.grid td.rate b{display:block;font-size:.95rem}
table.grid td.held{border:2px solid var(--credit)}
table.grid td.none{border-style:dashed;background:transparent}
table.grid td.six{border-style:dashed;background:transparent;font-size:.72rem}
.chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:.8rem 0 0;padding:0;list-style:none}
.chips li{margin:0;border:1px solid var(--rule);border-radius:999px;padding:.15rem .7rem;font-size:.8rem;color:var(--body)}
.low{border-top:1px solid var(--line);padding:1.1rem 0}
.low .tag{font-family:var(--own);font-size:.74rem;color:var(--dim);letter-spacing:.05em}
.low h4{margin:.1rem 0 .5rem;font-size:.98rem;font-weight:600;color:var(--ink)}
.low dl{margin:.5rem 0 0}
.low dt{font-family:var(--own);color:var(--dim);font-size:.72rem;letter-spacing:.08em;margin-top:.6rem}
.low dd{margin:.15rem 0 0}
.low dd.ex{border-left:2px solid var(--accent);padding-left:.8rem;font-family:var(--own);color:var(--ink)}
.note{color:var(--dim);font-size:.84rem}
.sit{border-top:1px solid var(--line);padding:1.2rem 0}
.sit h3{margin:0 0 .5rem;font-size:1rem;color:var(--ink)}
.sit h3 span{color:var(--dim);font-weight:400;font-size:.9rem}
blockquote{margin:.6rem 0;padding:.5rem 0 .5rem .9rem;border-left:2px solid var(--accent);
  font-family:var(--own);font-size:.9rem;color:var(--ink)}
.def{margin:.6rem 0 0}
.def b{display:block;font-family:var(--own);color:var(--dim);font-size:.72rem;letter-spacing:.08em;
  text-transform:uppercase;font-weight:500;margin-bottom:.2rem}
ul{margin:.4rem 0;padding-left:1.1rem}
li{margin:.3rem 0}
.task{border-top:1px solid var(--line);padding:1.1rem 0}
.task h4{margin:0 0 .15rem;font-size:.98rem;font-weight:600;color:var(--ink)}
.task .when{color:var(--dim);font-family:var(--own);font-size:.75rem;margin:0 0 .7rem}
.p{margin:.8rem 0 0;padding-left:.9rem;border-left:2px solid var(--rule)}
.p .tag{font-family:var(--own);font-size:.74rem;color:var(--dim);letter-spacing:.05em;text-transform:uppercase}
.p .tag em{font-style:normal;color:var(--credit);font-weight:700}
.p .tag s{text-decoration:none;color:var(--warn);font-weight:700}
.p q{display:block;margin:.25rem 0 .2rem;font-family:var(--own);font-size:.9rem;color:var(--ink);quotes:none}
.p .why{color:var(--dim);font-size:.86rem}
footer{margin-top:3rem;border-top:1px solid var(--rule);padding-top:1rem;color:var(--dim);font-size:.82rem}
code{font-family:var(--own);font-size:.85em}
@media (max-width:30rem){body{padding:1.5rem 1rem 4rem}table{font-size:.74rem}th,td{padding:.45rem .12rem}}
`;

/** Their own sentence at the height they reached, the one the reading credited. */
function theirWords(tasks, column, rung) {
  for (const t of tasks) {
    for (const p of t.placements || []) {
      if (p.column === column && p.rung === rung && p.cite && p.landed === 'yes') return p.cite;
    }
  }
  return '';
}

export function page(st, meta = {}) {
  const L = meta.labels;
  const tasks = meta.tasks || [];
  const must = Math.ceil(NEED * PASS);
  const rung = (c, r) => (L.rungs[c] && L.rungs[c][r]) || '';
  const H = [];
  H.push(`<!doctype html><html lang="${esc(meta.lang || 'en')}"><head><meta charset="utf-8">`);
  H.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  H.push(`<title>${esc(say(L, 'title'))} — The Command Scale v1.0</title>`);
  H.push(`<style>${STYLE}</style></head><body><div class="wrap">`);

  H.push(`<h1>${esc(say(L, 'title'))}</h1>`);
  H.push(`<p class="sub">${esc(say(L, 'sub', { tasks: tasks.length, sessions: meta.sessions || 0, date: new Date().toISOString().slice(0, 10) }))}</p>`);

  H.push('<div class="level">');
  if (st.level) {
    H.push(`<b>${esc(say(L, 'heldYes', { n: st.level, name: levelName(L, 'asking', st.level) }))}</b>`);
    H.push(`<p>${esc(say(L, 'heldYesNote'))}</p>`);
  } else {
    H.push(`<b>${esc(say(L, 'heldNo'))}</b>`);
    H.push(`<p>${esc(say(L, 'heldNoNote', { need: NEED, must }))}</p>`);
  }
  H.push('</div>');

  // Four situations down, six heights across. A cell under the floor says how
  // many occasions there were and how many more it takes to count; one at the
  // floor gives the count met and the rate; a held cell is framed. The sixth
  // is read across batches, not per situation, so it is one cell down the
  // whole column.
  H.push(`<h2>${esc(say(L, 'tableHead'))}</h2>`);
  H.push('<table class="grid"><thead><tr><th></th>' + [1, 2, 3, 4, 5, 6]
    .map((r) => `<th>L${r} ${esc(levelName(L, 'asking', r))}</th>`).join('') + '</tr></thead><tbody>');
  const d = meta.depth;
  const haveBatches = Math.floor(tasks.length / DEPTH_BATCH);
  COLUMNS.forEach((c, i) => {
    const s = st.situations[c];
    const cells = [1, 2, 3, 4, 5].map((r) => {
      const cell = s && s.rungs[r];
      if (!cell) return `<td class="none">${esc(say(L, 'cellNone'))}</td>`;
      if (cell.n >= NEED) {
        return `<td class="rate${cell.met ? ' held' : ''}"><b>${cell.pos}/${cell.n}</b>${Math.round((cell.pos / cell.n) * 100)}%</td>`;
      }
      return `<td>${esc(say(L, 'cellSeen', { n: cell.n, short: NEED - cell.n }))}</td>`;
    }).join('');
    const six = i === 0
      ? `<td class="six" rowspan="${COLUMNS.length}">${esc(d && d.batches
        ? say(L, 'l6Read', { read: d.batches, vary: d.vary.shown, check: d.check.shown })
        : say(L, 'l6Waiting', { size: DEPTH_BATCH, have: haveBatches, need: DEPTH_NEED }))}</td>`
      : '';
    H.push(`<tr><th>${esc(sitName(L, c))}</th>${cells}${six}</tr>`);
  });
  H.push('</tbody></table>');
  H.push(`<p class="note">${esc(say(L, 'tableNote', { need: NEED, must,
    names: [1, 2, 3, 4, 5].map((r) => `L${r} ${levelName(L, 'knowing', r)}`).join(' · ') }))}</p>`);
  // What each situation still needs, at the height worth naming next.
  H.push('<ul class="chips">');
  for (const c of COLUMNS) {
    const s = st.situations[c];
    const sit = sitName(L, c);
    if (!s) { H.push(`<li>${esc(say(L, 'chipNone', { sit }))}</li>`); continue; }
    const short = Math.max(0, NEED - s.samples);
    const met = Math.max(0, must - s.reaching);
    const chip = short
      ? (met > 0 && met <= short ? say(L, 'chipShortMet', { sit, short, next: s.next, met }) : say(L, 'chipShort', { sit, short, next: s.next }))
      : say(L, 'chipRate', { sit, next: s.next, pass: Math.round(PASS * 100) });
    H.push(`<li>${esc(chip)}</li>`);
  }
  H.push('</ul>');

  // The lowest lines gone back to: the part of a reading that says what to do.
  const lows = meta.lows || [];
  if (lows.length) {
    H.push(`<h2>${esc(say(L, 'lowsHead'))}</h2>`);
    H.push(`<p class="note">${esc(say(L, 'lowsLead'))}</p>`);
    for (const i of lows) {
      const said = Array.isArray(i.quotes) && i.quotes.length ? i.quotes : [i.quote];
      H.push('<div class="low">');
      H.push(`<div class="tag">${esc(say(L, 'lowTag', { sit: sitName(L, i.column), n: i.rung, name: levelName(L, i.column, i.rung),
        landed: say(L, i.landed === 'no' ? 'landedNo' : 'landedYes') }))}</div>`);
      H.push(`<h4>${esc(i.objective || say(L, 'noObjective'))}</h4>`);
      H.push(`<dl><dt>${esc(said.length > 1 ? say(L, 'lowYourMany', { n: said.length }) : say(L, 'lowYour'))}</dt>`);
      for (const q of said) H.push(`<dd><blockquote>${esc(String(q).replace(/\s+/g, ' '))}</blockquote></dd>`);
      H.push(`<dt>${esc(say(L, 'lowDoing'))}</dt><dd>${esc(i.review.doing)}</dd>`);
      H.push(`<dt>${esc(say(L, 'lowHappened'))}</dt><dd>${esc(i.review.happened)}</dd>`);
      H.push(`<dt>${esc(say(L, 'lowOpen'))}</dt><dd>${esc(i.review.open)}</dd>`);
      if (i.review.decided && i.review.decided.length) {
        H.push(`<dt>${esc(say(L, 'lowDecided'))}</dt>`);
        for (const x of i.review.decided) H.push(`<dd>${esc(x.what)}: ${esc(x.chose)}${x.where ? ` (${esc(x.where)})` : ''}</dd>`);
      }
      H.push(`<dt>${esc(say(L, 'lowExample'))}</dt><dd class="ex">${esc(i.review.example)}</dd>`);
      if (i.habit) H.push(`<dd>${esc(say(L, 'lowHabit', { times: i.habit.times, of: i.habit.of }))}</dd>`);
      H.push('</dl></div>');
    }
  }

  H.push(`<h2>${esc(say(L, 'sitHead'))}</h2>`);
  for (const c of COLUMNS) {
    const s = st.situations[c];
    H.push('<div class="sit">');
    if (!s) {
      H.push(`<h3>${esc(sitName(L, c))} <span>— ${esc(say(L, 'sitNone'))}</span></h3>`);
      H.push(`<p class="note">${esc(say(L, 'sitNoneNote', { tasks: tasks.length }))}</p>`);
      H.push('</div>');
      continue;
    }
    const at = s.reached;
    const next = Math.min(5, at + 1);
    H.push(`<h3>${esc(sitName(L, c))} <span>— ${esc(say(L, 'sitReach', { n: at, name: levelName(L, c, at) }))}</span></h3>`);
    const mine = theirWords(tasks, c, at);
    if (mine) H.push(`<blockquote>${esc(mine.replace(/\s+/g, ' '))}</blockquote>`);
    if (rung(c, at)) H.push(`<div class="def"><b>${esc(say(L, 'defClosed'))}</b>${esc(rung(c, at))}</div>`);
    if (next > at && rung(c, next)) H.push(`<div class="def"><b>${esc(say(L, 'defNext', { n: next, name: levelName(L, c, next) }))}</b>${esc(rung(c, next))}</div>`);
    if (s.samples < NEED) H.push(`<p class="note">${esc(say(L, 'sitShort', { short: s.short, n: s.next, name: levelName(L, c, s.next), must, need: NEED }))}</p>`);
    H.push('</div>');
  }

  // Every placement, with the sentence it was credited for and the one line
  // saying why it sits there. This is the part of a reading that can be argued
  // with, and a reading nobody can argue with is a score.
  if (tasks.length) {
    H.push(`<h2>${esc(say(L, 'placesHead'))}</h2>`);
    H.push(`<p class="note">${esc(say(L, 'placesNote'))}</p>`);
    const newest = [...tasks].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    for (const t of newest) {
      const placed = (t.placements || []).slice().sort((a, b) => (a.message - b.message) || String(a.column).localeCompare(String(b.column)));
      if (!placed.length) continue;
      H.push('<div class="task">');
      H.push(`<h4>${esc(t.objective || say(L, 'noObjective'))}</h4>`);
      H.push(`<p class="when">${esc(String(t.at || '').slice(0, 10))}</p>`);
      for (const p of placed) {
        const met = p.landed === 'yes' ? `<em>${esc(say(L, 'met'))}</em>` : (p.landed === 'no' ? `<s>${esc(say(L, 'notMet'))}</s>` : esc(say(L, 'setAside')));
        H.push('<div class="p">');
        H.push(`<div class="tag">${esc(sitName(L, p.column))} · L${p.rung} ${esc(levelName(L, p.column, p.rung))} · ${met}</div>`);
        if (p.cite) H.push(`<q>${esc(p.cite.replace(/\s+/g, ' '))}</q>`);
        if (p.why) H.push(`<div class="why">${esc(p.why)}</div>`);
        H.push('</div>');
      }
      H.push('</div>');
    }
  }

  H.push(`<h2>${esc(say(L, 'backHead'))}</h2>`);
  H.push('<ul>');
  if (meta.moved && meta.moved.length) H.push(`<li><b>${esc(say(L, 'backSince'))}</b> ${esc(meta.moved.join(' · '))}</li>`);
  else H.push(`<li>${esc(say(L, 'backFirst'))}</li>`);
  const w = meta.weakest;
  if (w) {
    H.push(`<li>${esc(w.why
      ? say(L, 'nextEmpty', { sit: sitName(L, w.column) })
      : say(L, 'nextAt', { sit: sitName(L, w.column), short: w.short, n: w.next, name: levelName(L, w.column, w.next) }))}</li>`);
  }
  if (meta.waiting && meta.waiting.count) {
    H.push(`<li>${esc(say(L, 'backWaiting', { count: meta.waiting.count, k: Math.min(3, meta.waiting.count), readings: meta.waiting.readings }))}</li>`);
  }
  H.push(`<li>${esc(say(L, 'backFree'))}</li>`);
  H.push('</ul>');

  H.push(`<h2>${esc(say(L, 'cannotHead'))}</h2><ul>`);
  H.push(`<li>${esc(say(L, 'cannotFew'))}</li>`);
  H.push(`<li>${esc(say(L, 'cannotSetAside', { n: (st.setAside || []).length }))}</li>`);
  H.push(`<li>${esc(say(L, 'cannotWrong'))}</li>`);
  H.push('</ul>');

  H.push(`<footer>${esc(say(L, 'footer', { cmd: 'node scripts/cs.mjs forget --all' }))}</footer>`);
  H.push('</div></body></html>');
  return H.join('\n');
}
