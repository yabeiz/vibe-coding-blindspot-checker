// The words of what is handed to the person — the card and the page — in one
// place, so that both can be given in the language the person speaks.
//
// WHY THE AGENT TRANSLATES THEM. This instrument runs inside the person's own
// agent and asks no model anything itself. The agent already speaks the
// person's language; nothing here should. So the English below is the source,
// and for any other language the agent is handed this whole table once, writes
// it back translated, and the program fills in the numbers and the person's own
// words. A table written for one version of the standards is not used for
// another: when the definitions change, it is asked for again.
import fs from 'fs';
import path from 'path';

export const STRINGS = {
  // the page
  title: 'Your reading',
  sub: 'The Command Scale v1.0 · closed tasks: {tasks} · conversations: {sessions} · taken {date}',
  heldYes: 'Level held: L{n} {name}',
  heldYesNote: 'Held means reached in every situation and met there, not reached once.',
  heldNo: 'Level held: none yet',
  heldNoNote: 'A level is held only where every situation holds it at that height: {need} occasions with {must} of them met. Holding nothing is the ordinary case; the table says where each situation stands.',
  tableHead: 'Where you stand',
  cellNone: 'not seen',
  cellSeen: 'seen {n} · {short} more to count',
  l6Read: 'read in batches · {read} read · varying how much you say shown in {vary} · putting your own against what comes back shown in {check}',
  l6Waiting: 'read in batches of {size} closed tasks · {have} of {need} batches so far',
  tableNote: 'A cell counts toward a level from {need} occasions at that height, with {must} of them met; a framed cell is held. Question is read on a ladder of its own: {names}.',
  chipNone: '{sit} · nothing yet',
  chipShort: '{sit} · L{next}: {short} more occasions needed',
  chipShortMet: '{sit} · L{next}: {short} more occasions needed, {met} of them still to be met',
  chipRate: '{sit} · L{next}: enough seen, under {pass}% met',
  lowsHead: 'Where to go from here',
  lowsLead: 'The lowest lines of this reading, gone back to. The example under each is written by the assistant to show what was left open: it is not your words, and pasted back as it stands it is not counted as yours.',
  lowTag: '{sit} · L{n} {name} · {landed}',
  landedYes: 'landed',
  landedNo: 'did not land',
  lowYour: 'Your words',
  lowYourMany: 'Your {n} lines, read together',
  lowDoing: 'What you were doing',
  lowHappened: 'What happened',
  lowOpen: 'Left open',
  lowDecided: 'Settled by the assistant, not by you — is each what you wanted?',
  lowExample: 'One way to say it, written by the assistant',
  lowHabit: 'A habit: the same was left open in {times} of the {of} tasks read so far.',
  sitHead: 'Situation by situation',
  sitNone: 'nothing in your record at all',
  sitNoneNote: 'In {tasks} task(s) you never said this. Not saying it is not a failure and nothing counts against you for it. A level is held only where every situation holds it, so this one holds the whole reading at nothing until something appears here.',
  sitReach: 'you reach L{n} {name}',
  defClosed: 'what that closed',
  defNext: 'what L{n} {name} closes that this does not',
  sitShort: '{short} more occasion(s) at L{n} {name}, {must} of {need} met, would hold it.',
  placesHead: 'Every placement, and the words behind it',
  placesNote: 'A level above the first was credited to a sentence of yours and checked against the messages it came from. If you say one of these is wrong, it is wrong until evidence of a different kind arrives.',
  met: 'met',
  notMet: 'not met',
  setAside: 'set aside',
  noObjective: '(no objective stated)',
  backHead: 'Coming back',
  backSince: 'Since your last reading:',
  backFirst: 'This is the first reading kept, so there is nothing yet to have moved. The next one says what changed.',
  nextAt: '{sit} is where the next step is: {short} more occasion(s) at L{n} {name}.',
  nextEmpty: '{sit} has nothing in it yet; one occasion there is worth more than another anywhere else.',
  backWaiting: '{count} conversation(s) on this machine have not been read; reading the newest {k} would take about {readings} readings.',
  backFree: 'Looking at this again costs nothing: the counting is arithmetic over what is already here. Only reading a new conversation asks a model anything.',
  cannotHead: 'What this reading cannot say',
  cannotFew: 'A reading over few tasks is a placement, not a measurement (§10). It is not a diagnosis, not an intelligence measure, and no certificate is issued.',
  cannotSetAside: '{n} occasion(s) were set aside and counted neither way — a refusal, a limit of the environment, a failure with a cause of its own — and are reported because an uncounted escape is a way for evidence to vanish quietly (§5.4).',
  cannotWrong: 'If you say a placement is wrong, it is wrong until evidence of a different kind arrives (§4, B.4). Every level above the first quotes your own words and was checked against the messages it was credited to.',
  footer: 'Nothing here left this machine. This page and the readings behind it are removed by {cmd}.',
  // the card
  cardTitle: 'THE COMMAND SCALE v1.0 · tasks read: {tasks} · conversations: {sessions}',
  cardHeld: 'LEVEL HELD: L{n} {name}',
  cardHeldNo: 'LEVEL HELD: none yet — a level is held where every situation holds it: {need} occasions at that height, {must} of them met.',
  cardSitNone: 'nothing in this record',
  cardSit: 'reached L{n} {name} · occasions: {seen} · {where}',
  cardWhereHeld: 'holds L{n} {name}',
  cardWhereNone: 'nothing held',
  cardLowest: 'LOWEST: {sit} — {why}',
  lowestNone: 'no occasion in this record at all',
  lowestShort: '{short} more occasion(s) at L{n} {name} would hold it',
  lowestThin: 'only {seen} occasion(s) — too thin to stand anything on',
  cardWords: 'YOUR WORDS at the height you reach in {sit}:',
  cardNext: 'WHAT THE NEXT HEIGHT CLOSES:',
  cardSince: 'SINCE LAST TIME:',
  cardFew: 'Over {tasks} task(s) this is a placement, not a measurement (§10).',
  cardCheck: 'Every level above the first quotes your own words, checked against the messages it was credited to. A placement you say is wrong is wrong.',
};

export const NAMES = {
  situations: { asking: 'Request', reacting: 'Review', blocked: 'Roadblock', knowing: 'Question' },
  levels: { 1: 'Note', 2: 'Verse', 3: 'Canon', 4: 'Chronicle', 5: 'Saga', 6: 'Myth' },
  questionLevels: { 1: 'Take', 2: 'Understand', 3: 'Test', 4: 'Connect', 5: 'Construct' },
};

const fingerprint = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** The table in English: every string, every name, and what each height
 *  closes in each situation, in the standards' own words. Its version is its
 *  own text, so a translation of an older table is known for what it is. */
export function template(rungs) {
  const body = { strings: STRINGS, names: NAMES, rungs };
  return { version: fingerprint(JSON.stringify(body)), ...body };
}

const ENGLISH = (lang) => !lang || /^en(\b|-|_)/i.test(lang);

/** Where a translated table is kept. */
export const labelsFile = (work, lang) => path.join(work, 'labels', `${lang}.json`);

/**
 * The table to hand things over with. English is the template itself. Any
 * other language is the translation the agent wrote for this version; a key it
 * left out falls back to the English rather than printing nothing. Null when
 * there is no translation for this version yet.
 */
export function labelsFor(work, lang, tpl) {
  if (ENGLISH(lang)) return tpl;
  let got = null;
  try { got = JSON.parse(fs.readFileSync(labelsFile(work, lang), 'utf8')); } catch { return null; }
  if (!got || got.version !== tpl.version) return null;
  const pick = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, (b && typeof b[k] === 'string' && b[k].trim()) ? b[k] : a[k]]));
  return {
    version: tpl.version,
    strings: pick(tpl.strings, got.strings),
    names: {
      situations: pick(tpl.names.situations, got.names && got.names.situations),
      levels: pick(tpl.names.levels, got.names && got.names.levels),
      questionLevels: pick(tpl.names.questionLevels, got.names && got.names.questionLevels),
    },
    rungs: Object.fromEntries(Object.keys(tpl.rungs).map((c) => [c, pick(tpl.rungs[c], got.rungs && got.rungs[c])])),
  };
}

export const needsTranslation = (lang) => !ENGLISH(lang);

/** One string with its blanks filled. */
export function say(L, key, vars = {}) {
  const s = (L && L.strings && L.strings[key]) || STRINGS[key] || key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

/** A situation's name, and a level's name in the situation it was placed in. */
export const sitName = (L, c) => (L.names.situations[c] || NAMES.situations[c] || c);
export const levelName = (L, c, r) => (c === 'knowing'
  ? (L.names.questionLevels[r] || NAMES.questionLevels[r] || '')
  : (L.names.levels[r] || NAMES.levels[r] || ''));
