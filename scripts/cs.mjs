#!/usr/bin/env node
// The instrument. It prepares what a reading is taken from, checks what a
// reading claims, and counts what survives. It never asks a model anything:
// the reading is taken by whichever agent is running this skill, which is why
// no key is needed and why the program itself sends nothing anywhere.
//
// Everything it writes goes under ~/.blindspot-checker, or wherever
// BLINDSPOT_CHECKER_DIR points. A run that stops half way is continued rather
// than started again.
import fs from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Where this file is. Taken from the module URL through the conversion node
// provides for it rather than from its .pathname: on Windows that property
// hands back /C:/… with a leading slash, which path.join then treats as a
// directory of its own, and every file this program reads beside itself — the
// standards, the spec — silently comes back empty.
const HERE = path.dirname(fileURLToPath(import.meta.url));
import { turnsFrom, workFrom, discover, sources } from './lib/transcripts.mjs';
import { page } from './lib/page.mjs';
import { verifyPlacements, answerWasUnusable, standing, depthStanding, DEPTH_BATCH, UNUSABLE, COLUMNS, NOT_THEIR_WORDS, flat,
  SITUATION_NAMES, nameOf, CONFERRING } from './lib/scale.mjs';

/** The two passes. They are taken separately, against separate standards, and
 *  are blind to each other: held in one standard the fourth situation's
 *  arrival moves the other three. */
const PASSES = {
  place: { file: 'reading-place', prompt: 'prompts/placing.md',
    only: ['asking', 'reacting', 'blocked'],
    says: 'the first three situations — what should become true, what is true of what came back, and that progress has stopped' },
  know: { file: 'reading-know', prompt: 'prompts/knowing.md',
    only: ['knowing'],
    says: 'the fourth situation on its own — what is asked to be told' },
};
import { card, weakest, grid, snapshot, movement, gaps, trail, handover, stepUp } from './lib/report.mjs';
import { keyOf, roundsAfter, pickLows, habitOf, HABIT_AT_LEAST, pastedBack } from './lib/lows.mjs';
import { template, labelsFor, labelsFile, needsTranslation } from './lib/labels.mjs';
import { rungDefinitions } from './lib/rungs.mjs';

// A reading is about a person, not about a project, so what it keeps lives
// with the person. Kept beside whatever directory the command happened to be
// run from, somebody working in three repositories would have three separate
// records of themselves, each too thin to hold anything, and the level would
// depend on where they were standing when they asked.
// Its own folder, apart from any other implementation of the scale, so two
// never mix their readings on one machine.
const WORK = path.resolve(process.env.BLINDSPOT_CHECKER_DIR || path.join(os.homedir(), '.blindspot-checker'));
const read = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const write = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); };
const writeText = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

/** A short fingerprint of some text, the same from run to run. */
const fingerprint = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** Which version of a standard a reading was taken under: its own text.
 *  Kept with every reading, so a reading taken before a standard changed can
 *  be told from one taken after. */
const versionOf = (rel) => {
  try { return fingerprint(fs.readFileSync(path.join(HERE, '..', rel), 'utf8')); } catch { return ''; }
};

/** The name a conversation is kept under. A file named for its session — a
 *  long generated identifier — is already unique; anything else is named by
 *  whoever or whatever saved it, and two `chat.txt`s, or two conversations
 *  each kept as `transcript_full.jsonl` in its own folder, are different
 *  conversations, so where it lives is part of its name. */
const idOf = (file) => {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(base) ? base.slice(0, 24) : `${base.slice(0, 16)}-${fingerprint(path.resolve(file))}`;
};
const sessionDirs = () => {
  try { return fs.readdirSync(path.join(WORK, 'sessions')).sort(); } catch { return []; }
};
const sess = (id) => path.join(WORK, 'sessions', id);

/** Padding that counts what a terminal shows, not what JavaScript counts: a
 *  CJK character takes two columns, and objectives arrive in whatever language
 *  they were typed in. */
const wide = (s) => [...String(s)].reduce((n, ch) => n + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1), 0);
const padWide = (s, w) => {
  let out = '';
  for (const ch of String(s)) { if (wide(out + ch) > w) break; out += ch; }
  return out + ' '.repeat(Math.max(0, w - wide(out)));
};

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** Their words, numbered, each followed by what came back after it. */
function groupingInput(turns) {
  return turns.map((t, i) => [
    // A message that was not theirs is there as circumstance: its opening says
    // what it was, and the rest of it would only bury the messages that are theirs.
    `[${i}] ${t.at ? `${t.at.slice(0, 16).replace('T', ' ')} — ` : ''}${t.notInput ? clip(t.quote, NOT_INPUT_CHARS) : t.quote}`,
    `      what came back: ${t.notInput ? clip(t.back || 'not recorded', NOT_INPUT_CHARS / 2) : (t.back || 'not recorded')}${t.tools && t.tools.length ? ` (tools used: ${t.tools.join(', ')})` : ''}`,
    // The last piece matters where a message of theirs comes next: it is what
    // that message answers.
    lastPiece(t) && turns[i + 1] && !turns[i + 1].notInput ? `      its last piece: ${clip(lastPiece(t), GROUPING_LAST_CHARS)}` : '',
    t.notInput ? `      NOT INPUT: ${t.notInput}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}

/** How much of a message that was not theirs the grouping is shown. */
const NOT_INPUT_CHARS = 240;
/** How much of a reply's last piece the grouping is shown: enough to see
 *  what the next message answers. */
const GROUPING_LAST_CHARS = 800;

const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n)}…` : String(s));

/** The last piece of what came back, where it says more than its opening did. */
const lastPiece = (t) => (t.last && !String(t.back || '').includes(String(t.last)) ? t.last : '');

/** How much of what a message answers travels with it, and how much of any
 *  one reply in it: several replies can stand between two of their messages,
 *  and one long report must not crowd out the short question they answered. */
const ANSWERS_CHARS = 6000;
const ANSWER_PART_CHARS = 1500;

/** What a message answers, carried with it when that answer was said outside
 *  the task it belongs to: the reply before it went with another task, or
 *  with a message that was not theirs. Without it, a message that accepts or
 *  chooses is read with no way of telling what it accepted. */
const withAnswer = (n, idx, turns, t) => {
  // Everything the assistant said since their own last message: between two
  // of their messages there are often others' — a helper reporting back, a
  // note from the harness — and what they answer can be in any of the replies.
  const parts = [];
  for (let j = n - 1; j >= 0; j -= 1) {
    if (idx.includes(j)) break;
    const said = turns[j].last || turns[j].back || '';
    if (said) parts.unshift(said.length > ANSWER_PART_CHARS ? `…${said.slice(-ANSWER_PART_CHARS)}` : said);
    if (!turns[j].notInput || parts.join('\n').length > ANSWERS_CHARS) break;
  }
  const all = parts.join('\n');
  return all ? { ...t, answers: all.length > ANSWERS_CHARS ? `…${all.slice(-ANSWERS_CHARS)}` : all } : t;
};

/** What came back after one message, as a reading is shown it. */
const cameBack = (t) => [
  `    WHAT CAME BACK: ${t.back || 'not recorded'}${t.tools && t.tools.length ? ` (tools used: ${t.tools.join(', ')})` : ''}`,
  lastPiece(t) ? `    ITS LAST PIECE: ${lastPiece(t)}` : '',
  t.did && t.did.length ? `    WHAT THE ASSISTANT DID: ${t.did.join('; ')}` : '',
].filter(Boolean);

/** Attach turns to the tasks the reading proposed, and say out loud when a
 *  message landed in none or in two. A message in no task is evidence quietly
 *  dropped; a message in two is one thing they said counted twice. */
function applyGrouping(turns, grouping) {
  const tasks = [];
  const used = new Map();
  // Messages that were never an attempt to say anything, marked rather than
  // removed: they stay in their task and in their order, because what follows
  // one of them is often only readable because it happened. The marking is
  // made by a step that read the conversation and never saw the ladder.
  const empty = new Map();
  for (const e of (grouping && grouping.notInput) || []) {
    if (Number.isInteger(e && e.message)) empty.set(e.message, String(e.why || '').trim());
  }
  // Messages about running the work rather than about what is being made —
  // the machines, the sessions, accounts, the schedule, how far things have
  // got. They are theirs and they stay where they were said, but the scale
  // does not read them, so they reach no ladder.
  const outside = new Map();
  for (const e of (grouping && grouping.outside) || []) {
    if (Number.isInteger(e && e.message)) outside.set(e.message, String(e.why || '').trim());
  }
  // The one situation each message is for, as the grouping gave it.
  const given = new Map();
  for (const c of (grouping && grouping.columns) || []) {
    if (Number.isInteger(c && c.message) && COLUMNS.includes(c.column)) given.set(c.message, c.column);
  }
  const withColumn = (n, t) => (given.has(n) && !t.notInput ? { ...t, column: given.get(n) } : t);
  // A message the grouping put in two tasks is one thing they said: it is
  // kept in the first task that names it and reported, so it is counted once.
  const taken = new Set();
  for (const [i, t] of ((grouping && grouping.tasks) || []).entries()) {
    const named = (t.messages || []).filter((n) => Number.isInteger(n) && n >= 0 && n < turns.length);
    for (const n of named) used.set(n, (used.get(n) || 0) + 1);
    const idx = named.filter((n) => !taken.has(n));
    for (const n of idx) taken.add(n);
    // A task with no objective holds the messages that were about the exchange
    // rather than anything being made. The grouping standard sets it aside
    // whole: it exists to account for those messages, not to be read, and
    // sent to a reading it could only come back empty or be refused.
    if (t.objective === null) continue;
    tasks.push({
      n: i, objective: t.objective || null,
      turns: idx.map((n) => withAnswer(n, idx, turns, withColumn(n, empty.has(n)
        ? { ...turns[n], notInput: turns[n].notInput || empty.get(n) || 'not an attempt to say anything' }
        : (outside.has(n) && !turns[n].notInput
          ? { ...turns[n], outside: true, notInput: `outside what the scale reads: ${outside.get(n) || 'about running the work'}` }
          : turns[n])))),
      made: t.made || '',
      at: idx.length ? turns[idx[0]].at : '', lastAt: idx.length ? turns[idx[idx.length - 1]].at : '',
    });
  }
  const missing = turns.map((_, i) => i).filter((i) => !used.has(i));
  const twice = [...used.entries()].filter(([, c]) => c > 1).map(([i]) => i);
  return { tasks: tasks.filter((t) => t.turns.length), missing, twice };
}

/** One task as the reading sees it. */
function judgeInput(task) {
  const lines = [
    `Objective: ${task.objective || '(not stated)'}`,
    '',
    'Their messages, in order, each with what came back after it:',
  ];
  const opening = task.turns.findIndex((t) => !t.notInput);
  task.turns.forEach((t, i) => {
    if (t.answers) lines.push(`    WHAT IT ANSWERS (said just before the message below, outside this task): ${t.answers}`);
    lines.push(`[${i + 1}]${i === opening ? ' THIS ONE OPENS THE TASK.' : ''} THEY SAID: ${t.quote}`);
    // What is said of the message comes right under it, before what came back.
    if (t.notInput) lines.push(`    THIS ONE WAS NOT INPUT: ${t.notInput}`);
    else if (t.column) lines.push(`    ITS COLUMN: ${t.column}`);
    lines.push(...cameBack(t));
  });
  return lines.filter(Boolean).join('\n');
}


/** What one record holds, said by code alone: nothing is read by a model to
 *  decide whether it is worth reading. Null when it holds fewer than two
 *  things they said. */
function summaryOf(found) {
  const f = found.file;
  let turns = [];
  try { turns = found.reader.turns(f); } catch { return null; }
  const theirs = turns.filter((t) => !t.notInput);
  if (theirs.length < 2) return null;
  return {
    all: turns.length,
    from: found.from,
    project: found.project,
    // When they last said something in it, which is what "newest" means to
    // somebody choosing what to read, and what the row prints. Ordered by
    // anything else — when the file was last touched, say — the listing
    // would call itself newest first while showing an older conversation
    // above a newer one.
    at: (theirs[theirs.length - 1].at || theirs[0].at || '').slice(0, 10),
    // When they first said something, so a row carries a span rather than
    // a point. A conversation run across three days and one run in ten
    // minutes are different things to choose between.
    began: (theirs[0].at || '').slice(0, 10),
    turns: theirs.length,
    // Both ends of it. One opening line is often "continue" or "go on", which
    // identifies nothing; what they said first and what they said last
    // place a conversation between them, and both are mechanical — no
    // model is asked to summarise anything here.
    opens: (theirs[0].quote || '').replace(/\s+/g, ' ').slice(0, 96),
    closes: (theirs[theirs.length - 1].quote || '').replace(/\s+/g, ' ').slice(0, 96),
  };
}

/** What has been listed before, kept beside the readings.
 *
 *  A large machine holds gigabytes of record, and reading every file of it to
 *  list what is there took over a minute each time it was asked. A file whose
 *  size and time have not changed holds what it held, so what it held is kept
 *  and only new or changed files are read again. Kept under the version of the
 *  code that reads records, because a change there changes what a file holds. */
const LISTED = path.join(WORK, 'listed.json');
/** The list as it was last shown, so that a number chosen from it means what
 *  it meant on screen. */
const SHOWN = path.join(WORK, 'shown.json');

/** Whether a record mentions a folder anywhere — in what was said, what came
 *  back or what was run. The work on one project is spread over several
 *  conversations, and the ones that touched it are the ones that name it. */
const mentioned = new Map();
function mentions(file, folder) {
  const key = `${file}\u0000${folder}`;
  if (!mentioned.has(key)) {
    let hit = false;
    try { hit = fs.readFileSync(file).indexOf(Buffer.from(folder)) >= 0; } catch { hit = false; }
    mentioned.set(key, hit);
  }
  return mentioned.get(key);
}
const readerVersion = () => {
  try {
    return `rows-2:${fingerprint(fs.readFileSync(path.join(HERE, 'lib', 'transcripts.mjs'), 'utf8'))}`;
  } catch { return ''; }
};

/** How far into a session's record what has been prepared reaches: the
 *  conversation and every part of it picked up since. Zero when none of it
 *  has been. */
function preparedUpTo(id) {
  let end = 0;
  for (const dir of sessionDirs()) {
    if (dir !== id && !dir.startsWith(`${id}+`)) continue;
    const t = read(path.join(sess(dir), 'turns.json'));
    if (t) end = Math.max(end, (t.offset || 0) + (t.turns || []).length);
  }
  return end;
}

function candidates() {
  const version = readerVersion();
  const kept = read(LISTED, null);
  const before = kept && kept.version === version ? kept.files || {} : {};
  const now = {};
  const found = discover();
  const fresh = found.filter((x) => {
    const k = before[x.file];
    return !(k && k.at === x.at && k.size === x.size);
  });
  if (fresh.length > 200) {
    console.log(`  Looking through ${fresh.length} record files to see what is there. The first look`);
    console.log('  on a machine with a long history takes a minute or two; after that only new');
    console.log('  or changed files are read.');
    console.log('');
  }
  const out = [];
  for (const x of found) {
    const f = x.file;
    const k = before[f];
    const row = k && k.at === x.at && k.size === x.size ? k.row : summaryOf(x);
    now[f] = { at: x.at, size: x.size, row };
    if (!row) continue;
    const id = idOf(f);
    const end = preparedUpTo(id);
    if (!end) { out.push({ file: f, id, offset: 0, ...row }); continue; }
    // Read before, and gone on since. A session left open is picked up again
    // days later, and what was said after it was read would otherwise never be
    // offered at all. What came after is offered as a part of its own, starting
    // where the reading left off; what was read stays as it was read.
    if (!(row.all > end)) continue;
    let turns = [];
    try { turns = x.reader.turns(f).slice(end); } catch { continue; }
    const theirs = turns.filter((t) => !t.notInput);
    if (theirs.length < 2) continue;
    out.push({
      file: f, id: `${id}+${end}`, offset: end, ...row,
      began: (theirs[0].at || '').slice(0, 10),
      turns: theirs.length,
      opens: (theirs[0].quote || '').replace(/\s+/g, ' ').slice(0, 96),
    });
  }
  try { write(LISTED, { version, files: now }); } catch { /* a list that cannot be kept is still a list */ }
  out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return out;
}

/** What a run will cost, in the only units that mean anything here: how many
 *  readings the agent has to take.
 *
 *  Estimated from the number of their messages, because how many tasks a
 *  conversation holds is not known until it has been grouped. The ratio is
 *  this implementation's own guess and nothing in the standard fixes it, so
 *  what is printed is called an estimate everywhere it appears. */
// Two passes place each task, and one more lists what the assistant settled
// in it; counted for every task, since which ones changed something is not
// known until they are read.
const PER_TASK_PASSES = 3;
/** One conversation's estimate. A set's is the sum of its parts, so that a row
 *  and the total under it never disagree — rounded once per conversation and
 *  then added, three rows of five cannot add up to eleven. */
const estimateOne = (c) => {
  const tasks = Math.max(1, Math.ceil(c.turns / 3));
  return { tasks, readings: tasks * PER_TASK_PASSES + 1 };
};
const estimate = (list) => list.reduce((a, c) => {
  const one = estimateOne(c);
  return { tasks: a.tasks + one.tasks, readings: a.readings + one.readings };
}, { tasks: 0, readings: 0 });

/** A few whole slices of what is waiting, each with what reading it would cost.
 *
 *  Built from the conversations that are actually here rather than offered as
 *  fixed choices: a window with nothing in it is not printed, and neither is
 *  one that would read exactly what another already covers. */
function slices(all) {
  const day = 86400000;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const out = [];
  const seen = new Set();
  const add = (label, picked, how) => {
    if (!picked.length) return;
    const key = picked.map((c) => c.file).sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, n: picked.length, readings: estimate(picked).readings, how });
  };
  // Newest first within a budget, the same way --budget picks them, so the
  // cheapest way in is offered rather than left to be worked out. A first look
  // is what most people want and the standard says plainly what it is worth
  // (§10): a placement over a few tasks, not a measurement.
  const within = [];
  for (const c of all) if (estimate([...within, c]).readings <= 20) within.push(c);
  add('a first look', within, 'node scripts/cs.mjs import --budget 20');
  add('the newest 3', all.slice(0, 3), 'node scripts/cs.mjs import --sessions 3');
  for (const days of [7, 30]) {
    const from = iso(Date.now() - (days * day));
    add(`the last ${days} days`, all.filter((c) => c.at >= from), `node scripts/cs.mjs import --since ${from}`);
  }
  const byProject = new Map();
  for (const c of all) byProject.set(c.project, (byProject.get(c.project) || 0) + 1);
  if (byProject.size > 1) {
    const [name] = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];
    add(`everything from ${name}`, all.filter((c) => c.project === name), `node scripts/cs.mjs import --project ${name}`);
  }
  add('everything waiting', all, `node scripts/cs.mjs import --sessions ${all.length}`);
  return out;
}

/** What kinds of record are on this machine, said in one block.
 *
 *  "Nothing to read" and "your agent keeps its record in a shape this does not
 *  know" are different facts and only one of them is the person's to act on,
 *  so both `status` and `list` say which were looked for and which were
 *  found. */
function saySources() {
  const found = sources();
  console.log('  RECORDS ON THIS MACHINE');
  for (const s of found) {
    console.log(`    ${s.name.padEnd(14)} ${s.present ? `${s.files} session file(s) it can read` : 'not on this machine'}   ${s.where}`);
  }
  console.log('    A conversation kept anywhere else is read by saving it as plain text');
  console.log('    with each side marked, then: node scripts/cs.mjs import --file <that file>');
  console.log('');
}

function cmdList() {
  const since = arg('since', '');
  const project = arg('project', '');
  const limit = Number(arg('limit', 20));
  let all = candidates();
  saySources();
  if (since) all = all.filter((c) => c.at >= since);
  if (project) all = all.filter((c) => c.project.includes(project));
  const work = arg('work', '');
  if (work) all = all.filter((c) => mentions(c.file, work));
  const kinds = new Set(all.map((c) => c.from)).size;
  const shown = all.slice(0, limit);
  // The numbers printed are the ones `import --take` reads back: a list that
  // moved between showing and choosing would read a conversation nobody named.
  write(SHOWN, { at: new Date().toISOString(), files: shown.map((c) => c.id) });
  if (!shown.length) { console.log('Nothing new to read.'); return; }
  console.log(`\n  ${all.length} conversation(s) not yet read${since ? ` since ${since}` : ''}${project ? ` in ${project}` : ''}${work ? ` that touch ${work}` : ''}. Newest first:\n`);
  shown.forEach((c, i) => {
    const one = estimate([c]).readings;
    const span = c.began && c.began !== c.at ? `${c.began} → ${c.at}` : c.at;
    console.log(`  ${String(i + 1).padStart(3)}  ${span.padEnd(23)} ${String(c.turns).padStart(3)} things you said  ~${String(one).padStart(3)} readings  ${kinds > 1 ? `${c.from} · ` : ''}${c.project.slice(0, 24)}`);
    console.log(`       first: ${c.opens}`);
    if (c.closes && c.closes !== c.opens) console.log(`       last:  ${c.closes}`);
    console.log('');
  });
  const e = estimate(shown);
  console.log(`\n  Reading all ${shown.length} of these: about ${e.tasks} task(s), ${e.readings} readings.`);
  console.log('');
  // Whole slices rather than a menu of everything. A list of fifteen lines is
  // a directory, and somebody reading a directory still does not know which
  // lines to pick; a few slices with their cost beside them is a choice that
  // can be made in one look. The numbered list stays, for anybody who wants to
  // name conversations one at a time.
  console.log('  WAYS TO CHOOSE, WITH WHAT EACH WOULD COST');
  const ways = slices(all);
  const w = Math.max(21, ...ways.map((o) => o.label.length));
  for (const o of ways) {
    const cost = `${o.n} conversation(s), ~${o.readings} readings`;
    console.log(`    ${o.label.padEnd(w)}  ${cost.padEnd(34)}  ${o.how}`);
  }
  console.log(`    ${'or name them yourself'.padEnd(w)}  ${' '.repeat(34)}  node scripts/cs.mjs import --take 1,2,5`);
  console.log('');
  console.log('  Choosing your best conversations and leaving out the rest makes the');
  console.log('  reading a fact about those conversations rather than about you.');
  console.log('');
  console.log('  ──  WHOSE CHOICE THIS IS  ────────────────────────────────────');
  console.log('  This list is for the person whose record it is. Put it in front of');
  console.log('  them and stop here. Deciding which of their conversations are worth');
  console.log('  reading — the real work, the good ones, the ones that will show them');
  console.log('  at their best — is the one judgement this instrument does not make,');
  console.log('  because a reading over conversations somebody else picked is a fact');
  console.log('  about the picking. Being asked to find conversations is being asked');
  console.log('  to show what you found. Read when they have said which.');
  console.log('');
  if (fs.existsSync(RATING())) {
    pageFooter('another');
    console.log('  FOR YOU: "Audit session N" is node scripts/cs.mjs import --take N, then next.');
    console.log('');
  }
}

function cmdImport() {
  // Said before the first file is written rather than after. Somebody watching
  // a reading being taken sees files appearing and no statement of what they
  // are; read as tampering, the natural thing to do is stop the run, and a run
  // stopped there has produced nothing. One line, up front, costs nothing and
  // is the difference between a record and a rummage.
  console.log(`Readings are kept under ${WORK}, and nothing else on this machine is written.`);
  console.log('To remove them at any point: node scripts/cs.mjs forget --all');
  console.log('');
  const howMany = Number(arg('sessions', 5));
  // Whether a selection was made at all, as against this program falling back
  // on one. Each of these is somebody naming what to read; none of them is a
  // default.
  const chose = ['sessions', 'take', 'budget', 'since', 'project', 'file', 'work'].some((k) => arg(k, '') !== '');
  const file = arg('file', '');
  const take = arg('take', '');
  const since = arg('since', '');
  const project = arg('project', '');
  let sources = [];
  if (file) {
    // Said before anything is written, like every other way of choosing: what
    // this file holds and what reading it would cost — or, when nothing in it
    // reads as two sides taking turns, how to mark it so that it does.
    const at = path.resolve(file);
    let theirs = 0;
    try { theirs = turnsFrom(at).filter((t) => !t.notInput).length; } catch { theirs = 0; }
    if (theirs < 2) {
      console.log(`Nothing in ${at} reads as a conversation: two sides taking turns were not found.`);
      console.log('Start each turn on its own line with who is speaking and a colon, for example');
      console.log('  Me: …        AI: …        (a full-width colon, ：, works too)');
      console.log('and keep the turns in the order they happened.');
      process.exit(1);
    }
    const e = estimate([{ turns: theirs }]);
    console.log(`Reading 1 conversation: ${theirs} things you said, about ${e.tasks} task(s), ${e.readings} readings to take.`);
    console.log('');
    sources = [{ file: at, id: idOf(at), offset: 0 }];
  } else {
    let all = candidates();
    if (!all.length) {
      console.log('Nothing new to read. Point at a saved conversation instead:');
      console.log('  node scripts/cs.mjs import --file <a saved conversation>');
      process.exit(1);
    }
    if (since) all = all.filter((c) => c.at >= since);
    if (project) all = all.filter((c) => c.project.includes(project));
    const work = arg('work', '');
    if (work) all = all.filter((c) => mentions(c.file, work));
    const budget = Number(arg('budget', 0));
    const shownList = read(SHOWN, null);
    if (take && shownList && Array.isArray(shownList.files) && shownList.files.length) {
      // Numbers are read against the list as it was shown, not as it is now.
      const ids = take.split(',').map((n) => shownList.files[Number(n.trim()) - 1]).filter(Boolean);
      all = all.filter((c) => ids.includes(c.id));
    } else if (take) {
      const want = new Set(take.split(',').map((n) => Number(n.trim())));
      all = all.filter((_, i) => want.has(i + 1));
    } else if (budget > 0) {
      // Bounded by what it will cost rather than by how many conversations it
      // is: one long conversation can cost more than many short ones, and
      // somebody choosing how much to spend is choosing readings, not files.
      // Newest first, skipping any that would take the total past the budget
      // rather than stopping at the first one that does: a single long
      // conversation at the top would otherwise either blow the budget or hide
      // every short one behind it.
      const picked = [];
      for (const c of all) {
        if (estimate([...picked, c]).readings <= budget) picked.push(c);
      }
      if (!picked.length) {
        const cheapest = all.reduce((a, b) => (estimate([a]).readings <= estimate([b]).readings ? a : b));
        console.log(`Nothing fits a budget of ${budget} readings. The smallest conversation waiting`);
        console.log(`is ${cheapest.at}, ${cheapest.turns} messages, about ${estimate([cheapest]).readings} readings.`);
        process.exit(1);
      }
      all = picked;
    } else if (chose) {
      all = all.slice(0, howMany);
    } else {
      // No default. A default here is this program choosing which of somebody's
      // conversations get read, and it was taken every time: the newest few
      // were read because reading the newest few was what happened when nobody
      // had said anything. What gets read is theirs to say, so with nothing
      // said this shows what there is and stops.
      console.log('Nothing has been chosen to read yet, and this will not choose for them.');
      console.log('');
      cmdList();
      process.exit(1);
    }
    const e = estimate(all);
    console.log(`Reading ${all.length} conversation(s): about ${e.tasks} task(s), ${e.readings} readings to take.`);
    // Named, not counted. The numbers in the listing are positions in what is
    // still unread, and that list gets shorter as conversations are read — so
    // the number somebody said an hour ago points at a different conversation
    // now. Printing what is actually about to be read is how that gets caught
    // before it is paid for.
    for (const c of all) {
      console.log(`  · ${c.began && c.began !== c.at ? `${c.began} → ${c.at}` : c.at}  ${String(c.turns).padStart(3)} things you said  ${c.from}`);
      console.log(`    ${c.opens}`);
    }
    console.log('');
    sources = all.map((c) => ({ file: c.file, id: c.id, offset: c.offset || 0 }));
  }
  let kept = 0;
  const done = [];
  // An example this instrument handed over, pasted back into a later
  // conversation, is the assistant's words and not theirs.
  const examples = examplesGiven();
  for (const src of sources) {
    const turns = turnsFrom(src.file).slice(src.offset).map((t) => (!t.notInput && pastedBack(t.quote, examples)
      ? { ...t, notInput: 'an example this instrument wrote, pasted back' } : t));
    // A conversation with fewer than two of their messages cannot carry a task
    // that was pursued; it is dropped rather than read, and said so here.
    if (turns.filter((t) => !t.notInput).length < 2) continue;
    const id = src.id;
    const dir = sess(id);
    if (fs.existsSync(path.join(dir, 'turns.json'))) { done.push(id); continue; }
    write(path.join(dir, 'turns.json'), { source: src.file, offset: src.offset, turns });
    writeText(path.join(dir, 'grouping-input.txt'), groupingInput(turns));
    kept += 1;
    done.push(id);
  }
  // A new reading starts its own rating and its own lines looked into; the
  // last reading's are kept beside it rather than mixed into this one.
  if (fs.existsSync(RATING()) || fs.existsSync(PROBES())) {
    const keep = path.join(WORK, 'earlier', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(keep, { recursive: true });
    if (fs.existsSync(RATING())) fs.renameSync(RATING(), path.join(keep, 'rating.json'));
    if (fs.existsSync(PROBES())) fs.renameSync(PROBES(), path.join(keep, 'probes'));
  }
  write(path.join(WORK, 'this-reading.json'), { at: new Date().toISOString(), sessions: done });
  console.log(`Prepared ${kept} new session(s); ${done.length} in this reading.`);
  console.log('');
  cmdNext();
}

function nextStep() {
  for (const id of sessionDirs()) {
    const d = sess(id);
    if (!fs.existsSync(path.join(d, 'grouping.json'))) {
      console.log(`NEXT — group one conversation into tasks.`);
      console.log(`  read:  ${path.join(d, 'grouping-input.txt')}`);
      console.log(`  rules: prompts/grouping.md`);
      console.log(`  write: ${path.join(d, 'grouping.json')}`);
      console.log(`  then:  node scripts/cs.mjs group ${id}`);
      return true;
    }
    const tasks = read(path.join(d, 'tasks.json'));
    if (!tasks) {
      console.log(`NEXT — apply the grouping you wrote: node scripts/cs.mjs group ${id}`);
      return true;
    }
    for (const t of tasks.tasks) {
      for (const [name, pass] of Object.entries(PASSES)) {
        const k = read(path.join(d, `kept-${name}-${t.n}.json`));
        if (k && k.copyAgain && !k.retried) {
          console.log(`NEXT — copy the quoted words again, pass "${name}", task ${t.n}.`);
          for (const c of k.copyAgain) {
            const many = c.messages && c.messages.length > 1;
            console.log(`  · ${many ? `messages ${c.messages.join(', ')}` : `message ${c.message}`}: "${c.cite}" is not in ${many ? 'those messages' : 'that message'}`);
          }
          console.log(`  rewrite: ${path.join(d, `${pass.file}-${t.n}.json`)}`);
          console.log(`  then:    node scripts/cs.mjs ${name} ${id} ${t.n}`);
          return true;
        }
        if (k) continue;
        // Written and not yet kept: the answer is on disk but nothing has
        // checked it, so the task is not read until it has been.
        if (fs.existsSync(path.join(d, `${pass.file}-${t.n}.json`))) {
          console.log(`NEXT — keep the answer written for task ${t.n}, pass "${name}".`);
          console.log(`  then:  node scripts/cs.mjs ${name} ${id} ${t.n}`);
          return true;
        }
        console.log(`NEXT — read one task, pass "${name}".`);
        console.log(`  read:  ${path.join(d, `task-${t.n}.txt`)}`);
        console.log(`  rules: ${pass.prompt}`);
        console.log(`  place: ${pass.says}`);
        console.log(`  write: ${path.join(d, `${pass.file}-${t.n}.json`)}`);
        console.log(`  then:  node scripts/cs.mjs ${name} ${id} ${t.n}`);
        if (name === 'know') {
          console.log('');
          console.log('  Take this pass on the task alone. Do not read the answer you wrote');
          console.log('  for the other pass: two standards in view at once move the levels');
          console.log('  the first three are read at.');
        }
        return true;
      }
    }
  }
  if (process.argv.includes('--deep') && depthNext()) return true;
  if (allPlacements().length && !fs.existsSync(RATING())) {
    if (!unseenListed()) {
      console.log('NEXT — list what the assistant settled on its own: node scripts/cs.mjs unseen');
      return true;
    }
    console.log('NEXT — hand over the audit report: node scripts/cs.mjs rating');
    return true;
  }
  console.log('READ — the report is handed over; what they type next is in SKILL.md, "Pages".');
  console.log('  The long card (report), the lowest lines across readings (lows) and the');
  console.log('  sixth level (next --deep) are there when asked for.');
  return false;
}

function cmdNext() {
  if (nextStep()) cardSoFar();
}

/** What can be handed over right now. A reading interrupted part way is still
 *  a reading of the tasks it got through, and the card is built from whatever
 *  has been kept; printing this beside every next step means there is never a
 *  moment where the only answer to "what have you got" is nothing. */
function cardSoFar() {
  const tasks = allPlacements();
  if (!tasks.length) return;
  console.log('');
  console.log(`  A card over the ${tasks.length} task(s) read so far, at any point: node scripts/cs.mjs report`);
}

function cmdGroup(id) {
  const d = sess(id);
  const { turns } = read(path.join(d, 'turns.json'), { turns: [] });
  const grouping = read(path.join(d, 'grouping.json'));
  if (!grouping) { console.log(`No grouping written yet at ${path.join(d, 'grouping.json')}`); process.exit(1); }
  const { tasks, missing, twice } = applyGrouping(turns, grouping);
  write(path.join(d, 'tasks.json'), { grouping: versionOf('prompts/grouping.md'), tasks });
  for (const t of tasks) writeText(path.join(d, `task-${t.n}.txt`), judgeInput(t));
  console.log(`${tasks.length} task(s) from ${turns.length} message(s).`);
  // Reported rather than repaired: a grouping that cannot account for their
  // messages is a grouping to look at, not one to patch.
  if (missing.length) console.log(`  ${missing.length} message(s) in no task: ${missing.join(', ')}`);
  if (twice.length) console.log(`  ${twice.length} message(s) in more than one task, kept in the first only: ${twice.join(', ')}`);
  // Situations given to some messages and not others: an unmarked message is
  // read as in a task with none, and said here so the grouping can be looked at.
  const marked = tasks.some((t) => t.turns.some((u) => u.column));
  const unmarked = marked ? tasks.flatMap((t) => t.turns.filter((u) => !u.notInput && !u.column)).length : 0;
  if (unmarked) console.log(`  ${unmarked} message(s) given no situation by the grouping; each pass reads them as unmarked.`);
  console.log('');
  cmdTasks(id);
  cmdNext();
}

function cmdPass(name, id, n) {
  const pass = PASSES[name];
  const d = sess(id);
  const tasks = read(path.join(d, 'tasks.json'), { tasks: [] }).tasks;
  const task = tasks.find((t) => String(t.n) === String(n));
  if (!task) { console.log(`No task ${n} in session ${id}`); process.exit(1); }
  const answer = read(path.join(d, `${pass.file}-${n}.json`));
  if (!answer) { console.log(`No reading written yet at ${path.join(d, `${pass.file}-${n}.json`)}`); process.exit(1); }
  const { placements, rejected } = verifyPlacements(answer, task.turns, pass.only);
  // A quotation not found in its message is thrown out with its level, and
  // that stands. But a reader that copied the words loosely has usually still
  // read the message right, so it is asked once to copy them again exactly —
  // shown which, never told what to say. The second answer stands as it comes.
  const before = read(path.join(d, `kept-${name}-${n}.json`));
  const retried = !!(before && (before.copyAgain || before.retried));
  const loose = rejected.filter((r) => r.reason === NOT_THEIR_WORDS);
  const copyAgain = !retried && loose.length ? loose.map((r) => ({ message: r.message, ...(r.messages ? { messages: r.messages } : null), cite: r.cite })) : null;
  // Kept per pass, then gathered. Merged into one file as they arrive, a pass
  // re-read after a correction would have to know what the other pass had put
  // there, and a re-read is exactly when that is least safe.
  write(path.join(d, `kept-${name}-${n}.json`), {
    standard: versionOf(pass.prompt),
    ...(copyAgain ? { copyAgain } : null),
    ...(retried ? { retried: true } : null),
    placements, rejected, elsewhere: answer.elsewhere || [],
    outcome: answer.outcome || '', familiarity: answer.familiarity || '',
    objective: answer.objective || task.objective,
  });
  let finished = null;
  const both = Object.keys(PASSES).map((k) => read(path.join(d, `kept-${k}-${n}.json`)));
  if (both.every(Boolean)) {
    write(path.join(d, `placements-${n}.json`), {
      id: `${id}#${n}`, at: task.at,
      objective: both[0].objective || task.objective,
      outcome: both[0].outcome, familiarity: both[0].familiarity,
      placements: both.flatMap((b) => b.placements),
      rejected: both.flatMap((b) => b.rejected),
      elsewhere: both.flatMap((b) => b.elsewhere),
    });
    // Said to the person, not to the program. A task is finished here and this
    // is the only moment its reading exists as one thing; printed as counts of
    // kept and thrown-out placements it tells somebody watching nothing about
    // their own record, and a run that says nothing until the end looks from
    // outside like a program helping itself to the machine.
    const all = both.flatMap((b) => b.placements);
    const tops = new Map();
    for (const pl of all) {
      const cur = tops.get(pl.column);
      if (!cur || pl.rung > cur.rung) tops.set(pl.column, pl);
    }
    const said = COLUMNS.filter((c) => tops.has(c))
      .map((c) => `${SITUATION_NAMES[c]} L${tops.get(c).rung} ${nameOf(c, tops.get(c).rung)}`)
      .join(' · ');
    finished = [
      '',
      `  READ: ${both[0].objective || task.objective || '(no objective stated)'}`,
      `  ${said || 'nothing this ladder measures'}`,
    ];
  }
  console.log(`Task ${n}, pass "${name}": ${placements.length} placement(s) kept, ${rejected.length} thrown out.`);
  if (copyAgain) {
    console.log('');
    console.log(`COPY AGAIN — ${copyAgain.length} quotation(s) are not in the messages they name:`);
    for (const c of copyAgain) console.log(`  · ${c.messages && c.messages.length > 1 ? `messages ${c.messages.join(', ')}` : `message ${c.message}`}: "${c.cite}"`);
    console.log('  Copy those words exactly from those messages, write this answer again,');
    console.log(`  and run the same command: node scripts/cs.mjs ${name} ${id} ${n}`);
    console.log('  This is asked once; what comes back the second time stands.');
    return;
  }
  if (finished) console.log(finished.join('\n'));
  for (const r of rejected) {
    const said = UNUSABLE.get(r.reason);
    console.log(`  · message ${r.message ?? '?'} ${r.column || ''}${r.rung ? ` L${r.rung}` : ''} — ${r.reason}${said ? ` (${said})` : ''}`);
  }
  if (answerWasUnusable(rejected)) {
    console.log('  The answer came back malformed rather than wrong: nothing was claimed');
    console.log('  about this conversation. Write it again before moving on.');
  }
  console.log('');
  cmdNext();
}

function allPlacements() {
  const out = [];
  for (const id of sessionDirs()) {
    const d = sess(id);
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const f of names.filter((f) => f.startsWith('placements-')).sort()) {
      const p = read(path.join(d, f));
      if (p) out.push(p);
    }
  }
  out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return out;
}


/** Where things stand, on one screen, costing nothing. */

/** Erasure. §9.4 requires it of an implementation assessing minors, and
 *  anybody who has had their own words read should be able to take them back.
 *  What goes is everything this kept: the quotations, the readings, the
 *  counting. Nothing of it was anywhere else. */
function cmdForget() {
  const one = arg('session', '');
  const all = process.argv.includes('--all');
  if (!one && !all) {
    console.log('  node scripts/cs.mjs forget --all              remove everything this kept');
    console.log('  node scripts/cs.mjs forget --session <id>     remove one conversation');
    console.log(`\n  It is all under ${WORK} and nowhere else.\n`);
    return;
  }
  const target = all ? WORK : sess(one);
  if (!fs.existsSync(target)) { console.log(`Nothing kept at ${target}`); return; }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}.`);
  if (all) console.log('Your own agent records are untouched: this only ever read them.');
}

function cmdStatus() {
  const tasks = allPlacements();
  if (!tasks.length) {
    console.log('\n  Nothing read yet.\n');
    saySources();
    console.log('  node scripts/cs.mjs list   — what there is to read, and what each would cost');
    console.log('  node scripts/cs.mjs import — read a few and start\n');
    return;
  }
  const st = standing(tasks);
  const sessions = new Set(tasks.map((t) => String(t.id).split('#')[0])).size;
  const now = snapshot(st, tasks.length);
  const prev = lastSnapshot();
  console.log(grid(st, { tasks: tasks.length, sessions, delta: movement(prev, now), glosses: levelGlosses() }));
  keepSnapshot(now, prev);
  if (fs.existsSync(RATING())) pageFooter('overall');
}

const HISTORY = () => path.join(WORK, 'history.jsonl');
function lastSnapshot() {
  try {
    const lines = fs.readFileSync(HISTORY(), 'utf8').trim().split('\n').filter(Boolean);
    return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  } catch { return null; }
}
/** Kept only when something moved. A line per look would bury the readings
 *  under the times somebody checked. */
function keepSnapshot(now, prev) {
  if (prev && prev.tasks === now.tasks) return;
  fs.mkdirSync(path.dirname(HISTORY()), { recursive: true });
  fs.appendFileSync(HISTORY(), `${JSON.stringify(now)}\n`);
}

/** The last few tasks read, and what each reached. */
function cmdRecent() {
  const n = Number(arg('n', 8));
  const tasks = allPlacements().slice(-n).reverse();
  if (!tasks.length) { console.log('Nothing read yet.'); return; }
  console.log('');
  for (const t of tasks) {
    const tops = {};
    for (const p of t.placements) {
      if (!tops[p.column] || p.rung > tops[p.column].rung) tops[p.column] = p;
    }
    const line = Object.entries(tops)
      .map(([c, p]) => `${SITUATION_NAMES[c]} L${p.rung}${p.landed === 'yes' ? '' : p.landed === 'no' ? ' (not met)' : ' (set aside)'}`)
      .join(' · ');
    console.log(`  ${String(t.at || '').slice(0, 10)}  ${padWide(String(t.objective || '(no objective)').replace(/\s+/g, ' '), 48)}  ${line || 'nothing placed'}`);
  }
  console.log('');
}

/** The page, built from what has been read, for `page` when they ask for one:
 *  to standard output, or to a file in the folder they have open. */
function buildPage(tasks, st, { contributed, moved = [], waiting = [] }) {
  return page(st, {
    tasks, sessions: contributed, depth: depthNow(st), moved,
    labels: handLabels(), lang: langOf() || 'en', lows: lowsShown(tasks), weakest: weakest(st),
    waiting: { count: waiting.length, readings: waiting.length ? estimate(waiting.slice(0, 3)).readings : 0 },
  });
}

/** The language the person speaks, as the agent said it: `cs lang <code>`. */
const SETTINGS = () => path.join(WORK, 'settings.json');
const langOf = () => (read(SETTINGS(), {}) || {}).lang || '';

/** What each height closes in each situation, in the standards' own words —
 *  the part of the table that is not the program's to write. */
function rungsTemplate() {
  const defs = rungDefinitions(readStandard());
  const q = rungDefinitions(`**knowing** — a message that asks to be told something.\n\n${promptFile('knowing.md')}`);
  const out = {};
  for (const c of COLUMNS) {
    const from = c === 'knowing' ? q.knowing : defs[c];
    out[c] = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [String(r), (from && from[r]) || '']));
  }
  return out;
}
const labelsTemplate = () => template(rungsTemplate());

/** The table to hand things over with, in their language where there is one;
 *  English until the agent has written it. */
function handLabels() {
  const tpl = labelsTemplate();
  return labelsFor(WORK, langOf(), tpl) || tpl;
}

/** True when the person speaks another language and the table for it has not
 *  been written for these standards yet. */
function labelsMissing() {
  const lang = langOf();
  return needsTranslation(lang) && !labelsFor(WORK, lang, labelsTemplate());
}

function sayTranslate() {
  const lang = langOf();
  const src = path.join(WORK, 'labels', `${lang}.template.json`);
  write(src, labelsTemplate());
  console.log(`NEXT — write the words of the card and the page in ${lang}, once.`);
  console.log(`  read:  ${src}`);
  console.log(`  write: ${labelsFile(WORK, lang)}`);
  console.log('  Translate every value into the language they speak and keep everything else:');
  console.log('  the same keys, the same "version", every {blank} exactly as it is, and L1–L6');
  console.log('  as they are. The level names are labels: give each a short name in that');
  console.log('  language. The texts under "rungs" are the standards\' own definitions:');
  console.log('  translate them faithfully, adding and dropping nothing.');
  console.log('  then:  node scripts/cs.mjs next');
}

function cmdLang(code) {
  if (!code) { console.log(`The language the card and the page are given in: ${langOf() || 'en (not set)'}. Set it with: node scripts/cs.mjs lang <code>`); return; }
  write(SETTINGS(), { ...(read(SETTINGS(), {}) || {}), lang: code });
  console.log(`The card and the page will be given in ${code}.`);
  if (labelsMissing()) { console.log(''); sayTranslate(); }
}

/** The lines the last look back gave, each with its review, for the card and
 *  the page. */
function lowsShown(tasks) {
  const done = lowItems().filter((i) => i.review && !i.review.none);
  const round = done.reduce((r, i) => Math.max(r, i.round), 0);
  return done.filter((i) => i.round === round).map((i) => {
    const h = habitOf(tasks, i.column, i.rung);
    return { ...i, habit: h.times >= HABIT_AT_LEAST ? h : null };
  });
}

/** True when tasks have been read that no look back has gone over yet, or a
 *  look back is waiting on a review. */
function lowsPending() {
  const items = lowItems();
  if (items.some((i) => !i.review)) return true;
  const looked = new Set(items.flatMap((i) => i.looked || []));
  return allPlacements().some((t) => !looked.has(String(t.id || '')));
}

/** The page on standard output. Nothing is written and nothing is counted
 *  again: it is the reading that has already been taken, in the form that can
 *  travel. */
function cmdPage() {
  const tasks = allPlacements();
  if (!tasks.length) { console.log('Nothing read yet. Start with: node scripts/cs.mjs import'); process.exit(1); }
  const st = standing(tasks);
  const contributed = new Set(tasks.map((t) => String(t.id).split('#')[0])).size;
  const html = buildPage(tasks, st, { contributed, waiting: candidates() });
  // --out puts it where the person can reach it, which is the folder they have
  // open rather than a private directory on whatever machine this ran on.
  const out = arg('out', '');
  if (out) {
    const to = path.resolve(out);
    writeText(to, html);
    console.log(`Written to ${to}. Show it to them where they can open it; if they cannot reach this machine, hand over the report's block instead of the path.`);
    return;
  }
  process.stdout.write(html);
}

function cmdReport() {
  const tasks = allPlacements();
  if (!tasks.length) { console.log('Nothing read yet. Start with: node scripts/cs.mjs import'); process.exit(1); }
  const st = standing(tasks);
  // The sessions that contributed, not the ones prepared: a run that has read
  // three of fifteen says fifteen and claims evidence it has not looked at.
  const contributed = new Set(tasks.map((t) => String(t.id).split('#')[0])).size;
  const standard = readStandard();
  console.log(card(st, { tasks: tasks.length, sessions: contributed, standard, depth: depthNow(st) }));
  const w = weakest(st);
  if (w) {
    const name = SITUATION_NAMES[w.column];
    console.log(`  LOWEST STANDING: ${name}.`);
    if (w.why) console.log(`  ${w.why} — a level is held only where every conferring situation holds it.`);
    else if (w.held) console.log(`  Holds L${w.held} ${nameOf(w.column, w.held)}; ${w.short} more occasion(s) at L${w.next} ${nameOf(w.column, w.next)} would count toward it.`);
    else console.log(`  Holds nothing yet; ${w.short} more occasion(s) at L${w.next} ${nameOf(w.column, w.next)} would count toward it.`);
    console.log('');
  }
  write(path.join(WORK, 'reading.json'), { takenAt: new Date().toISOString(), standing: st, tasks: tasks.length });
  const prev = lastSnapshot();
  const now = snapshot(st, tasks.length);
  const moved = movement(prev, now);
  if (moved.length) console.log(`  SINCE YOUR LAST READING: ${moved.join(' · ')}\n`);
  keepSnapshot(now, prev);

  // A reading is taken once and looked at afterwards, and what brings somebody
  // back is seeing themselves move rather than being told a level. So the card
  // ends by saying what a next reading would cost and what is still waiting —
  // which is arithmetic over this machine, not an invitation to spend.
  const waiting = candidates();
  if (waiting.length) {
    const soon = waiting.slice(0, 3);
    console.log(`  COMING BACK: ${waiting.length} conversation(s) here are unread; the newest ${soon.length} would take about ${estimate(soon).readings} readings.`);
    console.log('  Looking at this reading again costs nothing — only reading a new conversation asks a model anything.');
    console.log('');
  }

  // Addressed to whoever is running this, at the point where the reading is
  // finished and about to be described instead of handed over. Everything
  // above is the person's; saying so here, rather than only in the skill's
  // text, is the difference between a reading they were given and a reading
  // they were told about.
  // The short form, and the instruction that goes with it, printed where the
  // reading ends and is about to be described instead of handed over.
  // Their own sentence, from the situation where there is one to quote. The
  // lowest standing is the one to read the next step against, but the lowest
  // standing is often the situation with nothing in it — and a reading that
  // shows them no sentence of their own at all is the thing this is for.
  const hasWords = (c) => Object.values(st.situations[c] ? { s: 1 } : {}).length
    && tasks.some((t) => (t.placements || []).some((p2) => p2.column === c && p2.cite && p2.landed === 'yes'));
  const quoteColumn = (w && hasWords(w.column))
    ? w.column
    : (COLUMNS.filter(hasWords).sort((a, b) => (st.situations[b].seen - st.situations[a].seen))[0] || null);
  let quote = '';
  if (quoteColumn && st.situations[quoteColumn]) {
    const at = st.situations[quoteColumn].reached;
    for (const t of tasks) {
      for (const p2 of t.placements || []) {
        if (p2.column === quoteColumn && p2.rung === at && p2.cite && p2.landed === 'yes') { quote = p2.cite; break; }
      }
      if (quote) break;
    }
  }
  const nextCloses = quoteColumn && st.situations[quoteColumn]
    ? stepUp(quoteColumn, Math.min(5, st.situations[quoteColumn].reached + 1),
      quoteColumn === 'knowing'
        ? `**knowing** — the part of a message that asks to be told something.\n\n${promptFile('knowing.md')}`
        : standard)
    : '';
  const L = handLabels();
  if (labelsMissing()) {
    console.log(`  The card below is in English: the words for ${langOf()} have not been written yet.`);
    console.log('  Run `node scripts/cs.mjs next`, write them, and run report again before handing it over.');
  }
  console.log(handover(st, {
    labels: L, tasks: tasks.length, sessions: contributed, weakest: w, quote, quoteColumn, moved,
    nextCloses: quoteColumn && st.situations[quoteColumn]
      ? (L.rungs[quoteColumn] || {})[String(Math.min(5, st.situations[quoteColumn].reached + 1))] || nextCloses
      : '',
    lows: lowsShown(tasks), depth: depthNow(st), batches: Math.floor(tasks.length / DEPTH_BATCH),
  }));

  console.log('  ──  HANDING IT OVER  ──────────────────────────────────────────');
  console.log('  The block above is for them, and it is short so that it can be given');
  console.log('  rather than summarised. It is Markdown: put what lies between the two');
  console.log('  marker lines in your reply as it is, leaving the markers out, and your');
  console.log('  conversation shows the table as a table. Give it as it stands. A summary of a reading');
  console.log('  is one more reading, and what a summary drops first is the numbers');
  console.log('  and their own words, which is the reading.');
  console.log('');
  console.log('  It carries the lowest lines gone back to, each with what it left open');
  console.log('  and the example written to show it, marked as the assistant\'s. Those');
  console.log('  examples are the only sentences written for them: write no other.');
  console.log('  Beside the block, in their language, say in a few lines what it means:');
  console.log('  where they stand, which situation is lowest, and what the next height');
  console.log('  would close.');
  console.log('');
  console.log('  Only if they ask for it as a page: `node scripts/cs.mjs page --out <a file');
  console.log('  in the folder they have open>` writes the same reading as one offline page.');
  console.log('');
  console.log(`  Machine-readable: ${path.join(WORK, 'reading.json')}`);
  console.log('');
}

const promptFile = (name) => {
  try { return fs.readFileSync(path.join(HERE, '..', 'prompts', name), 'utf8'); } catch { return ''; }
};
const readStandard = () => promptFile('placing.md');

/** Each level's own one-line gloss, read out of the normative text rather than
 *  written down a second time. A card that carried its own wording for what a
 *  level is would be a second vocabulary, and the one thing a standard cannot
 *  survive is its name meaning two things. */
function levelGlosses() {
  const out = {};
  try {
    const spec = fs.readFileSync(path.join(HERE, '..', 'spec', 'the-command-scale-v1.0.md'), 'utf8');
    const re = /^#### L([1-6]) \S+\s*\n+([^\n]+)/gm;
    let m;
    while ((m = re.exec(spec))) out[Number(m[1])] = m[2].trim();
  } catch { /* the card prints without them */ }
  return out;
}

function cmdHistory() {
  let entries = [];
  try {
    entries = fs.readFileSync(HISTORY(), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { /* none yet */ }
  if (!entries.length) { console.log('No readings recorded yet.'); return; }
  console.log(trail(entries));
}

function cmdGap() {
  const tasks = allPlacements();
  if (!tasks.length) { console.log('Nothing read yet.'); return; }
  console.log(gaps(standing(tasks), tasks, readStandard(), promptFile('knowing.md')));
}

function cmdWhy(which) {
  const tasks = allPlacements();
  const want = Object.entries(SITUATION_NAMES).find(([k, v]) =>
    k === which || v.toLowerCase() === String(which || '').toLowerCase());
  if (!want) { console.log(`Name one of: ${Object.values(SITUATION_NAMES).join(', ')}`); process.exit(1); }
  const [col, name] = want;
  console.log(`\n  ${name} — every placement, with the words it was credited for\n`);
  for (const t of tasks) {
    for (const p of t.placements.filter((p) => p.column === col)) {
      console.log(`  L${p.rung} ${nameOf(col, p.rung).padEnd(10)} ${p.landed === 'yes' ? 'met    ' : (p.landed === 'no' ? 'not met' : 'set aside')}  ${t.objective || ''}`);
      if (p.cite) console.log(`       “${p.cite.replace(/\s+/g, ' ').slice(0, 100)}”`);
      if (p.why) console.log(`       ${p.why}`);
    }
  }
  console.log('');
}

/** Where the sixth level's batches are kept. */
const DEPTH = () => path.join(WORK, 'depth');

/** A task's own lines and what it was, as the grouping and the readings left them. */
function taskRecord(t) {
  const id = String(t.id || '');
  const sid = id.slice(0, id.lastIndexOf('#'));
  const n = id.slice(id.lastIndexOf('#') + 1);
  const found = (read(path.join(sess(sid), 'tasks.json'), { tasks: [] }).tasks || []).find((y) => String(y.n) === n);
  return found ? { ...t, turns: found.turns } : null;
}

/**
 * Batches for the sixth level: closed tasks, ten at a time, oldest first.
 *
 * A batch, once formed, keeps its tasks. Formed again from scratch each time,
 * a task read late but dated early would slide into an old batch and shift
 * every batch after it, and batches already read would no longer be the
 * batches that were read. Tasks no batch holds yet wait, oldest first, until
 * there are ten of them.
 */
function depthBatches() {
  let names = [];
  try { names = fs.readdirSync(DEPTH()); } catch { names = []; }
  const batches = names.filter((f) => /^batch-\d+\.json$/.test(f)).map((f) => read(path.join(DEPTH(), f))).filter(Boolean)
    .sort((a, b) => a.k - b.k);
  const held = new Set(batches.flatMap((b) => b.tasks));
  const waiting = allPlacements()
    .filter((t) => (t.outcome === 'done' || t.outcome === 'abandoned') && !held.has(String(t.id)))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  while (waiting.length >= DEPTH_BATCH) {
    const k = batches.length + 1;
    const b = { k, tasks: waiting.splice(0, DEPTH_BATCH).map((t) => String(t.id)) };
    write(path.join(DEPTH(), `batch-${k}.json`), b);
    batches.push(b);
  }
  return batches;
}

/** What the depth reader is given: each task's objective, how familiar it
 *  was, how it ended, their lines and the opening of what came back. */
function depthInput(batch) {
  const all = new Map(allPlacements().map((t) => [String(t.id), t]));
  const out = [];
  batch.tasks.forEach((id, i) => {
    const t = all.get(id);
    const r = t && taskRecord(t);
    if (!r) return;
    out.push(`TASK ${i + 1} (${String(r.at || '').slice(0, 10)}) — ${r.objective || '(no objective stated)'}`);
    out.push(`  familiarity: ${r.familiarity || 'not said'} · ended: ${r.outcome || 'not said'}`);
    for (const u of r.turns.filter((x) => !x.notInput)) {
      out.push(`  THEY SAID: ${u.quote}`);
      out.push(`    WHAT CAME BACK: ${u.back || 'not recorded'}`);
    }
    out.push('');
  });
  return out.join('\n');
}

/** Their own words across a batch, for checking the quotations a reading offers. */
const batchWords = (batch) => {
  const all = new Map(allPlacements().map((t) => [String(t.id), t]));
  return batch.tasks.map((id) => taskRecord(all.get(id) || {}))
    .filter(Boolean).flatMap((r) => r.turns.filter((x) => !x.notInput).map((x) => x.quote)).join('\n');
};

/**
 * The next step for the sixth level, if there is one: a batch to read, or a
 * reading written and not yet taken in. True when there was a step.
 */
function depthNext() {
  const batches = depthBatches();
  for (const b of batches) {
    const kept = path.join(DEPTH(), `batch-${b.k}.reading.json`);
    if (fs.existsSync(kept)) continue;
    const answer = read(path.join(DEPTH(), `batch-${b.k}.answer.json`));
    if (answer) {
      const words = flat(batchWords(b));
      const found = (answer.quotes || []).filter((q) => q && words.includes(flat(q)));
      const ok = (v) => (['yes', 'no', 'cannot_tell'].includes(v) ? v : 'cannot_tell');
      let vary = ok(answer.verdict);
      // A showing of the first habit stands on its quotations; with none of
      // them found in their words it counts for neither side (A.5).
      if (vary === 'yes' && !found.length) vary = 'cannot_tell';
      write(kept, { k: b.k, standard: versionOf('prompts/depth.md'), vary, check: ok(answer.checked),
        why: answer.why || '', whyChecked: answer.whyChecked || '', quotes: found });
      continue;
    }
    writeText(path.join(DEPTH(), `batch-${b.k}.txt`), depthInput(b));
    console.log(`NEXT — read batch ${b.k} of ${DEPTH_BATCH} tasks for the sixth level.`);
    console.log(`  read:  ${path.join(DEPTH(), `batch-${b.k}.txt`)}`);
    console.log('  rules: prompts/depth.md');
    console.log(`  write: ${path.join(DEPTH(), `batch-${b.k}.answer.json`)}`);
    console.log('  then:  node scripts/cs.mjs next --deep');
    console.log('');
    console.log('  Hand this batch to a fresh helper that has seen none of this reading —');
    console.log('  not the tasks one by one, not their heights, not the card. The level is');
    console.log('  never an input to its own reading (§5.5). Where no helper can be started:');
    console.log('  SKILL.md, "Then the sixth level".');
    return true;
  }
  return false;
}

/** The sixth level as it stands, from every batch read. */
function depthNow(st) {
  let names = [];
  try { names = fs.readdirSync(DEPTH()); } catch { names = []; }
  const readings = names.filter((f) => f.endsWith('.reading.json')).map((f) => read(path.join(DEPTH(), f))).filter(Boolean);
  const before = read(path.join(DEPTH(), 'shown.json'), {});
  const d = depthStanding(readings, st.level || 0, before);
  try { write(path.join(DEPTH(), 'shown.json'), { vary: d.vary.holds, check: d.check.holds }); } catch { /* shown again next time */ }
  return d;
}

/** Where the lines gone back to are kept: one file per line, with the reading
 *  agent's review beside it once written. */
const LOWS = () => path.join(WORK, 'lows');

function lowItems() {
  let names = [];
  try { names = fs.readdirSync(LOWS()); } catch { return []; }
  return names.filter((f) => f.endsWith('.json') && !f.endsWith('.review.json'))
    .map((f) => read(path.join(LOWS(), f))).filter(Boolean)
    .sort((x, y) => (x.round - y.round) || String(x.slug).localeCompare(String(y.slug)));
}

/** Every example this instrument has handed over, so one pasted back into a
 *  later conversation is known for what it is. */
function examplesGiven() {
  return lowItems().map((i) => i.review && i.review.example).filter(Boolean);
}

/** The message numbers a line is: the messages read together for its
 *  placement, or the one message a reading kept from before placed. */
const linesOf = (item) => (Array.isArray(item.messages) ? item.messages : [item.message]);

/** What the reading agent is given for one line: the whole task it was in,
 *  the line marked, and what the counting already knows about it. */
function lowContext(item, turns) {
  const lines = [
    `Objective: ${item.objective || '(not stated)'}`,
    '',
    'Their messages in this task, in order, each with what came back after it:',
  ];
  const opening = turns.findIndex((t) => !t.notInput);
  turns.forEach((t, i) => {
    if (t.answers) lines.push(`    WHAT IT ANSWERS (said just before the message below, outside this task): ${t.answers}`);
    lines.push(`[${i + 1}]${linesOf(item).includes(i + 1) ? ' >>> THIS LINE <<<' : ''}${i === opening ? ' THIS ONE OPENS THE TASK.' : ''} THEY SAID: ${t.quote}`);
    lines.push(...cameBack(t));
    if (t.notInput) lines.push(`    THIS ONE WAS NOT INPUT: ${t.notInput}`);
  });
  lines.push('');
  const many = linesOf(item);
  lines.push(`THIS LINE: ${many.length > 1 ? `messages ${many.join(', ')}, read together` : `message ${item.message}`}, situation ${SITUATION_NAMES[item.column]}, height ${item.rung}, ${item.landed === 'no' ? 'did not land' : 'landed'}.`);
  // Read together, the messages after the first are what they said, not a
  // cost (§6.2): a placement read that way has none to state.
  if (item.landed === 'no' && !Array.isArray(item.messages)) {
    lines.push(item.rounds === null
      ? 'AFTER IT: nothing later in this task landed in the same situation.'
      : `AFTER IT: ${item.rounds} more message(s) of theirs before the same situation landed, at message ${item.workedAt}.`);
  }
  if (item.next) lines.push(`WHAT THE NEXT HEIGHT CLOSES: ${item.next}`);
  if (langOf()) lines.push(`WRITE IN: ${langOf()}`);
  return lines.join('\n');
}

/**
 * Going back to the lowest lines of the reading.
 *
 * Each round looks only at tasks no earlier round looked at, picks at most
 * three lines, and asks the reading agent to write one review per line against
 * prompts/review.md. When every review is in, the round is handed over.
 */
function cmdLows() {
  const tasks = allPlacements().map((t) => ({ ...t, id: String(t.id || '') }));
  if (!tasks.length) { console.log('Nothing read yet.'); return; }
  const items = lowItems();

  // A review written and not yet taken in is taken in first.
  for (const item of items.filter((i) => !i.review)) {
    const answer = read(path.join(LOWS(), `${item.slug}.review.json`));
    if (!answer) continue;
    const need = ['doing', 'happened', 'open', 'example'];
    const missing = need.filter((k) => !String(answer[k] || '').trim());
    if (missing.length) {
      console.log(`The review for ${item.slug} is missing: ${missing.join(', ')}. Write it again.`);
      return;
    }
    if (flatSame(answer.example, item.quote)) {
      console.log(`The example for ${item.slug} is their own line again. Write one that closes what was left open.`);
      return;
    }
    const decided = (Array.isArray(answer.decided) ? answer.decided : [])
      .filter((x) => x && String(x.what || '').trim() && String(x.chose || '').trim())
      .map((x) => ({ what: String(x.what).trim(), chose: String(x.chose).trim(), where: String(x.where || '').trim() }));
    item.review = { doing: answer.doing, happened: answer.happened, open: answer.open, decided, example: answer.example };
    write(path.join(LOWS(), `${item.slug}.json`), item);
  }
  const open = lowItems().filter((i) => !i.review);
  if (open.length) {
    const i = open[0];
    console.log(`NEXT — go back to one line (${open.length} left in this round).`);
    console.log(`  read:  ${path.join(LOWS(), `${i.slug}.context.txt`)}`);
    console.log('  rules: prompts/review.md');
    console.log(`  write: ${path.join(LOWS(), `${i.slug}.review.json`)}`);
    console.log('  then:  node scripts/cs.mjs lows');
    return;
  }

  // Tasks no earlier round has looked at.
  const looked = new Set(lowItems().flatMap((i) => i.looked || []));
  const fresh = tasks.filter((t) => !looked.has(t.id));
  const done = lowItems();
  if (fresh.length) {
    const picks = pickLows(fresh, new Set(done.map((i) => i.key)));
    const round = done.reduce((r, i) => Math.max(r, i.round), 0) + 1;
    if (picks.length) {
      for (const [k, x] of picks.entries()) {
        const [sid, n] = [x.task.id.slice(0, x.task.id.lastIndexOf('#')), x.task.id.slice(x.task.id.lastIndexOf('#') + 1)];
        const t = (read(path.join(sess(sid), 'tasks.json'), { tasks: [] }).tasks || []).find((y) => String(y.n) === n);
        if (!t) continue;
        const { worked } = roundsAfter(x.task, x.p);
        const std = x.p.column === 'knowing'
          ? `**knowing** — the part of a message that asks to be told something.\n\n${promptFile('knowing.md')}`
          : readStandard();
        const slug = `r${round}-${k + 1}`;
        const item = {
          slug, round, key: keyOf(x.task, x.p), looked: k === 0 ? fresh.map((y) => y.id) : [],
          task: x.task.id, objective: x.task.objective || t.objective || '',
          message: x.p.message, ...(x.p.messages ? { messages: x.p.messages, quotes: x.p.quotes } : null),
          column: x.p.column, rung: x.p.rung, quote: x.p.quote || '', landed: x.p.landed,
          rounds: x.rounds, workedAt: worked ? worked.message : null,
          next: x.p.rung < 5 ? stepUp(x.p.column, x.p.rung + 1, std) : '',
        };
        write(path.join(LOWS(), `${slug}.json`), item);
        writeText(path.join(LOWS(), `${slug}.context.txt`), lowContext(item, t.turns));
      }
      cmdLows();
      return;
    }
    // Nothing below the top height in what is new: remembered as looked at.
    write(path.join(LOWS(), `r${round}-none.json`), { slug: `r${round}-none`, round, key: '', looked: fresh.map((y) => y.id), review: { none: true } });
  }

  const last = lowItems().filter((i) => !(i.review && i.review.none));
  const round = last.reduce((r, i) => Math.max(r, i.round), 0);
  const shown = last.filter((i) => i.round === round);
  if (!shown.length) {
    console.log(fresh.length
      ? '  Nothing to go back to: every line read stood at the top height.'
      : '  Nothing new has been read since the last look back. Read another conversation first.');
    return;
  }
  console.log('');
  console.log('  ──  THE LOWEST LINES, LOOKED AT AGAIN  ─────────────────────────');
  for (const i of shown) {
    const r = i.review;
    const h = habitOf(tasks, i.column, i.rung);
    console.log('');
    console.log(`  ${i.objective || '(no objective stated)'}`);
    const said = Array.isArray(i.quotes) && i.quotes.length ? i.quotes : [i.quote];
    console.log(`    YOUR ${said.length > 1 ? `${said.length} LINES, READ TOGETHER` : 'LINE'} (${SITUATION_NAMES[i.column]} L${i.rung} ${nameOf(i.column, i.rung)}, ${i.landed === 'no' ? 'did not land' : 'landed'}):`);
    for (const q of said) console.log(`      “${String(q).replace(/\s+/g, ' ').slice(0, 200)}”`);
    console.log(`    WHAT YOU WERE DOING: ${r.doing}`);
    console.log(`    WHAT HAPPENED: ${r.happened}`);
    if (i.landed === 'no' && !Array.isArray(i.messages)) {
      console.log(i.rounds === null
        ? '    WHAT IT COST: nothing later in that task landed in the same situation.'
        : `    WHAT IT COST: ${i.rounds} more message(s) before it landed.`);
    }
    console.log(`    LEFT OPEN: ${r.open}`);
    console.log(`    ONE WAY TO SAY IT — an example written by the assistant, not your words:`);
    console.log(`      “${r.example}”`);
    if (h.times >= HABIT_AT_LEAST) {
      console.log(`    A HABIT: the same was left open in ${h.times} of the ${h.of} tasks read so far.`);
    }
  }
  console.log('');
  console.log('  The example is there to show what the line left open; the words are');
  console.log('  the assistant\'s. Pasted back as it stands, a later reading does not');
  console.log('  count it as yours.');
  console.log('');
  console.log('  This is for you, not the hand-over: the report\'s FOR THEM block carries it.');
  console.log('  then:  node scripts/cs.mjs next');
}

/** How the conversation was split and what each message was taken to be
 *  for, before anything is placed: the step a person can check at a glance,
 *  and the one everything after it stands on. */
function cmdTasks(id) {
  const ids = id ? [id] : fs.readdirSync(path.join(WORK, 'sessions')).filter((n) => fs.existsSync(path.join(sess(n), 'tasks.json')));
  if (!ids.length) { console.log('No conversation has been grouped yet.'); return; }
  const kind = (u) => (u.outside ? 'outside the scale' : (u.notInput ? null : (u.column ? SITUATION_NAMES[u.column] : 'no situation given')));
  for (const one of ids) {
    const { tasks = [] } = read(path.join(sess(one), 'tasks.json'), {});
    const theirs = tasks.flatMap((t) => t.turns.filter((u) => kind(u)));
    const not = tasks.flatMap((t) => t.turns.filter((u) => !kind(u))).length;
    console.log(`HOW ${one} WAS SPLIT: ${tasks.length} task(s), ${theirs.length} message(s) of theirs${not ? `, ${not} not theirs (left out below)` : ''}.`);
    console.log('');
    console.log('| Task | What it is about | When | Situation | Their words |');
    console.log('| --- | --- | --- | --- | --- |');
    for (const t of tasks) {
      const rows = t.turns.filter((u) => kind(u));
      if (!rows.length) continue;
      rows.forEach((u, i) => {
        const about = i ? '' : String(t.objective || '').replace(/\|/g, '/') + (t.made ? ` → ${String(t.made).replace(/\|/g, '/')}` : '');
        const words = clip(String(u.quote).replace(/\s+/g, ' ').replace(/\|/g, '/'), 140);
        console.log(`| ${i ? '' : t.n + 1} | ${about} | ${String(u.at || '').slice(5, 16).replace('T', ' ')} | ${kind(u)} | ${words} |`);
      });
    }
    console.log('');
  }
}

/**
 * The reading handed over, in two steps the person takes one at a time.
 *
 * First the conversation's own reading: every situation with how many readings
 * stood at each height, and the lowest lines, one line each, so they can say
 * which to look into. Then, for the lines they name, what the assistant
 * settled that the line left to it, checked against what exists now, each put
 * to them as a question. Looking into a line costs reading the record and the
 * work again, so it is done only for the lines they chose.
 */
const RATING = () => path.join(WORK, 'rating.json');
const PROBES = () => path.join(WORK, 'probes');
const NOW = ['still', 'changed', 'none'];
/** What they did with a thing the assistant settled, as the rest of the record shows. */
const LATER = ['handled', 'checked', 'untouched'];
/** The highest height a line is listed at as one of the lowest. */
const LOW_RUNG = 2;
/** How many settled things are put to them at once. */
const ASK_MAX = 5;
/** How much of what they said afterwards a line is given, and of each message. */
const LATER_CHARS = 24000;
const LATER_ONE_CHARS = 600;

/** Everything they said after a line, in this reading: what tells a thing the
 *  assistant settled and they never came back to from one they took up,
 *  changed or checked. Theirs only, in order, with when and in which task. */
function laterWords(item, ids) {
  const out = [];
  const start = String(item.at || '');
  const rows = [];
  for (const id of ids) {
    for (const t of (read(path.join(sess(id), 'tasks.json'), { tasks: [] }).tasks || [])) {
      for (const u of t.turns) {
        if (u.notInput || String(u.at || '') <= start) continue;
        rows.push({ at: String(u.at || ''), objective: t.objective || '', quote: u.quote });
      }
    }
  }
  rows.sort((a, b) => a.at.localeCompare(b.at));
  let size = 0;
  for (const r of rows) {
    const line = `- ${r.at.slice(0, 16).replace('T', ' ')} (${clip(String(r.objective).replace(/\s+/g, ' '), 60)}): ${clip(r.quote, LATER_ONE_CHARS)}`;
    if (size + line.length > LATER_CHARS) { out.push(`- … ${rows.length - out.length} more not shown`); break; }
    out.push(line);
    size += line.length;
  }
  return { text: out.join('\n'), quotes: rows.map((r) => r.quote) };
}

function readingSessions() {
  const r = read(path.join(WORK, 'this-reading.json'));
  return r && Array.isArray(r.sessions) && r.sessions.length ? r.sessions : sessionDirs();
}

const sessionOf = (taskId) => String(taskId).slice(0, String(taskId).lastIndexOf('#'));
const taskOf = (taskId) => {
  const n = String(taskId).slice(String(taskId).lastIndexOf('#') + 1);
  return (read(path.join(sess(sessionOf(taskId)), 'tasks.json'), { tasks: [] }).tasks || []).find((y) => String(y.n) === n) || null;
};

/** Whether the assistant went on to change anything after a line, in the task
 *  the line is in: what tells a line that left something in the work from one
 *  that was only answered. */
function leftSomething(t, p) {
  if (!t) return false;
  const from = Math.min(...(Array.isArray(p.messages) ? p.messages : [p.message])) - 1;
  return t.turns.slice(Math.max(0, from)).some((u) => (u.did || []).some((d) => /^(changed|committed)/.test(d)));
}

function cmdRating() {
  const want = Number(arg('n', 5));
  const ids = new Set(readingSessions());
  const every = allPlacements();
  const tasks = every.filter((t) => ids.has(sessionOf(t.id)));
  if (!tasks.length) { console.log('Nothing read yet.'); return; }
  const lines = [];
  for (const t of tasks) {
    const tt = taskOf(t.id);
    for (const p of t.placements || []) {
      lines.push({ task: t.id, objective: t.objective || (tt && tt.objective) || '', p, left: leftSomething(tt, p), at: p.at || t.at });
    }
  }
  // The lowest lines are kept for the page that shows them and for tracing;
  // the report itself does not carry them.
  lines.sort((a, b) => (a.p.rung - b.p.rung)
    || ((a.p.landed === 'no' ? 0 : 1) - (b.p.landed === 'no' ? 0 : 1))
    || ((a.left ? 0 : 1) - (b.left ? 0 : 1))
    || String(a.at).localeCompare(String(b.at)));
  // Only lines that are low: at the two lowest heights, or, where nothing sits
  // there, at the lowest height there is. A short reading has few of them, and
  // filling the list from higher up would call a good line one of the worst.
  const floor = lines.length ? Math.min(...lines.map((x) => x.p.rung)) : 1;
  const low = lines.filter((x) => x.p.rung <= Math.max(LOW_RUNG, floor));
  const shown = low.slice(0, want).map((x, i) => ({ k: i + 1, ...x }));
  const was = read(RATING());
  const first = !was || [...(was.sessions || [])].sort().join() !== [...ids].sort().join();
  write(RATING(), { at: new Date().toISOString(), sessions: [...ids], shown, more: Math.max(0, low.length - shown.length) });

  // Every audit before this one, as the same average, so the two can be set
  // side by side and read as up or down.
  const before = every.filter((t) => !ids.has(sessionOf(t.id)));
  const nBefore = new Set(before.map((t) => sessionOf(t.id))).size;
  const now = meanHeights(tasks);
  const then = meanHeights(before);
  console.log(`AUDIT REPORT — ${tasks.length} task(s) in this session`);
  const ranked = unseenListed();
  if (ranked) console.log(auditTotals(ranked));
  console.log('');
  console.log('1. TCS RATING FOR THIS SESSION — the average height your words reached, in each situation');
  console.log(nBefore ? `| Situation | This session | Before (${nBefore} session(s) audited) | Change |` : '| Situation | This session |');
  console.log(nBefore ? '| --- | --- | --- | --- |' : '| --- | --- |');
  for (const c of COLUMNS) {
    const here = now[c] === undefined ? 'none this time' : now[c].toFixed(1);
    if (!nBefore) { console.log(`| ${SITUATION_NAMES[c]} | ${here} |`); continue; }
    const there = then[c] === undefined ? 'none' : then[c].toFixed(1);
    const move = now[c] === undefined || then[c] === undefined ? '—'
      : Number(now[c].toFixed(1)) > Number(then[c].toFixed(1)) ? 'up'
        : Number(now[c].toFixed(1)) < Number(then[c].toFixed(1)) ? 'down' : 'same';
    console.log(`| ${SITUATION_NAMES[c]} | ${here} | ${there} | ${move} |`);
  }
  console.log('');
  if (ranked) { printUnseen(ranked, UNSEEN_SHOWN, '2. '); printRisky(ranked, UNSEEN_SHOWN, '3. '); }
  else console.log('2. The decisions are not listed yet: node scripts/cs.mjs unseen');
  if (first) console.log('Type any of the words below as they are, in this conversation; nothing else is needed.');
  pageFooter('report', '', ranked);
  console.log('  ──  FOR YOU, NOT FOR THEM  ─────────────────────────────────────');
  console.log('  Give the whole report in their language in one reply, their own words as');
  console.log('  they are, ending with the three lines above; translate each line once and');
  console.log('  use that same translation wherever it appears. Then stop: what to do next is theirs to');
  console.log('  say. The rating is of this session, never of the person. The two lists say');
  console.log('  what they may not know and what would cost most if it is not what they meant,');
  console.log('  not what is wrong: whether each is what they meant is theirs to say. What');
  console.log('  each of the words does: SKILL.md, "Pages".');
  console.log('');
}

/** The average height reached in each situation over the given tasks: every
 *  placement counted once, as the rating counts them. */
/** The report's first line: how many there are, before any of them — and
 *  where there are none, that there are none. */
function auditTotals(r) {
  const d = r.ranked.length;
  const seen = (r.seen || []).length;
  if (!d && !seen) return 'The assistant settled nothing on its own in this session that is still in the work.';
  const reply = (r.seen || []).filter((s) => s.seen === 'reply').length;
  const shown = seen ? ` It showed you ${seen} of them (${reply} in a reply, ${seen - reply} in a document).` : '';
  const risky = (r.risky || []).length;
  const left = d ? `${seen ? 'The other' : 'All'} ${d} you may not know (part 2).` : 'There is nothing it did not show you.';
  if (!Array.isArray(r.risky)) return `In this session the assistant settled ${d + seen} thing(s) on its own that are still in the work.${shown} ${left} The high-risk list is not made yet: node scripts/cs.mjs unseen`;
  return `In this session the assistant settled ${d + seen} thing(s) on its own that are still in the work.${shown} ${left} ${risky ? `${risky} ${risky === 1 ? 'is' : 'are'} high risk and you never answered ${risky === 1 ? 'it' : 'them'} (part 3).` : 'Nothing high risk is left that you did not answer.'}`;
}

function meanHeights(tasks) {
  const sum = {};
  const n = {};
  for (const t of tasks) {
    for (const p of t.placements || []) {
      sum[p.column] = (sum[p.column] || 0) + (Number(p.rung) || 0);
      n[p.column] = (n[p.column] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.keys(n).map((c) => [c, sum[c] / n[c]]));
}

/** The pages an audit moves between, like a site: each has what can be done
 *  on it, and every one of them can be reached from any other. */
const PAGES = {
  report: { name: 'Audit report', here: 'Decide task N item M (for instance: Decide task 1 item 3) · Decide high risk N (for instance: Decide high risk 1)' },
  all: { name: 'All decisions', here: 'Decide task N item M (for instance: Decide task 1 item 3) · Decide high risk N (for instance: Decide high risk 1)' },
  lowest: { name: 'Lowest lines', here: 'Trace line N (for instance: Trace line 1)' },
  trace: { name: 'Trace', here: 'Decide line N point M (for instance: Decide line 1 point 2)' },
  overall: { name: 'Overall rating', here: '' },
  another: { name: 'Audit another session', here: 'Audit session N (for instance: Audit session 2)' },
  fix: { name: 'Decide', here: 'Say what you want · Explain this part · Apply · Leave it' },
};
const NAV = ['Back to the report', 'Overall rating', 'All decisions', 'Lowest lines', 'Audit another session'];

function pageFooter(page, name, ranked) {
  const p = PAGES[page];
  // A list with nothing in it has nothing to fix.
  const lists = /^Decide task/.test(p.here);
  const here = !lists ? p.here : !ranked ? ''
    : [ranked.ranked.length ? p.here.split(' · ')[0] : '', (ranked.risky || []).length ? p.here.split(' · ')[1] : ''].filter(Boolean).join(' · ');
  console.log('');
  console.log(`You are on: ${name || p.name}`);
  console.log(`On this page: ${here || 'nothing to do here, only to read'}`);
  console.log(`Any time: ${NAV.join(' · ')}`);
  console.log('');
}

/** The three lines for a page whose reply the program does not print, such as
 *  the turns of a fix. */
function cmdNav(page) {
  if (!PAGES[page]) { console.log(`Pages: ${Object.keys(PAGES).join(', ')}`); return; }
  pageFooter(page, page === 'fix' ? fixName() : '');
}

/** What a fix page is called, from what is being fixed: `1.3` for a decision
 *  in the list, `h1` for one in the high-risk list, `line 1.2` for a point
 *  from a trace. */
function fixName() {
  const rest = process.argv.slice(4);
  if (/^h\d+$/.test(String(rest[0] || ''))) return `Decide high risk ${String(rest[0]).slice(1)}`;
  const line = rest[0] === 'line';
  const [t, n] = String((line ? rest[1] : rest[0]) || '').split('.').map(Number);
  if (!Number.isInteger(t) || !Number.isInteger(n)) return '';
  return line ? `Decide line ${t} point ${n}` : `Decide task ${t} item ${n}`;
}

/** The lowest lines of this session's report, for the page that shows them. */
function cmdLowest() {
  const rating = read(RATING());
  if (!rating) { console.log('No report handed over yet: node scripts/cs.mjs rating'); return; }
  console.log(`LOWEST LINES — the ${rating.shown.length} line(s) of yours in this session that settled least`);
  for (const x of rating.shown) {
    const said = (Array.isArray(x.p.quotes) && x.p.quotes.length ? x.p.quotes : [x.p.quote]).map((q) => clip(String(q || '').replace(/\s+/g, ' '), 90));
    console.log(`  ${x.k}. ${SITUATION_NAMES[x.p.column]} L${x.p.rung} ${nameOf(x.p.column, x.p.rung)} · ${x.p.landed === 'no' ? 'did not land' : 'landed'} · ${x.left ? 'the assistant changed files after it' : 'no files changed after it'}`);
    console.log(`     ${clip(String(x.objective).replace(/\s+/g, ' '), 80)}`);
    for (const q of said) console.log(`     "${q}"`);
  }
  if (rating.more) console.log(`  (${rating.more} more at these heights)`);
  pageFooter('lowest');
  console.log('  FOR YOU: "Trace line N" is node scripts/cs.mjs probe N.');
  console.log('');
}

/** One thing from a list, with where it is in the work, for them to decide. */
function cmdFix(ref) {
  const r = unseenListed();
  const high = /^h\d+$/.test(String(ref || '')) ? Number(String(ref).slice(1)) : null;
  if (high === 0) { console.log('No high risk 0 in the list. The list: node scripts/cs.mjs unseen --all'); return; }
  const [t, n] = String(ref || '').split('.').map(Number);
  const d = r && (high ? (r.risky || []).find((s) => s.h === high) : r.ranked.find((s) => s.t === t && s.n === n));
  const name = high ? `Decide high risk ${high}` : `Decide task ${t} item ${n}`;
  if (!d) { console.log(`No ${high ? `high risk ${high}` : `task ${t} item ${n}`} in the list. The list: node scripts/cs.mjs unseen --all`); return; }
  console.log(`DECIDE — ${high ? `high risk ${high}` : `task ${t} item ${n}`}`);
  console.log(`  ${d.question || d.what}`);
  printThing(d, '  ');
  pageFooter('fix', name);
  console.log('  FOR YOU: it is listed because their words did not settle it; here they settle');
  console.log('  it, not you. Ask what it should be, part by part as it was settled, and stop.');
  console.log('  Where an answer leaves a part open or hands it back to you, ask again; do not');
  console.log('  fill it in. Before "Apply", say exactly what will change, from what to what;');
  console.log('  what applying turns up that they would meet, ask before going on. After it,');
  console.log('  say anything they would meet that you settled anyway, and each part left as');
  console.log('  it is. The whole of it:');
  console.log(`  SKILL.md, "Pages". Run node scripts/cs.mjs nav fix ${high ? `h${high}` : `${t}.${n}`} and end every reply with`);
  console.log('  the lines it prints.');
  console.log('');
}

function cmdProbe(which) {
  const rating = read(RATING());
  if (!rating) { console.log('No rating handed over yet: node scripts/cs.mjs rating'); return; }
  if (which) {
    const ks = String(which).split(',').map((x) => Number(x.trim())).filter(Number.isInteger);
    for (const k of ks) {
      const x = rating.shown.find((y) => y.k === k);
      if (!x) { console.log(`No line ${k} in the rating handed over.`); continue; }
      const t = taskOf(x.task);
      if (!t) continue;
      const std = x.p.column === 'knowing'
        ? `**knowing** — the part of a message that asks to be told something.\n\n${promptFile('knowing.md')}`
        : readStandard();
      const item = {
        slug: `p${k}`, k, task: x.task, objective: x.objective,
        message: x.p.message, ...(x.p.messages ? { messages: x.p.messages, quotes: x.p.quotes } : null),
        column: x.p.column, rung: x.p.rung, quote: x.p.quote || '', landed: x.p.landed, at: x.at || '',
        next: x.p.rung < 5 ? stepUp(x.p.column, x.p.rung + 1, std) : '',
      };
      const later = laterWords(item, rating.sessions || readingSessions());
      write(path.join(PROBES(), `${item.slug}.json`), item);
      writeText(path.join(PROBES(), `${item.slug}.context.txt`), `${lowContext(item, t.turns)}\n\nWHAT THEY SAID AFTERWARDS, ANYWHERE IN THIS READING (theirs only, in order):\n${later.text || '- nothing'}\n`);
    }
  }
  const names = fs.existsSync(PROBES()) ? fs.readdirSync(PROBES()).filter((f) => /^p\d+\.json$/.test(f)) : [];
  const items = names.map((f) => read(path.join(PROBES(), f))).filter(Boolean).sort((a, b) => a.k - b.k);
  if (!items.length) { console.log('No line named yet: node scripts/cs.mjs probe 1,3'); return; }
  for (const item of items.filter((i) => !i.review)) {
    const answer = read(path.join(PROBES(), `${item.slug}.review.json`));
    if (!answer) {
      console.log(`NEXT — look into line ${item.k}.`);
      console.log(`  read:  ${path.join(PROBES(), `${item.slug}.context.txt`)}`);
      console.log('  rules: prompts/review.md');
      console.log(`  write: ${path.join(PROBES(), `${item.slug}.review.json`)}`);
      console.log('  then, for every entry in `decided`, go to where it shows and look at what is');
      console.log('  there now: set `now` to "still" (as it was settled), "changed" (it is different');
      console.log('  now) or "none" (nothing in the work shows it), and give `where` as it is now —');
      console.log('  for a file, the file and line.');
      console.log('  then:  node scripts/cs.mjs probe');
      return;
    }
    const need = ['answering', 'doing', 'happened', 'open'].filter((key) => !String(answer[key] || '').trim());
    const decided = Array.isArray(answer.decided) ? answer.decided : null;
    const unchecked = decided ? decided.filter((d) => !NOW.includes(d && d.now)) : [];
    const unread = decided ? decided.filter((d) => !LATER.includes(d && d.later)) : [];
    // What they did later is a claim about their words, and is held to the
    // same check as any other: the words cited must be in what they said.
    const theirLater = laterWords(item, rating.sessions || readingSessions()).quotes;
    const uncited = decided ? decided.filter((d) => d && d.later !== 'untouched' && LATER.includes(d.later)
      && !(String(d.laterCite || '').trim() && theirLater.some((q) => flat(q).includes(flat(d.laterCite))))) : [];
    if (need.length || !decided || unchecked.length || unread.length || uncited.length) {
      console.log(`The review for line ${item.k} is not finished:${need.length ? ` missing ${need.join(', ')};` : ''}${!decided ? ' no `decided` list;' : ''}${unchecked.length ? ` ${unchecked.length} entr${unchecked.length > 1 ? 'ies' : 'y'} in \`decided\` not checked against what exists now (\`now\`: still, changed or none);` : ''}${unread.length ? ` ${unread.length} without \`later\` (handled, checked or untouched);` : ''}${uncited.length ? ` ${uncited.length} marked handled or checked whose \`laterCite\` is not in what they said afterwards — copy their words exactly, or mark it untouched;` : ''} write it again.`);
      return;
    }
    item.review = {
      answering: answer.answering, doing: answer.doing, happened: answer.happened, open: answer.open,
      decided: decided.map((d) => ({ what: String(d.what || '').trim(), chose: String(d.chose || '').trim(), where: String(d.where || '').trim(), now: d.now, later: d.later, laterCite: String(d.laterCite || '').trim() })),
    };
    write(path.join(PROBES(), `${item.slug}.json`), item);
  }
  console.log('TRACE — WHAT THE ASSISTANT SETTLED AFTER THE LINES YOU NAMED, THAT IS STILL AS IT WAS SETTLED');
  console.log('Only what is still in the work as it was settled, and that you either never came back to, or asked to be otherwise.');
  let asked = 0;
  const left = { checked: 0, gone: 0, over: 0 };
  for (const i of items) {
    const said = Array.isArray(i.quotes) && i.quotes.length ? i.quotes : [i.quote];
    const open = i.review.decided.map((d, n) => ({ ...d, n: n + 1 }));
    for (const d of open) {
      if (d.now !== 'still') left.gone += 1;
      else if (d.later === 'checked') left.checked += 1;
    }
    // Never come back to and still there; or asked to be otherwise and still
    // there anyway — a correction that never reached the work.
    const ask = open.filter((d) => d.now === 'still' && (d.later === 'untouched' || d.later === 'handled'));
    console.log('');
    console.log(`${i.k} · ${String(i.objective).replace(/\s+/g, ' ')} (${SITUATION_NAMES[i.column]} L${i.rung})`);
    for (const q of said) console.log(`  You said: "${String(q).replace(/\s+/g, ' ')}"`);
    console.log(`  It answered: ${i.review.answering}`);
    console.log(`  Left open: ${i.review.open}`);
    if (!ask.length) console.log('  Nothing settled here is still as it was settled without your having checked it.');
    for (const d of ask) {
      if (asked >= ASK_MAX && !process.argv.includes('--all')) { left.over += 1; continue; }
      asked += 1;
      const ans = d.answer ? `  — you answered: ${d.answer}${d.wanted ? ` (${d.wanted})` : ''}` : '';
      const said = d.later === 'handled' ? ` You said afterwards: "${d.laterCite}" — it is still as the assistant settled it.` : '';
      const q = d.later === 'handled' ? 'Do you still want it changed?' : 'Is this what you wanted?';
      console.log(`  ${i.k}.${d.n} ${d.what}: the assistant settled it as ${d.chose} (${d.where}).${said} ${q}${ans || ' yes / no'}`);
    }
  }
  console.log('');
  const notes = [
    left.checked ? `${left.checked} you checked and kept` : '',
    left.gone ? `${left.gone} no longer in the work as settled` : '',
    left.over ? `${left.over} more, not shown — at most ${ASK_MAX} at once; probe --all shows them` : '',
  ].filter(Boolean);
  if (notes.length) console.log(`Not asked: ${notes.join('; ')}.`);
  pageFooter('trace');
  console.log('  FOR YOU: give it in their language, their own words as they are, each settled');
  console.log('  thing as a question they answer yes or no, ending with the three lines above.');
  console.log('  Keep each answer: node scripts/cs.mjs answer <line>.<n> yes|no ["what they wanted"].');
  console.log('  "Decide line N point M" goes as deciding an item does (SKILL.md, "Pages"); end');
  console.log('  each reply in it with the lines node scripts/cs.mjs nav fix line N.M prints.');
  console.log('');
}

/** Their answer to one settled thing: whether the line, in the end, got them
 *  what they meant. A reading of whether words landed, taken from them rather
 *  than from what came back at the time. */
function cmdAnswer(ref, said) {
  const [k, n] = String(ref || '').split('.').map(Number);
  const f = path.join(PROBES(), `p${k}.json`);
  const item = read(f);
  const d = item && item.review && item.review.decided && item.review.decided[n - 1];
  if (!d || !['yes', 'no'].includes(said)) { console.log('node scripts/cs.mjs answer <line>.<n> yes|no ["what they wanted"]'); return; }
  d.answer = said;
  const wanted = process.argv[5] || '';
  if (wanted) d.wanted = wanted;
  write(f, item);
  console.log(`Kept: ${k}.${n} — ${said}${wanted ? ` (${wanted})` : ''}.`);
}

/**
 * What the assistant settled on its own across the whole reading, ordered so
 * that what sits where their words were weakest comes first.
 *
 * Every task in which the assistant changed something is gone through, and so
 * is every stretch where it worked and nothing they said was about the work.
 * For each, the reading agent lists what was settled that their words did not
 * decide, whether it was ever put to them, whether they ever answered it, and
 * whether it is still in the work. What a reply said or a document of the
 * session states is left out. The order is the standard's, by task: in how
 * many of the four situations they spoke at all, then how high the task's
 * situations reached, on average over all four.
 */
const UNSEEN = () => path.join(WORK, 'unseen');
const UNSEEN_SHOWN = 10;
const UNSEEN_PER_STRETCH = 10;
const UNSEEN_PER_STRETCH_MAX = 40;
const YES_NO = ['yes', 'no'];
const changedSomething = (turns) => turns.some((u) => (u.did || []).some((d) => /^(changed|committed)/.test(d)));

/** How far their words reached in a task: the height of each situation read
 *  there (none read counts as nothing), averaged over all four, and in how
 *  many of the four they spoke at all. */
function reachOf(placements) {
  const top = {};
  for (const p of placements || []) top[p.column] = Math.max(top[p.column] || 0, Number(p.rung) || 0);
  const heights = COLUMNS.map((c) => top[c] || 0);
  return { mean: heights.reduce((a, b) => a + b, 0) / COLUMNS.length, spoken: heights.filter((h) => h > 0).length, covered: COLUMNS.filter((c) => top[c] > 0) };
}

/** Every stretch to go through: each task the assistant changed something in,
 *  and each stretch of work that nothing of theirs was about. */
function unseenUnits(ids, keep = changedSomething) {
  const out = [];
  for (const id of ids) {
    const d = sess(id);
    for (const t of (read(path.join(d, 'tasks.json'), { tasks: [] }).tasks || [])) {
      if (!keep(t.turns)) continue;
      const placed = read(path.join(d, `placements-${t.n}.json`), { placements: [] });
      out.push({ slug: `${id}-t${t.n}`, id, objective: t.objective || '', turns: t.turns, at: t.at || '', work: false, ...reachOf(placed.placements) });
    }
    const { turns = [] } = read(path.join(d, 'turns.json'), { turns: [] });
    const grouping = read(path.join(d, 'grouping.json'), { tasks: [] }) || { tasks: [] };
    for (const [i, g] of (grouping.tasks || []).entries()) {
      if (g.objective !== null) continue;
      const these = (g.messages || []).filter((n) => Number.isInteger(n) && turns[n]).map((n) => ({ ...turns[n], notInput: turns[n].notInput || 'nothing in it was about the work' }));
      if (!these.length || !keep(these)) continue;
      out.push({ slug: `${id}-w${i}`, id, objective: '', turns: these, at: these[0].at || '', work: true, mean: 0, spoken: 0, covered: [] });
    }
  }
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** How many things one stretch may list: ten, or more where the stretch
 *  changed more — a stretch that built a great deal is where most of what
 *  they cannot know was settled, and ten from it would leave most of it out. */
function listAtMost(u) {
  const did = u.turns.flatMap((t) => t.did || []);
  const changed = new Set(did.filter((d) => /^changed /.test(d))).size;
  const committed = did.filter((d) => /^committed/.test(d)).length;
  return Math.max(UNSEEN_PER_STRETCH, Math.min(UNSEEN_PER_STRETCH_MAX, changed + 5 * committed));
}

/** What they had said before a stretch, in this reading, the latest first to
 *  be kept: what tells a thing they had already decided elsewhere from one the
 *  assistant settled on its own. Given in order. */
function earlierWords(start, ids) {
  const rows = [];
  for (const id of ids) {
    for (const t of (read(path.join(sess(id), 'tasks.json'), { tasks: [] }).tasks || [])) {
      for (const u of t.turns) {
        if (u.notInput || String(u.at || '') >= String(start || '')) continue;
        rows.push({ at: String(u.at || ''), objective: t.objective || '', quote: u.quote });
      }
    }
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const kept = [];
  let size = 0;
  for (const r of rows) {
    const line = `- ${r.at.slice(0, 16).replace('T', ' ')} (${clip(String(r.objective).replace(/\s+/g, ' '), 60)}): ${clip(r.quote, LATER_ONE_CHARS)}`;
    if (size + line.length > LATER_CHARS) break;
    kept.unshift(line);
    size += line.length;
  }
  if (kept.length < rows.length) kept.unshift(`- … ${rows.length - kept.length} earlier not shown`);
  return { text: kept.join('\n') };
}

function unseenContext(u, ids) {
  const lines = u.work
    ? ['A STRETCH WHERE THE ASSISTANT WORKED AND NOTHING THEY SAID WAS ABOUT THE WORK.', '', 'The messages in it, in order, each with what came back after it:']
    : [`Objective: ${u.objective || '(not stated)'}`, '', 'Their messages in this task, in order, each with what came back after it:'];
  u.turns.forEach((t, i) => {
    if (t.answers) lines.push(`    WHAT IT ANSWERS (said just before the message below, outside this task): ${t.answers}`);
    lines.push(`[${i + 1}] THEY SAID: ${t.quote}`);
    if (t.notInput) lines.push(`    THIS ONE WAS NOT INPUT: ${t.notInput}`);
    lines.push(...cameBack(t));
  });
  lines.push('');
  lines.push(`LIST AT MOST: ${listAtMost(u)}`);
  if (langOf()) lines.push(`WRITE IN: ${langOf()}`);
  const before = earlierWords(u.at, ids);
  lines.push('', `WHAT THEY HAD SAID BEFORE, ANYWHERE IN THIS READING (theirs only, the latest, in order):\n${before.text || '- nothing'}`);
  const later = laterWords({ at: u.at }, ids);
  lines.push('', `WHAT THEY SAID AFTERWARDS, ANYWHERE IN THIS READING (theirs only, in order):\n${later.text || '- nothing'}`);
  return lines.join('\n');
}

/**
 * What the assistant built into the work without ever saying it.
 *
 * The list above is read from what the assistant said and the names of the
 * files it changed, so it can hold only what was said somewhere. This reading
 * is given what was written into the files — every edit the record keeps, by
 * the assistant or by a helper it started — beside everything it said back,
 * whole, and lists what the edits put in place that no reply said and their
 * words did not decide. Each entry copies the lines that show it, and the
 * program finds them among the lines the edits put there or took away, and
 * then in the file as it is now.
 */
const UNSAID_PART_CHARS = 60000;
const UNSAID_PER_PART = 10;
const UNSAID_PER_PART_MAX = 40;
const workCache = new Map();

/** Each turn of a stretch as the record it came from keeps it: the whole of
 *  what was said back and the edits made while answering it. Null where the
 *  record is gone or does not keep what was written. */
function workOfSource(source) {
  if (!workCache.has(source)) {
    let w = null;
    try { w = workFrom(source); } catch { w = null; }
    workCache.set(source, w);
  }
  return workCache.get(source);
}

function workOfUnit(u) {
  const t = read(path.join(sess(u.id), 'turns.json'));
  if (!t || !t.source || !fs.existsSync(t.source)) return null;
  const all = workOfSource(t.source);
  if (!all) return null;
  const mine = all.slice(t.offset || 0);
  return u.turns.map((x) => {
    const k = (t.turns || []).findIndex((y) => y.at === x.at && y.quote === x.quote);
    return k >= 0 && mine[k] ? mine[k] : null;
  });
}

/** One edit as the lines it took away and put there, with the lines both
 *  sides share left unmarked: an edit carries the text around what it
 *  changes, and that text is not part of the change. */
function lineDiff(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 4e6) return { before: a.map((l) => `- ${l}`), after: b.map((l) => `+ ${l}`) };
  const n = a.length;
  const m = b.length;
  const keep = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) keep[i][j] = a[i] === b[j] ? keep[i + 1][j + 1] + 1 : Math.max(keep[i + 1][j], keep[i][j + 1]);
  const bo = [];
  const ao = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { bo.push(`  ${a[i]}`); ao.push(`  ${b[j]}`); i += 1; j += 1; }
    else if (j < m && (i >= n || keep[i][j + 1] >= keep[i + 1][j])) { ao.push(`+ ${b[j]}`); j += 1; }
    else { bo.push(`- ${a[i]}`); i += 1; }
  }
  return { before: bo, after: ao };
}

/** The edits of one turn as the blocks a reader is shown, each with the lines
 *  it put there and the lines it took away, for checking what is cited. An
 *  edit too long for one part is shown in pieces. */
function editBlocks(edits) {
  const out = [];
  for (const e of edits || []) {
    const d = e.before === null ? { before: null, after: e.after.split('\n').map((l) => `+ ${l}`) }
      : e.after === null ? { before: e.before.split('\n').map((l) => `- ${l}`), after: [], removed: true } : lineDiff(e.before, e.after);
    const pieces = [];
    let cur = { before: [], after: [] };
    let size = 0;
    const push = () => { if (cur.before.length || cur.after.length) pieces.push(cur); cur = { before: [], after: [] }; size = 0; };
    for (const l of d.before || []) { if (size + l.length > UNSAID_PART_CHARS / 2) push(); cur.before.push(l); size += l.length + 1; }
    for (const l of d.after) { if (size + l.length > UNSAID_PART_CHARS / 2) push(); cur.after.push(l); size += l.length + 1; }
    push();
    pieces.forEach((pc, k) => {
      const head = `    CHANGE in ${e.file}${e.commit ? ` (in the commit "${e.commit}")` : ''}${pieces.length > 1 ? ` (piece ${k + 1} of ${pieces.length} of one edit)` : ''}`;
      const lines = [head, '      BEFORE:'];
      if (d.before === null) lines.push(e.fresh ? '        (nothing: the file is new)' : '        (not in the record: the file was written whole)');
      else if (pc.before.length) lines.push(...pc.before.map((l) => `        ${l}`));
      else lines.push('        (shown in another piece)');
      lines.push('      AFTER:');
      lines.push(...(pc.after.length ? pc.after.map((l) => `        ${l}`) : [d.removed ? '        (nothing: the file was removed)' : '        (shown in another piece)']));
      const text = lines.join('\n');
      out.push({
        file: e.file, text,
        put: pc.after.filter((l) => l.startsWith('+ ')).map((l) => l.slice(2)).join('\n'),
        took: pc.before.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)).join('\n'),
        removed: !!d.removed,
      });
    });
  }
  return out;
}

const git = (dir, args) => {
  try { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};

/** What one commit put in, as the repository has it: each piece of its diff
 *  as an edit, in the file's full path. The commit is found by the first line
 *  of its message, made within the hour around when it was run, in a folder
 *  the command was run in. Null when the repository does not have it. */
function commitEdits(c, named, staged = () => false) {
  const at = Date.parse(c.at);
  if (!Number.isFinite(at)) return null;
  for (const dir of c.dirs) {
    const top = (git(dir, ['rev-parse', '--show-toplevel']) || '').trim();
    if (!top) continue;
    const log = git(top, ['log', '--all', `--since=${new Date(at - 1800e3).toISOString()}`, `--until=${new Date(at + 1800e3).toISOString()}`, '--format=%H%x09%s']) || '';
    const hit = log.split('\n').map((l) => l.split('\t')).find(([, subj]) => subj && subj.trim() === c.subject);
    if (!hit) continue;
    const diff = git(top, ['show', '--format=', '-U3', '--no-color', '--no-ext-diff', '--no-renames', hit[0]]);
    if (diff === null) return null;
    // All of a commit made through an index of its own; otherwise only the
    // files the command added by name, the files a command of this stretch
    // that stages files names — staging one file at a time names it — or,
    // where the command added none, the files this stretch's own commands and
    // edits name: anything else in the commit was staged by someone else.
    const base = c.dirs[0] || top;
    const added = c.adds.map((a) => new RegExp(`^${path.resolve(base, a).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}(/.*)?$`));
    const ours = (f) => c.privateIndex || added.some((r) => r.test(f)) || staged(f, top) || (!added.length && named(f, top));
    const edits = [];
    let file = null;
    let cur = null;
    let fresh = false;
    let gone = false;
    const done = () => { if (cur) edits.push({ file, before: fresh ? null : cur.before.join('\n'), after: gone ? null : cur.after.join('\n'), commit: c.subject, fresh }); cur = null; };
    for (const line of diff.split('\n')) {
      if (line.startsWith('diff --git ')) { done(); file = null; fresh = false; gone = false; continue; }
      if (line.startsWith('+++ ')) { if (line === '+++ /dev/null') gone = true; else file = path.join(top, line.replace(/^\+\+\+ b\//, '')); continue; }
      if (line.startsWith('--- ')) { if (line !== '--- /dev/null') file = path.join(top, line.replace(/^--- a\//, '')); else fresh = true; continue; }
      if (line.startsWith('@@')) { done(); if (file) cur = { before: [], after: [] }; continue; }
      if (!cur) continue;
      if (line.startsWith('-')) cur.before.push(line.slice(1));
      else if (line.startsWith('+')) cur.after.push(line.slice(1));
      else if (line.startsWith(' ')) { cur.before.push(line.slice(1)); cur.after.push(line.slice(1)); }
    }
    done();
    const kept = edits.filter((e) => ours(e.file));
    return { edits: kept, others: new Set(edits.filter((e) => !ours(e.file)).map((e) => e.file)).size };
  }
  return null;
}

/** A file of prose — what somebody reads — rather than what the work runs:
 *  told by its kind of name, the way a reader of the folder would tell it. */
const DOC = /\.(md|markdown|mdx|txt|rst|adoc|asciidoc|org)$/i;
/** Prose files a program reads as its input by their name alone. */
const READ_BY_NAME = /^(requirements[\w.-]*\.txt|constraints\.txt|CMakeLists\.txt|robots\.txt|llms\.txt)$/i;
const runCache = new Map();
/** Whether a prose file is part of what the work runs: read by name, or named
 *  inside a quoted string by a text file of the work in its repository — a
 *  prompt a program hands a model, a list a build installs from. A name
 *  points at the nearest file it can mean, from where it is written; where
 *  two are as near, it points at neither. A mention in an archive, a log or
 *  a backup does not read it. Such a file is the work, not a document about
 *  it. */
const lsCache = new Map();
const steps = (from, to) => {
  const a = from.split(path.sep).filter(Boolean);
  const b = to.split(path.sep).filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return (a.length - i) + (b.length - i);
};
const quotedCache = new Map();
/** Every string in a repository's code that is nothing but the path of a
 *  prose file, with the folder of the file it is written in: one search per
 *  repository. A comment line, a sentence that names a file, a string a file
 *  is written to, a data listing and a copy of prose under another name are
 *  not a program reading the file. A backtick is a quote only where the
 *  language makes it one. */
const PROSE_EXT = '(md|markdown|mdx|txt|rst|adoc|asciidoc|org)';
const BACKTICK_LANG = /\.(js|mjs|cjs|ts|tsx|jsx|sh|bash)$/;
function quotedIn(top) {
  if (quotedCache.has(top)) return quotedCache.get(top);
  const skip = ['md', 'markdown', 'mdx', 'txt', 'rst', 'adoc', 'asciidoc', 'org', 'jsonl', 'json', 'log', 'orig'].map((x) => `:(exclude)*.${x}`);
  const lines = (git(top, ['grep', '-I', '-n', '-E', `["'\`][^"'\`[:space:]]*\\.${PROSE_EXT}["'\`]`, '--', '.', ...skip,
    ':(exclude)*.bak*', ':(exclude)*.md.*', ':(exclude)*.txt.*']) || '').split('\n').filter(Boolean);
  const out = [];
  for (const line of lines) {
    const m = /^(.*?):(\d+):(.*)$/.exec(line);
    if (!m) continue;
    const [, file, , text] = m;
    if (/^\s*(#|\/\/|\*|\/\*)/.test(text) || /writeFile|createWriteStream|\bOUT_|open\([^)]*,\s*["'][wa]/.test(text)) continue;
    const quote = BACKTICK_LANG.test(file) ? "[\"'`]" : "[\"']";
    for (const q of text.matchAll(new RegExp(`(${quote})([^"'\`\\s]+\\.${PROSE_EXT})\\1`, 'g'))) {
      out.push({ from: path.dirname(path.join(top, file)), said: q[2].replace(/^\.\//, '') });
    }
  }
  quotedCache.set(top, out);
  return out;
}

function runsIt(f) {
  if (READ_BY_NAME.test(path.basename(f))) return true;
  if (runCache.has(f)) return runCache.get(f);
  const dir = path.dirname(f);
  const top = fs.existsSync(dir) ? (git(dir, ['rev-parse', '--show-toplevel']) || '').trim() : '';
  let hit = false;
  if (top) {
    if (!lsCache.has(top)) lsCache.set(top, (git(top, ['ls-files']) || '').split('\n').filter(Boolean).map((x) => path.join(top, x)));
    const all = lsCache.get(top);
    const base = path.basename(f);
    for (const { from, said } of quotedIn(top)) {
      if (said !== base && !said.endsWith(`/${base}`)) continue;
      // Every file the string can mean, and the nearest of them.
      const tail = said.split('/').filter((x) => x && x !== '..').join(path.sep);
      const can = all.filter((x) => x === path.join(top, tail) || x.endsWith(path.sep + tail) || x === path.resolve(from, said));
      if (!can.includes(f)) continue;
      const near = Math.min(...can.map((x) => steps(from, path.dirname(x))));
      const nearest = can.filter((x) => steps(from, path.dirname(x)) === near);
      if (nearest.length === 1 && nearest[0] === f) { hit = true; break; }
    }
  }
  runCache.set(f, hit);
  return hit;
}
const isDoc = (f) => DOC.test(String(f || '')) && !runsIt(String(f));
const docsCache = new Map();

/** Every document the assistant wrote or worked from in one session, as each
 *  is now: the documents its edits and commits wrote into, and those its
 *  commands and reads name. What a document states is not something built in
 *  without being said. A document that is gone keeps the lines the record
 *  shows were written into it. One file per session, for a reader to search. */
const MATERIAL_HEAD = 'Shown: what was written into the work\'s files';
const readingDirs = new Map();
/** Whether a file is inside a folder this instrument keeps a reading in —
 *  one with the record of what a reading is of at its root. */
function inReadingFolder(f) {
  for (let d = path.dirname(f); d && d !== path.dirname(d); d = path.dirname(d)) {
    if (!readingDirs.has(d)) readingDirs.set(d, fs.existsSync(path.join(d, 'this-reading.json')));
    if (readingDirs.get(d)) return true;
  }
  return false;
}
function sessionDocs(u, work) {
  const t = read(path.join(sess(u.id), 'turns.json')) || {};
  if (docsCache.has(t.source)) return docsCache.get(t.source);
  const whole = workCache.get(t.source) || work;
  const written = new Map();
  const named = new Set();
  for (const w of whole) {
    if (!w) continue;
    for (const e of w.edits || []) if (isDoc(e.file)) written.set(e.file, `${written.get(e.file) || ''}\n${e.after || ''}`);
    for (const c of w.commits || []) for (const e of (commitEdits(c, () => true) || { edits: [] }).edits) if (isDoc(e.file)) written.set(e.file, `${written.get(e.file) || ''}\n${e.after || ''}`);
    for (const cmd of w.commands || []) {
      const dirs = [...String(cmd).matchAll(/(?:\bcd\s+|\bgit\s+-C\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/g)].map((x) => x[1].replace(/^["']|["']$/g, ''));
      for (const m of String(cmd).matchAll(/[\w./~@+-]+\.(?:md|markdown|mdx|txt|rst|adoc|asciidoc|org)\b/gi)) {
        for (const dir of [...dirs, w.cwd].filter(Boolean)) named.add(path.resolve(dir, m[0]));
        if (path.isAbsolute(m[0])) named.add(m[0]);
      }
    }
  }
  // The harness's own copies of what tools printed, and what this instrument
  // wrote for its own readings, are not documents anybody wrote.
  const own = String(t.source || '').replace(/\.jsonl$/, '');
  // This instrument's material, wherever a reading kept it, is known by its
  // shape: it holds every line the changes put there and would make all of
  // them said.
  const files = [...new Set([...written.keys(), ...named])].filter((f) => !f.startsWith(own) && !f.startsWith(WORK + path.sep)
    && !inReadingFolder(f) && isDoc(f)).sort();
  const parts = [];
  for (const f of files) {
    let text = null;
    try { text = fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null; } catch { text = null; }
    if (text === null && written.has(f)) text = written.get(f).trim();
    if (text === null || text.startsWith(MATERIAL_HEAD) || /^=== DOCUMENT /.test(text)) continue;
    parts.push(`=== DOCUMENT ${f} ===\n${text}`);
  }
  const out = { file: path.join(UNSEEN(), `${u.id}.documents.txt`), text: parts.join('\n\n'), count: parts.length };
  writeText(out.file, out.text);
  docsCache.set(t.source, out);
  return out;
}

/** Every stretch whose record keeps edits or commits, each with its turns'
 *  work. A helper's count: a task whose files were all written by helpers is
 *  a task in which files were written. An edit a later commit in the stretch
 *  holds is shown once, in the commit. */
function unsaidUnits(ids) {
  const out = [];
  for (const u of unseenUnits(ids, () => true)) {
    const work = workOfUnit(u);
    if (!work) continue;
    let lost = 0;
    let others = 0;
    // Named anywhere in the session's record: a commit that undoes earlier
    // work holds the files that work named.
    const whole = workCache.get((read(path.join(sess(u.id), 'turns.json')) || {}).source) || work;
    const text = whole.map((w) => [...((w && w.commands) || []), ...((w && w.edits) || []).map((e) => e.file)].join('\n')).join('\n');
    const named = (f, top) => text.includes(f) || text.includes(path.relative(top, f));
    const staging = whole.flatMap((w) => (w && w.commands) || []).filter((cmd) => /\bgit\b[^\n]*\b(add|update-index)\b/.test(String(cmd))).join('\n');
    const staged = (f, top) => staging.includes(f) || staging.includes(path.relative(top, f));
    const did = work.map((w) => {
      const commits = [];
      for (const c of (w && w.commits) || []) {
        const got = commitEdits(c, named, staged);
        if (got) { commits.push(...got.edits); others += got.others; } else lost += 1;
      }
      return { said: w && w.said, edits: (w && w.edits) || [], commits };
    });
    // What is judged is what the work runs; documents count as said. A
    // conversation's scratch space is named after the conversation, and what
    // is tried out there is not the work.
    const scratch = path.basename(String((read(path.join(sess(u.id), 'turns.json')) || {}).source || '')).replace(/\.jsonl$/, '');
    did.forEach((d, i) => {
      const later = new Set(did.slice(i).flatMap((x) => x.commits.map((e) => e.file)));
      d.edits = [...d.edits.filter((e) => !later.has(e.file)), ...d.commits].filter((e) => !isDoc(e.file) && !(scratch && e.file.includes(scratch)));
    });
    if (!did.some((d) => d.edits.length)) continue;
    out.push({ ...u, did, lost, others, docs: sessionDocs(u, work) });
  }
  return out;
}

/** The parts one stretch is read in: its edits in order, as many to a part as
 *  fit, and in every part all of their messages and all that was said back,
 *  because what counts as said is anything said in the whole stretch. */
function unsaidParts(u, ids) {
  const blocks = u.did.map((w) => editBlocks(w && w.edits));
  const parts = [];
  let cur = [];
  let size = 0;
  blocks.forEach((bs, i) => bs.forEach((b) => {
    if (size + b.text.length > UNSAID_PART_CHARS && size) { parts.push(cur); cur = []; size = 0; }
    cur.push({ turn: i, ...b });
    size += b.text.length;
  }));
  if (cur.length) parts.push(cur);
  const before = earlierWords(u.at, ids);
  return parts.map((these, k) => {
    const lines = [
      'Shown: what was written into the work\'s files with the editing tools, by the assistant or by a helper it started, and what each commit made in the stretch put in, as the repository has it. What was changed by running a command and never committed is not shown. Changes to documents are not shown here: the documents are in the documents file below.',
      `DOCUMENTS FILE: ${u.docs.file} (${u.docs.count} document(s))`,
      u.lost ? `${u.lost} commit(s) made in the stretch could not be found in the repository and are not shown.` : '',
      u.others ? `${u.others} file(s) the commits took along that the assistant did not add itself are not shown.` : '',
      parts.length > 1 ? `This is part ${k + 1} of ${parts.length}: only the changes in this part are shown; their messages and the replies are the whole stretch.` : '',
      '',
      u.work ? 'A STRETCH WHERE THE ASSISTANT WORKED AND NOTHING THEY SAID WAS ABOUT THE WORK.' : `Objective: ${u.objective || '(not stated)'}`,
      '',
    ].filter((l, i) => l || i > 1);
    u.turns.forEach((t, i) => {
      if (t.answers) lines.push(`    A REPLY JUST BEFORE THE MESSAGE BELOW, OUTSIDE THIS TASK: ${t.answers}`);
      // A message they did not type — a helper handing back, a note from the
      // harness — decides nothing and was not said to them; its opening says
      // what it was.
      lines.push(`[${i + 1}] THEY SAID: ${t.notInput ? clip(t.quote, NOT_INPUT_CHARS) : t.quote}`);
      if (t.notInput) lines.push(`    THIS ONE WAS NOT INPUT: ${t.notInput}`);
      for (const b of these.filter((x) => x.turn === i)) lines.push(b.text);
      const w = u.did[i];
      lines.push(`    THE ASSISTANT REPLIED: ${(w && w.said) || t.back || 'not recorded'}`);
    });
    lines.push('');
    lines.push(`LIST AT MOST: ${Math.max(UNSAID_PER_PART, Math.min(UNSAID_PER_PART_MAX, 2 * these.length))}`);
    if (langOf()) lines.push(`WRITE IN: ${langOf()}`);
    lines.push('', `WHAT THEY HAD SAID BEFORE, ANYWHERE IN THIS READING (theirs only, the latest, in order):\n${before.text || '- nothing'}`);
    return { text: lines.join('\n'), blocks: these, cap: Math.max(UNSAID_PER_PART, Math.min(UNSAID_PER_PART_MAX, 2 * these.length)) };
  });
}

/** A file the change removed, and that is still gone. */
const stillGone = (block) => !!(block && block.removed && !fs.existsSync(block.file));

/** Whether the file now contradicts the reader's `still`: lines the change
 *  took away, standing again in what the reader copied; or lines the change
 *  put there, no longer in the file. A thing written again in other words is
 *  lost to this, and a reader's mistaken `still` is caught by it: what is
 *  shown must be there. */
function contradicted(block, e) {
  const c = flat(e.changeCite);
  if (!flat(block.put).includes(c)) return flat(e.nowSays).includes(c);
  try { return !flat(fs.readFileSync(block.file, 'utf8')).includes(c); } catch { return true; }
}

/** Whether lines copied from a file are in it now: each line, where the rules
 *  let the reader copy the lines that show a thing from more than one place. */
function inFileNow(file, says) {
  let text;
  try { text = flat(fs.readFileSync(file, 'utf8')); } catch { return false; }
  const lines = String(says).split('\n').map(flat).filter(Boolean);
  return lines.length > 0 && lines.every((l) => text.includes(l));
}

/** One stretch's unsaid reading, checked; null with the reason when it is not
 *  finished. */
function unsaidChecked(u, part, answer) {
  const list = answer && Array.isArray(answer.unsaid) ? answer.unsaid : null;
  if (!list) return { why: 'no `unsaid` list' };
  const said = flat(u.turns.map((t, i) => [(u.did[i] && u.did[i].said) || t.back, t.answers].filter(Boolean).join('\n')).join('\n')) + flat(u.docs.text);
  const bad = list.filter((e) => !e || !['question', 'shows', 'chose', 'file', 'changeCite'].every((k) => String(e[k] || '').trim())
    || !NOW.includes(e.now) || !YES_NO.includes(e.risk));
  // The change a cite comes from: where the same lines were put in more than
  // one file, the one in the file the entry names.
  const placed = list.map((e) => {
    if (!e || !String(e.changeCite || '').trim()) return null;
    const holds = part.blocks.filter((b) => flat(b.put).includes(flat(e.changeCite)) || flat(b.took).includes(flat(e.changeCite)));
    return holds.find((b) => b.file === e.file) || holds[0] || null;
  });
  const unfound = placed.filter((b, i) => list[i] && String(list[i].changeCite || '').trim() && !b).length;
  const unsaidWrong = list.filter((e) => e && String(e.nearestSaid || '').trim() && !said.includes(flat(e.nearestSaid))).length;
  // What it says is there now must be there now, in the file of the change;
  // only a file that is gone has nothing to copy — still, where the change
  // removed it, and changed otherwise.
  const notThere = list.filter((e, i) => e && placed[i] && NOW.includes(e.now) && e.now !== 'none'
    && !(!fs.existsSync(placed[i].file) && !String(e.nowSays || '').trim() && (e.now === 'still' ? stillGone(placed[i]) : !placed[i].removed))
    && !(String(e.nowSays || '').trim() && inFileNow(placed[i].file, e.nowSays))).length;
  const over = Math.max(0, list.length - part.cap);
  const why = [
    over ? `${over} more than the ${part.cap} this part may list` : '',
    bad.length ? `${bad.length} entr${bad.length > 1 ? 'ies' : 'y'} missing \`question\`, \`shows\`, \`chose\`, \`file\` or \`changeCite\`, or \`now\` (still, changed or none), or \`risk\` (yes or no)` : '',
    notThere ? `${notThere} whose \`nowSays\` is empty or not in the file as it is now — open it and copy the lines exactly` : '',
    unfound ? `${unfound} whose \`changeCite\` is not among the lines one change in this part put there or took away — copy them exactly, without the + or - marker` : '',
    unsaidWrong ? `${unsaidWrong} whose \`nearestSaid\` is not in the replies or the documents — copy it exactly, or leave it empty` : '',
  ].filter(Boolean);
  if (why.length) return { why: why.join('; ') };
  return { entries: list.map((e, i) => ({ ...e, block: placed[i] })) };
}

/** Each part's answer checked; a part not yet read goes on `left`, an answer
 *  that cannot be used on `faults`. */
function unsaidDone(ids, left, faults) {
  const units = unsaidUnits(ids);
  const jobs = [];
  for (const u of units) {
    unsaidParts(u, ids).forEach((part, k) => {
      const slug = `${u.slug}-p${k + 1}`;
      writeText(path.join(UNSEEN(), `${slug}.work.txt`), part.text);
      jobs.push({ u, part, slug });
    });
  }
  const all = [];
  for (const j of jobs) {
    const f = path.join(UNSEEN(), `${j.slug}.unsaid.json`);
    const answer = read(f);
    if (!answer) {
      left.push({ what: 'what the assistant built in without saying it', read: path.join(UNSEEN(), `${j.slug}.work.txt`), search: j.u.docs.file, rules: 'unsaid.md', write: f });
      continue;
    }
    const c = unsaidChecked(j.u, j.part, answer);
    if (c.why) {
      faults.push({ file: f, why: `${c.why}.`, read: path.join(UNSEEN(), `${j.slug}.work.txt`), search: j.u.docs.file, rules: 'unsaid.md' });
      continue;
    }
    for (const e of c.entries) {
      all.push({
        unit: j.u.slug, objective: j.u.objective, work: j.u.work, at: j.u.at, mean: j.u.mean, spoken: j.u.spoken, covered: j.u.covered,
        question: String(e.question).trim(), shows: String(e.shows).trim(), chose: String(e.chose).trim(), file: e.block.file,
        nearestSaid: String(e.nearestSaid || '').trim(), still: e.now === 'still' && !contradicted(e.block, e),
        line: lineOf(e.block.file, e.nowSays), nowSays: String(e.nowSays || ''), risk: e.risk === 'yes',
      });
    }
  }
  return { parts: jobs.length, listed: all.length, still: all.filter((x) => x.still) };
}

/** What is left to read in this audit, all at once: each reading stands on its
 *  own, so they can be read side by side, and each is read by a helper that
 *  saw nothing of the conversation being audited — the assistant that did the
 *  work is the worst reader of what it settled without them. */
function unseenLeft(left, faults) {
  const brief = (x) => `Read ${x.read}${x.search ? `, and search ${x.search} as the rules say` : ''}. Apply ${path.join(HERE, '..', 'prompts', x.rules)} exactly, and write the JSON it specifies to ${x.write || x.file}.`;
  if (faults.length) {
    console.log(`NOT FINISHED — ${faults.length} answer(s) cannot be used. Hand each back to the helper that wrote it, or to a new one, with the brief under it:`);
    for (const x of faults) console.log(`  ${x.file}\n     brief: The answer at ${x.file} cannot be used: ${x.why.trim().replace(/;$/, '.')} ${brief(x)} Write the whole answer again; write nothing else.`);
  }
  if (left.length) {
    if (faults.length) console.log('');
    console.log(`NEXT — ${left.length} reading(s) left. Hand each to its own helper agent that has seen nothing of this conversation (a new one, not a copy of this one), with only the brief under it; they can run side by side. Where your tooling cannot start one, see SKILL.md, "Who reads what it decided and what it built in".`);
    left.forEach((x, i) => {
      console.log(`  ${i + 1}. ${x.what}`);
      console.log(`     brief: ${brief(x)} Write nothing else.`);
    });
  }
  console.log('  then:  node scripts/cs.mjs unseen');
}

function cmdUnseen() {
  const ids = readingSessions();
  const units = unseenUnits(ids);
  if (!units.length) { console.log('Nothing in this reading where the assistant changed anything.'); return; }
  // Read again: this audit's answers are kept aside, and every reading is
  // listed again.
  if (process.argv.includes('--again') && fs.existsSync(UNSEEN())) {
    const aside = path.join(UNSEEN(), `before-${new Date().toISOString().replace(/[:.]/g, '-')}`);
    const these = fs.readdirSync(UNSEEN()).filter((f) => /\.(settled|unsaid)\.json$|^ranked\.json$/.test(f));
    if (these.length) fs.mkdirSync(aside, { recursive: true });
    for (const f of these) fs.renameSync(path.join(UNSEEN(), f), path.join(aside, f));
  }
  // Every stretch is prepared at once, so they can be gone through in any
  // order, or by several readers side by side; prepared again each time, so
  // what a reader is shown is what the answer is checked against.
  for (const u of units) {
    writeText(path.join(UNSEEN(), `${u.slug}.context.txt`), unseenContext(u, ids));
  }
  const left = [];
  const faults = [];
  for (const u of units) {
    const f = path.join(UNSEEN(), `${u.slug}.settled.json`);
    const ctx = path.join(UNSEEN(), `${u.slug}.context.txt`);
    const answer = read(f);
    if (!answer) {
      left.push({ what: 'what the assistant settled on its own', read: ctx, rules: 'settled.md', write: f });
      continue;
    }
    const settled = Array.isArray(answer.settled) ? answer.settled : null;
    // Whether a thing was put to them and whether they answered are claims
    // about the record, held to the same check as any other: the words cited
    // must be where they are said to be.
    const came = flat(u.turns.map((t) => [t.back, t.last, t.answers].filter(Boolean).join('\n')).join('\n'));
    const theirs = [...u.turns.filter((t) => !t.notInput).map((t) => t.quote), ...laterWords({ at: u.at }, ids).quotes.map((q) => clip(q, LATER_ONE_CHARS))];
    const bad = (settled || []).filter((s) => !s || !['question', 'shows', 'chose'].every((k) => String(s[k] || '').trim()) || (s.now !== 'none' && !String(s.where || '').trim()) || !YES_NO.includes(s.asked) || !YES_NO.includes(s.answered) || !YES_NO.includes(s.risk) || !NOW.includes(s.now) || (s.now !== 'none' && !String(s.nowSays || '').trim()) || (s.asked === 'yes' && !String(s.firstSaid || '').trim()));
    const unfound = (settled || []).filter((s) => s && String(s.firstSaid || '').trim() && !came.includes(flat(s.firstSaid)));
    const unasked = (settled || []).filter((s) => s && s.asked === 'yes' && !(String(s.askCite || '').trim() && came.includes(flat(s.askCite))));
    const unanswered = (settled || []).filter((s) => s && s.answered === 'yes' && !(String(s.answerCite || '').trim() && theirs.some((q) => flat(q).includes(flat(s.answerCite)))));
    const over = settled ? Math.max(0, settled.length - listAtMost(u)) : 0;
    if (!settled || bad.length || unfound.length || unasked.length || unanswered.length || over) {
      faults.push({ file: f, read: ctx, rules: 'settled.md', why: `${!settled ? ' no `settled` list;' : ''}${over ? ` ${over} more than the ${listAtMost(u)} this stretch may list;` : ''}${bad.length ? ` ${bad.length} entr${bad.length > 1 ? 'ies' : 'y'} missing \`question\`, \`shows\` or \`chose\`, or \`where\` where \`now\` is not none, or \`asked\`/\`answered\`/\`risk\` (yes or no), or \`now\` (still, changed or none), or \`nowSays\` where \`now\` is not none, or \`firstSaid\` where \`asked\` is yes;` : ''}${unfound.length ? ` ${unfound.length} whose \`firstSaid\` is not in what came back — copy the assistant's words exactly;` : ''}${unasked.length ? ` ${unasked.length} marked asked whose \`askCite\` is not in what came back;` : ''}${unanswered.length ? ` ${unanswered.length} marked answered whose \`answerCite\` is not in what they said — copy their words exactly, or mark it no;` : ''}` });
    }
  }
  const unsaid = unsaidDone(ids, left, faults);
  if (left.length || faults.length) { unseenLeft(left, faults); return; }
  const all = [];
  for (const u of units) {
    const { settled = [], total } = read(path.join(UNSEEN(), `${u.slug}.settled.json`), {});
    u.total = Math.max(Number(total) || 0, settled.length);
    // A file named from where the conversation ran is looked for there.
    const ran = ((workOfUnit(u) || []).find((w) => w && w.cwd) || {}).cwd || '';
    for (const s of settled) {
      all.push({
        unit: u.slug, objective: u.objective, work: u.work, at: u.at, mean: u.mean, spoken: u.spoken, covered: u.covered,
        said: !!String(s.firstSaid || '').trim() || s.answered === 'yes', answered: s.answered === 'yes',
        question: String(s.question).trim(), shows: String(s.shows).trim(), chose: String(s.chose).trim(), where: String(s.where).trim(), now: s.now,
        risk: s.risk === 'yes', nowSays: String(s.nowSays || ''),
        line: s.now === 'still' ? lineOf(path.resolve(ran || '/', String(s.where).trim().split(/\s/)[0].replace(/[,;:]?$/, '').replace(/:\d.*$/, '').replace(/^~(?=\/)/, process.env.HOME || '~')), s.nowSays) : null,
      });
    }
  }
  const still = all.filter((s) => s.now === 'still');
  // What they were shown — said to them in a reply, or answered by them, or
  // written in a document of the session — is not what they may not know.
  for (const s of still) {
    if (s.said) { s.seen = 'reply'; continue; }
    const u = units.find((x) => x.slug === s.unit);
    const docs = sessionDocs(u, workOfUnit(u) || []);
    const file = s.line ? s.line.replace(/:\d[\d-]*$/, '') : '';
    if (file && docs.text.split('\n').some((l) => l.startsWith('=== DOCUMENT ') && (l === `=== DOCUMENT ${file} ===` || l.endsWith(`/${file} ===`)))) s.seen = 'document';
  }
  // One list: what it decided and was never shown, and what it built in
  // without saying it. Tasks where their words were weakest come first: fewest
  // of the four situations in the task, then the lowest average height; the
  // fewer situations weighs more than the lower height.
  // Tasks that tie keep the order they were read in.
  const readAt = new Map(unseenUnits(ids, () => true).map((u, i) => [u.slug, i]));
  const weakest = (a, b) => (a.spoken - b.spoken) || (a.mean - b.mean) || String(a.at).localeCompare(String(b.at)) || (readAt.get(a.unit) - readAt.get(b.unit));
  // One thing read twice — from what was said and from what was written, or
  // in two tasks — is one entry. A pair at most, never two from one reading:
  // where it is unclear, both stay, because dropping a thing costs more than
  // listing it twice.
  const twins = (list) => {
    const groups = [];
    for (const x of [...list].sort(weakest)) {
      const g = groups.find((y) => y.length === 1 && sameThing(x, y[0]));
      if (g) g.push(x); else groups.push([x]);
    }
    return groups;
  };
  const pits = twins([...still.filter((s) => !s.seen).map((s) => ({ ...s, kind: 'decided' })), ...unsaid.still.map((s) => ({ ...s, kind: 'built' }))]).map((g) => g[0]);
  // Numbered as they are shown: each task by where it comes, each thing within
  // its task from 1. However many are shown, a number keeps meaning the same
  // thing.
  const taskNo = new Map();
  const count = new Map();
  for (const x of pits) {
    if (!taskNo.has(x.unit)) taskNo.set(x.unit, taskNo.size + 1);
    count.set(x.unit, (count.get(x.unit) || 0) + 1);
    x.t = taskNo.get(x.unit);
    x.n = count.get(x.unit);
  }
  const seen = still.filter((s) => s.seen);
  // A list of its own: what would cost most if it is not what they meant —
  // whether or not they were shown it — leaving out only what they were shown
  // and answered. In the same order, numbered on its own. A thing read twice
  // is left out where they answered either; what is kept is what they were
  // never shown, where one of them is: it is the one that says what they do
  // not know.
  const risky = twins([...still.filter((s) => s.risk).map((s) => ({ ...s, kind: 'decided' })), ...unsaid.still.filter((s) => s.risk).map((s) => ({ ...s, kind: 'built' }))]).filter((g) => !g.some((x) => x.answered)).map((g) => g.find((x) => !x.seen) || g[0]);
  risky.sort(weakest);
  risky.forEach((x, i) => { x.h = i + 1; });
  const ranked = { at: new Date().toISOString(), sessions: ids, stretches: units.length, total: units.reduce((n, u) => n + u.total, 0), listed: all.length, ranked: pits, risky, seen, unsaidParts: unsaid.parts, unsaidListed: unsaid.listed };
  write(path.join(UNSEEN(), 'ranked.json'), ranked);
  // Before the reading is handed over, the list goes with it.
  if (!fs.existsSync(RATING())) {
    console.log(`Listed: ${pits.length} thing(s) the assistant settled on its own and never showed them, still in the work.`);
    console.log('NEXT — hand over the audit report: node scripts/cs.mjs rating');
    return;
  }
  const want = process.argv.includes('--all') ? Infinity : Number(arg('n', UNSEEN_SHOWN));
  printUnseen(ranked, want);
  printRisky(ranked, want);
  if (want === Infinity) printSeen(ranked);
  pageFooter('all', '', ranked);
  console.log('  FOR YOU: give it in their language, as it stands, ending with the three lines');
  console.log('  above. "Decide task N item M" is node scripts/cs.mjs fix N.M; "Decide high risk N" is fix hN.');
  console.log('');
}

/** Where the lines a reader copied from a file stand in it now — the file and
 *  the lines, found by the program, not taken from the reader; the file alone
 *  where only their first line is found; null where it is not there. Shown within its repository, where it is in one. */
function lineOf(file, says) {
  const want = flat(says);
  if (!file || !want) return null;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const at = [];
  let squeezed = '';
  text.split('\n').forEach((l, i) => { const f = flat(l); squeezed += f; for (let k = 0; k < f.length; k++) at.push(i + 1); });
  const top = String(git(path.dirname(file), ['rev-parse', '--show-toplevel']) || '').trim();
  const shown = top ? path.relative(top, file) : file;
  // Lines copied from more than one place are found in none: the file alone.
  const k = squeezed.indexOf(want);
  if (k < 0) return flat(String(says).split('\n')[0]) && squeezed.includes(flat(String(says).split('\n')[0])) ? shown : null;
  const from = at[k];
  const to = at[k + want.length - 1];
  return `${shown}:${from}${to > from ? `-${to}` : ''}`;
}

/** Whether two entries are one thing in the work: read by two readings, at
 *  the same lines of the same file. Where either says no lines, they are not
 *  taken for one: two things can sit in one file, and only the lines tell
 *  them apart. */
function sameThing(a, b) {
  // One reader lists each thing once: two of its own entries are two things.
  if (a.kind === b.kind && a.unit === b.unit) return false;
  // Where it is: the lines the program found, or else the first place the
  // reader named; a path written from the folder the work ran in and one
  // written whole are the same file when one ends with the other.
  const places = (x) => [x.line, String(x.where || x.file || '').split(/[\s;；,，、]/)[0]].map((p) => String(p || '').trim()).filter(Boolean);
  const at = (x) => places(x).find((p) => /:\d+(?:-\d+)?$/.test(p));
  const [pa, pb] = [at(a), at(b)];
  if (!pa || !pb) return false;
  const fileOf = (p) => p.replace(/:\d[\d-]*$/, '');
  const [fa, fb] = [fileOf(pa), fileOf(pb)];
  // A bare file name says no more than the name: it is the same file only
  // where a folder is given too.
  const ends = (long, short) => short.includes('/') && long.endsWith(`/${short}`);
  if (!(fa === fb || ends(fa, fb) || ends(fb, fa))) return false;
  const span = (p) => { const m = /:(\d+)(?:-(\d+))?$/.exec(p); return [Number(m[1]), Number(m[2] || m[1])]; };
  const [x, y] = [span(pa), span(pb)];
  // The same lines, largely: a wide span that only takes in a short one is
  // two things, one beside the other.
  const shared = Math.min(x[1], y[1]) - Math.max(x[0], y[0]) + 1;
  return shared > 0 && shared * 2 >= Math.max(x[1] - x[0], y[1] - y[0]) + 1;
}

/** The list for this reading, once every stretch in it has been gone through. */
function unseenListed() {
  const ids = readingSessions();
  if (!unseenUnits(ids).length) return { sessions: ids, stretches: 0, total: 0, listed: 0, ranked: [] };
  const r = read(path.join(UNSEEN(), 'ranked.json'));
  return r && [...r.sessions].sort().join() === [...ids].sort().join() ? r : null;
}

/** How a task's words stood: in how many of the four situations they spoke,
 *  and the average height over all four. */
function taskStanding(s) {
  if (s.work) return 'work you said nothing about: no situation, average height 0.0';
  const named = (s.covered || []).map((c) => SITUATION_NAMES[c]).join(', ');
  return `your words here: ${s.spoken} of the 4 situations${named ? ` (${named})` : ''}, average height ${Number(s.mean || 0).toFixed(1)}`;
}

/** One thing from the list, as the report and the fix page show it. */
function printThing(s, indent) {
  if (s.shows) console.log(`${indent}Shows up in: ${s.shows}`);
  console.log(`${indent}${s.kind === 'built' ? 'It put there' : 'The assistant decided'}: ${s.chose}`);
  console.log(`${indent}In the work: ${s.line || s.where || s.file}`);
  if (s.nearestSaid) console.log(`${indent}The nearest it said: ${s.nearestSaid}`);
  if (s.seen) console.log(`${indent}You were shown it: in ${s.seen === 'reply' ? 'a reply' : 'a document'}, and never answered it`);
}

function printUnseen(r, want, prefix = '') {
  const shown = r.ranked.slice(0, want);
  console.log(`${prefix}WHAT YOU MAY NOT KNOW`);
  if (!r.stretches) { console.log('Nothing in this session where the assistant changed anything.'); console.log(''); return; }
  console.log('What the assistant settled on its own and never showed you, in a reply or a document. Tasks where your words covered the fewest situations come first, then those with the lowest average height. Check each against what you meant.');
  if (!shown.length) { console.log(''); console.log('  None.'); console.log(''); return; }
  const tasks = [...new Set(shown.map((s) => s.t))].sort((a, b) => a - b);
  for (const t of tasks) {
    const these = shown.filter((s) => s.t === t).sort((a, b) => a.n - b.n);
    console.log('');
    console.log(`  Task ${t} · ${these[0].work ? 'work you said nothing about' : clip(String(these[0].objective).replace(/\s+/g, ' '), 120)}`);
    console.log(`  (${taskStanding(these[0])})`);
    for (const s of these) {
      console.log(`  ${s.n}. ${s.question || s.what}`);
      printThing(s, '     ');
    }
  }
  console.log('');
  if (r.ranked.length > shown.length) console.log(`${r.ranked.length - shown.length} more after these (All decisions).`);
}

/** What would cost most if it is not what they meant, and they never
 *  answered: its own list, in the same order, numbered on its own. */
function printRisky(r, want, prefix = '') {
  if (!r.stretches) return;
  if (!Array.isArray(r.risky)) { console.log(`${prefix}HIGH RISK — not listed yet: node scripts/cs.mjs unseen`); console.log(''); return; }
  const all = r.risky;
  const shown = all.slice(0, want);
  console.log(`${prefix}HIGH RISK`);
  console.log('What the assistant settled on its own that, if it is not what you meant, loses or wrongly charges someone money, loses or exposes data, takes away access that is theirs or gives access that is not, or sends something out that cannot be called back — judged by what getting it wrong would do, not by what it is about. Left out is only what you were shown and answered. Tasks where your words covered the fewest situations come first, then those with the lowest average height. Check each against what you meant.');
  if (!shown.length) { console.log(''); console.log('  None.'); console.log(''); return; }
  let last = null;
  for (const s of shown) {
    if (s.unit !== last) {
      console.log('');
      console.log(`  ${s.work ? 'Work you said nothing about' : clip(String(s.objective).replace(/\s+/g, ' '), 120)}`);
      console.log(`  (${taskStanding(s)})`);
      last = s.unit;
    }
    console.log(`  ${s.h}. ${s.question || s.what}`);
    printThing(s, '     ');
  }
  console.log('');
  if (all.length > shown.length) console.log(`${all.length - shown.length} more after these (All decisions).`);
}

/** What it decided and showed them, for the page that shows everything. */
function printSeen(r) {
  const seen = r.seen || [];
  if (!seen.length) return;
  console.log('WHAT IT SHOWED YOU');
  console.log('Settled on its own, and said to you in a reply, or answered by you, or settled in a document of the session.');
  let last = null;
  for (const s of seen) {
    if (s.unit !== last) {
      console.log('');
      console.log(`  ${s.work ? 'Work you said nothing about' : clip(String(s.objective).replace(/\s+/g, ' '), 120)}`);
      last = s.unit;
    }
    console.log(`  - ${s.question}`);
    console.log(`     The assistant decided: ${s.chose}`);
    console.log(`     You saw it in: ${s.seen === 'reply' ? 'a reply' : 'a document'}`);
  }
  console.log('');
}

const flatSame = (a, b) => String(a || '').replace(/\s+/g, '').toLowerCase() === String(b || '').replace(/\s+/g, '').toLowerCase();

const [, , cmd, a, b] = process.argv;
if (cmd === 'import') cmdImport();
else if (cmd === 'group') cmdGroup(a);
else if (cmd === 'place' || cmd === 'know') cmdPass(cmd, a, b);
else if (cmd === 'report') cmdReport();
else if (cmd === 'page') cmdPage();
else if (cmd === 'why') cmdWhy(a);
else if (cmd === 'status') cmdStatus();
else if (cmd === 'recent') cmdRecent();
else if (cmd === 'list') cmdList();
else if (cmd === 'forget') cmdForget();
else if (cmd === 'gap') cmdGap();
else if (cmd === 'history') cmdHistory();
else if (cmd === 'next') cmdNext();
else if (cmd === 'lows') cmdLows();
else if (cmd === 'tasks') cmdTasks(a);
else if (cmd === 'rating') cmdRating();
else if (cmd === 'probe') cmdProbe(a);
else if (cmd === 'answer') cmdAnswer(a, b);
else if (cmd === 'unseen') cmdUnseen();
else if (cmd === 'lowest') cmdLowest();
else if (cmd === 'fix') cmdFix(a);
else if (cmd === 'nav') cmdNav(a);
else if (cmd === 'lang') cmdLang(a);
else {
  console.log(`The Command Scale v1.0 — audit what an AI assistant decided on its own, and take a reading of your own record.

  node scripts/cs.mjs status                             where you stand, one screen
  node scripts/cs.mjs list                               what there is to read, and what it costs
  node scripts/cs.mjs import [--budget 40] [--take 1,3]  read as much as you want to spend
  node scripts/cs.mjs lang <code>                        the language the card and page are given in
  node scripts/cs.mjs next                               what to do next
  node scripts/cs.mjs group <session>                    apply a grouping
  node scripts/cs.mjs tasks [<session>]                  how it was split, before anything is placed
  node scripts/cs.mjs rating [--n 5]                     the audit report: this session's rating and the decisions
  node scripts/cs.mjs lowest                             this session's lowest lines
  node scripts/cs.mjs probe 1,3                          what the assistant settled after the lines named
  node scripts/cs.mjs answer 1.2 no "…"                  keep their answer to one settled thing
  node scripts/cs.mjs unseen [--n 10 | --all]            what the assistant settled on its own and never showed them, weakest task first
  node scripts/cs.mjs fix 1.3                            one decision, with where it is in the work
  node scripts/cs.mjs nav <page>                         the three lines that end a page
  node scripts/cs.mjs place <session> <task>             keep the first three situations
  node scripts/cs.mjs know  <session> <task>             keep the fourth, read on its own
  node scripts/cs.mjs gap                                what you left open, and what closes it
  node scripts/cs.mjs history                            every reading so far, and what moved
  node scripts/cs.mjs recent                             the last few tasks read
  node scripts/cs.mjs report                             the long card
  node scripts/cs.mjs page [--out ./reading.html]        the same reading as a page
  node scripts/cs.mjs why <situation>                    the words behind it
  node scripts/cs.mjs forget --all                       take it all back

Nothing here calls a model, opens a socket or needs an account. The reading is
taken by the agent running this skill; this program prepares, checks and counts.
Everything it keeps is plain files under ~/.blindspot-checker, on this machine.`);
}
