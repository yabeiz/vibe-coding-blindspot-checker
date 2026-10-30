// The arithmetic of the standard. Nothing here reads a conversation, asks a
// model, or decides anything: it is handed the placements a reading left
// behind and says where that leaves somebody.
//
// The crediting numbers are the standard's own published defaults (§5.3). The
// sample floor below which no rate is printed is this implementation's own
// value, marked as such: §5.3 fixes that a floor must exist and leaves its
// height to whoever implements, who states what they chose. An implementation
// that changes any of them states its values and keeps the three properties
// §5.3 names — a sample floor, a crediting rate, and a gap between the
// crediting rate and the withdrawal rate.

/** The four situations of B.2, in the order the standard names them.
 *  Appended to, never reordered: what is kept on disk encodes a situation by
 *  its place in this list. */
export const COLUMNS = ['asking', 'reacting', 'blocked', 'knowing'];

/** The situations that confer a level (B.2 "Conferring").
 *
 *  All four. `knowing` — the Question situation — is read on a ladder of its
 *  own because it measures something the other three do not: nothing is being
 *  made, so what a person supplies is that person's own thinking rather than
 *  the design of a thing. Measuring a different thing is why it has its own
 *  five names, and is no reason to leave it out of a level: a level is held
 *  where every conferring situation holds it, and this one is one of them. */
export const CONFERRING = ['asking', 'reacting', 'blocked', 'knowing'];

export const RUNGS = [1, 2, 3, 4, 5, 6];
export const LANDED = ['yes', 'no', 'not_theirs'];

// Ten occasions before a level can be claimed, seven of them met. Below 65% it
// is failing; below 60% it is given back. The gap between the crediting line
// and the withdrawal line is what stops a level flickering on one bad week.
export const NEED = 10;
export const PASS = 0.70;
export const WARN = 0.65;
export const DROP = 0.60;

/** The sample floor: under this many occasions no rate is printed, because a
 *  rate over four occasions is a fact about those four. §5.3 requires a floor
 *  and does not fix its height, so this number is this implementation's own,
 *  and every place that prints it says whose it is. */
export const SHOW_RATE = 5;

/** The sixth level is read across batches of closed tasks, never from one
 *  (§3, A.5): ten to a batch, and three batches that can speak to it. */
export const DEPTH_BATCH = 10;
export const DEPTH_NEED = 3;

/** How a copied-out run of words is matched against what it was copied from.
 *  One spelling of this fold, because a quotation that passed one check and
 *  was thrown out by another would leave nobody able to say which was right. */
export const flat = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

const notTheirs = (p) => p && p.landed === 'not_theirs';

/** The reasons that say the answer came back malformed rather than untrue.
 *
 *  A placement missing a required field, or naming a situation, a level or a
 *  message that does not exist, claimed nothing about the conversation, so
 *  nothing about the conversation has been found out — ask again. A placement
 *  whose quotation is not in the message IS a claim, and a false one. That
 *  check is the whole defence against crediting somebody with what the
 *  assistant said, and it stands. */
export const UNUSABLE = new Map([
  ['no placements in the answer', 'the answer carried no list of placements'],
  ['no such message', 'a placement did not name one of the message numbers in this task'],
  ['situation or level out of range', 'a placement did not name a situation and a level the format allows'],
  ['whether it landed is not one of the three answers', 'a placement did not carry one of the values `landed` allows'],
  ['nothing becomes true', 'a placement in the asking situation arrived with nothing in its `becomes` field'],
]);

const CONTRADICTED = 'this reading also said it belongs elsewhere';
export const NOT_THEIR_WORDS = 'the words are not in their message';
/** A placement in a situation other than the one the grouping gave the message. */
export const NOT_ITS_SITUATION = 'not the situation this message was given';
/** A second placement in a situation this task has already been placed in. */
export const SITUATION_TWICE = 'this situation is already placed in this task';

/** Messages this reading named as asking only to be told something. */
function elsewhereIn(answer, turns) {
  const named = new Set();
  for (const e of (answer && answer.elsewhere) || []) {
    const idx = Number(e && e.message);
    const turn = Number.isInteger(idx) && idx >= 1 && idx <= turns.length ? turns[idx - 1] : null;
    if (!turn) continue;
    const cite = String((e && e.cite) || '').trim();
    // Checked the way a placement's is. An entry whose fragment is not in the
    // message it names is dropped, and whatever it would have taken off the
    // ladder stays there.
    if (cite && flat(turn.quote).includes(flat(cite))) named.add(idx);
  }
  return named;
}

/**
 * Check every placement against the message it claims to come from.
 *
 * A level above the first is only ever reached by copying out the words that
 * do the thing, and checking the copy is what makes that real rather than a
 * request. Whitespace is normalised before comparing — fragments get
 * re-wrapped, and CJK arrives with and without the odd space. Nothing else is
 * forgiven, and nothing the assistant said is ever in the searched text.
 */
/**
 * `only` names the situations this answer was taken against.
 *
 * The fourth situation is read in a pass of its own, against a standard of its
 * own, and the two passes are blind to each other. Held in one standard the
 * fourth's arrival moves the other three — the same words and the same model
 * give different levels inside them. So an answer is
 * checked against the situations it was asked for, and a placement naming any
 * other is a placement from a pass that was not taken.
 */
export function verifyPlacements(answer, turns, only = COLUMNS) {
  const kept = [];
  const rejected = [];
  const placements = (answer && answer.placements) || [];
  if (!placements.length) {
    // An empty answer is expected rather than a failure where there was
    // nothing to place: every message in the task was marked as never having
    // been an attempt to say anything. Treated as malformed, a task made
    // entirely of those could never be finished, and the run would stop on the
    // one kind of task the standard says to expect.
    // A pass over a task where nothing belongs to its situations comes back
    // empty, and that is an answer rather than a fault.
    // Input this pass could place: a message given another pass's situation
    // is that pass's, and a pass that has none of its own has nothing to say.
    // Where the grouping gave messages their situations, a message given one
    // of this pass's is its to place, and so is one the grouping left
    // unmarked; one given another's is that pass's. Without situations, every
    // message that was input is.
    const columned = (turns || []).some((t) => t.column);
    const anyInput = (turns || []).some((t) => !t.notInput && (columned ? (!t.column || only.includes(t.column)) : true));
    // Naming every message as belonging to the other pass IS an answer: this
    // pass was asked where these messages sit on its own standard and said
    // that none of them do.
    // Read as malformed, a pass would be sent back to write again for having
    // correctly said that none of this is its business.
    // So is naming the messages the standard says are not placed — one that
    // only accepts or chooses, a later one in the opening's column.
    const named = ((answer && answer.elsewhere) || []).length > 0
      || ((answer && answer.notPlaced) || []).length > 0;
    return anyInput && !named
      ? { placements: [], rejected: [{ reason: 'no placements in the answer' }] }
      : { placements: [], rejected: [] };
  }
  const elsewhere = elsewhereIn(answer, turns);
  for (const p of placements) {
    // The messages read together for this placement (§4, §6.2). An answer
    // naming one `message` reads that message alone. The placement is filed
    // under the last of them.
    const given = Array.isArray(p && p.messages) && p.messages.length ? p.messages : [p && p.message];
    const numbers = given.map(Number);
    const real = (n) => Number.isInteger(n) && n >= 1 && n <= turns.length;
    if (!numbers.every(real) || new Set(numbers).size !== numbers.length) {
      rejected.push({ ...p, message: numbers.filter(real).pop() ?? (p && p.message), reason: 'no such message' });
      continue;
    }
    let read = numbers.slice().sort((a, b) => a - b);
    let idx = read[read.length - 1];
    // Each pass answers its own `elsewhere`, and each list voids what the pass
    // that wrote it placed: the three situations naming a message whose whole
    // ask is to be told something, and the fourth naming one whose whole ask
    // belongs to the other three. A reader asked "where does this sit" and
    // given no way to say "nowhere" finds somewhere for everything, so the
    // naming is what stands: a message named there leaves the placement, and
    // the messages left still stand together.
    if (read.some((n) => elsewhere.has(n))) {
      const stay = read.filter((n) => !elsewhere.has(n));
      if (!stay.length) {
        rejected.push({ message: idx, column: String(p.column || ''), rung: Number(p.rung),
          cite: String(p.cite || '').trim(), reason: CONTRADICTED });
        continue;
      }
      read = stay;
      idx = read[read.length - 1];
    }
    const rung = Number(p.rung);
    // A pass over a single situation is not asked to name it: its whole answer
    // is that situation, and the standard it was taken against says so in its
    // own first line. The situation is stamped here from the pass instead.
    // Required of it, every placement the fourth standard makes arrives
    // without one and is thrown out as out of range — which is the fourth
    // situation coming back empty from every conversation that had one, with
    // nothing on the card to say it had happened.
    const column = String(p.column || (only.length === 1 ? only[0] : ''));
    // Whole, and never above the fifth: the sixth is about varying how much
    // they specify across many tasks and cannot be placed inside one message.
    // Out of range is reported and dropped, never clamped — offered as a
    // choice, the top of a ladder becomes where anything substantive but
    // unmatched goes.
    if (!only.includes(column) || !(Number.isInteger(rung) && rung >= 1 && rung <= 5)) {
      rejected.push({ message: idx, column, rung, reason: 'situation or level out of range' });
      continue;
    }
    // One message, one situation. The grouping gave each message the one
    // situation it is chiefly for, and a placement anywhere else is not that
    // message's, however well it would read there: it leaves the placement,
    // and the messages that are this situation's stand together without it.
    // A message given no situation — a grouping written before they were
    // given — can be placed in any.
    const own = read.filter((n) => !turns[n - 1].column || turns[n - 1].column === column);
    if (!own.length) {
      rejected.push({ message: idx, column, rung, cite: String(p.cite || '').trim(), reason: NOT_ITS_SITUATION });
      continue;
    }
    read = own;
    idx = read[read.length - 1];
    const quotes = read.map((n) => turns[n - 1].quote);
    // Found in one of those messages: words joined across two of them are a
    // phrase they never wrote (§4, §5.2, A.4).
    const cite = String(p.cite || '').trim();
    if (rung > 1 && !(cite && quotes.some((q) => flat(q).includes(flat(cite))))) {
      rejected.push({ message: idx, messages: read, column, rung, cite, reason: NOT_THEIR_WORDS });
      continue;
    }
    if (!LANDED.includes(p.landed)) {
      rejected.push({ message: idx, column, rung, cite,
        reason: 'whether it landed is not one of the three answers' });
      continue;
    }
    const becomes = String((p && p.becomes) || '').trim();
    if (column === 'asking' && !becomes) {
      rejected.push({ message: idx, column, rung, cite, reason: 'nothing becomes true' });
      continue;
    }
    // Once in each situation for one task: the messages in a situation are
    // read together and placed as one, so a second placement in a situation
    // already placed is not a second sample. The first stands.
    if (kept.some((k) => k.column === column)) {
      rejected.push({ message: idx, column, rung, cite, reason: SITUATION_TWICE });
      continue;
    }
    kept.push({ message: idx, messages: read, column, rung, cite, ...(becomes ? { becomes } : null),
      landed: p.landed, why: String(p.why || ''), quote: quotes.join('\n'), quotes, at: turns[idx - 1].at || '' });
  }
  return { placements: kept, rejected };
}

/** True only when something was thrown out and every reason was the answer's
 *  own shape. Every, not some: one false claim among shape faults and the
 *  claim that was wrong goes unnamed. */
export function answerWasUnusable(rejected) {
  const all = rejected || [];
  return all.length > 0 && all.every((r) => UNUSABLE.has(r && r.reason));
}

/**
 * The height each situation reached in one task, and the placement the sample
 * is read from.
 *
 * One sample per situation per task (§6.2). A reading taken now places each
 * situation once, its messages read together, and that placement is the
 * sample; set aside as a failure with a cause of its own, the situation
 * contributes no sample and the escape is reported. A reading kept from before
 * placed messages one at a time, and is counted as it was read, never read
 * again: at the height reached, from the first placement there whose outcome
 * was their own.
 */
export function topsOf(task) {
  const groups = {};
  for (const c of COLUMNS) groups[c] = [];
  const unknownColumns = [];
  for (const p of (task && task.placements) || []) {
    const c = String((p && p.column) || '');
    if (!Object.prototype.hasOwnProperty.call(groups, c)) { unknownColumns.push(c); continue; }
    groups[c].push(p);
  }
  const tops = [];
  for (const c of COLUMNS) {
    const group = groups[c];
    if (!group.length) continue;
    let rung = 0;
    for (const p of group) rung = Math.max(rung, Number(p.rung) || 0);
    if (!rung) continue;
    const there = group
      .filter((p) => (Number(p.rung) || 0) === rung)
      .sort((a, b) => (Number(a.message) || 0) - (Number(b.message) || 0));
    const own = there.findIndex((p) => !notTheirs(p));
    const best = own >= 0 ? there[own] : there[0];
    const passedOver = own > 0 ? there.slice(0, own) : [];
    tops.push({ column: c, rung, placement: best, messages: group.length, passedOver });
  }
  return { tops, unknownColumns };
}

const emptyCell = () => ({ n: 0, pos: 0, samples: [] });

/** Fold judged tasks into cells, oldest first. */
export function tally(tasks) {
  const cells = {};
  const setAside = [];
  for (const c of COLUMNS) {
    cells[c] = {};
    for (const r of RUNGS) cells[c][r] = emptyCell();
  }
  for (const t of tasks || []) {
    const { tops } = topsOf(t);
    for (const { column, rung, placement, messages, passedOver } of tops) {
      // Every firing of the escape is counted, including the ones stepped over
      // to reach the message that was scored (§5.4). An escape nobody measures
      // is a way for evidence to vanish quietly.
      for (const _ of passedOver || []) setAside.push({ task: t.id || '', column, rung, passedOver: true });
      if (notTheirs(placement)) {
        setAside.push({ task: t.id || '', column, rung, passedOver: false });
        continue;
      }
      const cell = cells[column][rung];
      const positive = placement.landed === 'yes';
      cell.n += 1;
      if (positive) cell.pos += 1;
      cell.samples.push({ task: t.id || '', at: t.at || '', positive,
        quote: placement.cite || placement.quote || '', messages });
    }
  }
  cells._setAside = setAside;
  return cells;
}

/**
 * One cell's standing, read over its samples in the order they arrived.
 *
 * A cell is made good the first time it has NEED samples and PASS of them
 * carried off. From then it stays made good until its rate falls below DROP;
 * under WARN it is failing and still held. A cell that has never been made
 * good is not made good by a rate between the lines.
 */
export function cellState(cell) {
  const n = cell ? cell.n : 0;
  const pos = cell ? cell.pos : 0;
  const rate = n ? pos / n : null;
  let held = false;
  let everHeld = false;
  let seen = 0;
  let good = 0;
  for (const s of (cell && cell.samples) || []) {
    seen += 1;
    if (s.positive) good += 1;
    if (!held && seen >= NEED && good / seen >= PASS) { held = true; everHeld = true; }
    else if (held && good / seen < DROP) held = false;
  }
  return {
    n, pos, rate,
    lit: n > 0,
    scoring: n >= SHOW_RATE,
    shownRate: n >= SHOW_RATE ? rate : null,
    met: held,
    atLine: n >= NEED && rate !== null && rate >= PASS,
    warning: held && rate < WARN,
    givenBack: everHeld && !held,
  };
}

/**
 * Where a run of readings stands, situation by situation.
 *
 * A situation no sample carries gets no cell: everything a cell says is a
 * statement about a run, and over no samples at all every one of those is a
 * number nothing stands behind.
 */
export function standing(tasks) {
  const cells = tally(tasks);
  const must = Math.ceil(NEED * PASS);
  const out = { situations: {}, setAside: cells._setAside, must, need: NEED };
  for (const column of COLUMNS) {
    const rungs = {};
    let seen = 0, held = 0, reached = 0, givenBack = 0;
    for (const rung of RUNGS) {
      if (rung > 5) break;                       // the sixth is not read from samples
      const cell = cellState(cells[column][rung]);
      if (!cell.n) continue;
      rungs[rung] = { n: cell.n, pos: cell.pos, met: cell.met,
        warning: cell.warning, givenBack: cell.givenBack, shownRate: cell.shownRate };
      seen += cell.n;
      reached = rung;
      if (cell.met) held = rung;
      if (cell.givenBack) givenBack = rung;
    }
    if (!seen) continue;
    // The height worth naming next. One above what is held, once something is
    // held; otherwise the height they are already producing at. Held + 1 alone
    // names the bottom of the ladder for as long as they hold nothing, which is
    // a debt at a height they may already have left behind and silence at the
    // height they are working on.
    const next = held ? Math.min(5, held + 1) : (reached || 1);
    const on = cellState(cells[column][next]);
    out.situations[column] = {
      seen, held, reached, givenBack, next,
      samples: on.n, reaching: on.pos,
      short: Math.max(0, NEED - on.n),
      confers: CONFERRING.includes(column),
      rungs,
    };
  }
  // A level from L1 to L5 is held when it is demonstrated in EVERY conferring
  // situation (B.2 "Held"). A situation with no record at all has not
  // demonstrated it, so it holds nothing.
  let level = 0;
  for (let r = 5; r >= 1; r -= 1) {
    const everywhere = CONFERRING.every((c) => out.situations[c] && out.situations[c].rungs[r]
      && out.situations[c].rungs[r].met);
    if (everywhere) { level = r; break; }
  }
  out.level = level;
  return out;
}

/** The names, for printing. The descriptions are the standard's; these are
 *  labels and nothing is decided from them. */
export const LEVEL_NAMES = { 1: 'Note', 2: 'Verse', 3: 'Canon', 4: 'Chronicle', 5: 'Saga', 6: 'Myth' };

/** The fourth situation is read on a ladder of its own and its levels have
 *  their own names (A.3). The numbers are shared with the scale; the names are
 *  not, and printing one ladder's name beside the other's number says the
 *  level is something it is not. A.3 gives its sixth no name. */
export const QUESTION_LEVEL_NAMES = { 1: 'Take', 2: 'Understand', 3: 'Test', 4: 'Connect', 5: 'Construct' };

/** The name a level goes by in the situation it was placed in. */
export const nameOf = (column, rung) => (column === 'knowing'
  ? QUESTION_LEVEL_NAMES[rung] || ''
  : LEVEL_NAMES[rung] || '');
export const SITUATION_NAMES = {
  asking: 'Request', reacting: 'Review', blocked: 'Roadblock', knowing: 'Question',
};

/**
 * The sixth level, from the batches read so far (A.5).
 *
 * Each batch answers two questions on its own: whether they vary how much they
 * specify by what the assistant already knows, and whether they put something
 * of their own against what comes back before building on it. A batch that
 * cannot show a habit either way counts for neither side, and a "yes" to the
 * first is a showing only when a quotation offered for it was found in their
 * words. A habit is shown by at least DEPTH_NEED batches that could speak to
 * it, PASS of which show it; once shown it stays until its rate falls under
 * DROP. The level is held only with both habits shown and the fifth held.
 */
export function depthStanding(readings, held, before = {}) {
  const habit = (key, wasShown) => {
    const speak = readings.filter((r) => r[key] === 'yes' || r[key] === 'no');
    const shown = speak.filter((r) => r[key] === 'yes').length;
    const rate = speak.length ? shown / speak.length : 0;
    const holds = speak.length >= DEPTH_NEED && (rate >= PASS || (wasShown && rate >= DROP));
    return { shown, of: speak.length, holds };
  };
  const vary = habit('vary', before.vary);
  const check = habit('check', before.check);
  return { batches: readings.length, vary, check, myth: held === 5 && vary.holds && check.holds };
}
