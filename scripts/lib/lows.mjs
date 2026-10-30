// The lowest lines of theirs, whether they landed, what it cost where they did
// not, and whether the same thing keeps happening. Everything here is arithmetic over readings already taken; the
// one judgement — what was left open and how it could have been said — is
// written by the reading agent against prompts/review.md.

/** Folded the same way a citation is, so a pasted-back example is found
 *  whatever spacing it came back with. */
const flat = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

/** One line's place in the record: the task it is in, its number there, and
 *  the situation it was placed in. */
export const keyOf = (task, p) => `${task.id}:${p.message}:${p.column}`;

/**
 * How many more of their messages the task took after this line before the
 * same situation landed, or that it never did.
 *
 * Counted, not judged: the first later placement in the same situation whose
 * outcome was met is where it was finally said well enough, and every message
 * of theirs in between is a round the line did not save.
 */
export function roundsAfter(task, p) {
  // Read together, nothing later in the task is in that situation, and the
  // messages after the first are what they said rather than rounds (§6.2).
  if (Array.isArray(p.messages)) return { rounds: null, worked: null };
  const later = (task.placements || [])
    .filter((q) => q.column === p.column && q.message > p.message && q.landed === 'yes')
    .sort((a, b) => a.message - b.message)[0];
  return later ? { rounds: later.message - p.message, worked: later } : { rounds: null, worked: null };
}

/**
 * The line a task is counted from in one situation (§6.2): its one placement
 * there, the lines read together for it. A reading kept from before placed
 * lines one at a time, and gives the first at the highest height whose
 * outcome was theirs. A lower line in the same task is not what the task is
 * read as, and taken on its own — a go-ahead in the middle of a piece of work
 * — it says nothing about the work.
 */
function countedFrom(task, column) {
  const here = (task.placements || []).filter((p) => p.column === column);
  if (!here.length) return null;
  const top = Math.max(...here.map((p) => p.rung));
  // Only a line whose outcome was theirs; where every line at the top height
  // failed for a cause of its own, the task gives no line, and no lower line
  // takes its place.
  return here.filter((p) => p.rung === top && p.landed !== 'not_theirs')
    .sort((a, b) => a.message - b.message)[0] || null;
}

/**
 * The lines worth going back to: the lowest of the reading, at most `most` of
 * them and one per task. Each candidate is the line its task is counted from
 * in a situation, so what is gone back to is how the task was read, not a
 * stray line inside it.
 *
 * Lowest first. Among lines at the same height, one that did not land comes
 * before one that did, and then the longer before the shorter.
 */
export function pickLows(tasks, skip, most = 3) {
  const out = [];
  for (const task of tasks) {
    const columns = [...new Set((task.placements || []).map((p) => p.column))];
    for (const column of columns) {
      const p = countedFrom(task, column);
      // The fifth height is the top inside one task: there is no height above
      // it to show, so a line there is not gone back to.
      if (!p || p.rung >= 5 || skip.has(keyOf(task, p))) continue;
      const { rounds } = roundsAfter(task, p);
      out.push({ task, p, rounds });
    }
  }
  const missed = (x) => (x.p.landed === 'no' ? 0 : 1);
  const size = (x) => String(x.p.quote || '').length;
  out.sort((a, b) => (a.p.rung - b.p.rung) || (missed(a) - missed(b)) || (size(b) - size(a)));
  const seen = new Set();
  const picked = [];
  for (const x of out) {
    if (seen.has(x.task.id)) continue;
    seen.add(x.task.id);
    picked.push(x);
    if (picked.length >= most) break;
  }
  return picked;
}

/**
 * Whether the same thing was left open before: in how many of the tasks read
 * so far the highest line in this situation stopped at this height. Stopping
 * at a height is leaving open what the next one closes, so a task whose best
 * line in the situation stopped here left the same thing open.
 */
export function habitOf(tasks, column, rung) {
  let times = 0;
  for (const t of tasks) {
    const here = (t.placements || []).filter((p) => p.column === column);
    if (here.length && Math.max(...here.map((p) => p.rung)) === rung) times += 1;
  }
  return { times, of: tasks.length };
}

/** A habit is said only when it has happened often enough to be one. */
export const HABIT_AT_LEAST = 3;

/** The longest run of characters two folded texts share. */
function longestShared(a, b) {
  let best = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/**
 * True when a line of theirs is mostly an example this instrument wrote,
 * pasted back.
 *
 * An example is often pasted in part — the clause that closed the gap — and
 * sometimes with words of their own around it. A line at least half of which
 * is one unbroken run of an example is the example, and is not counted as
 * theirs; a few shared words are not enough, because a short run is too likely
 * to be somebody's own.
 */
export function pastedBack(quote, examples) {
  const q = flat(quote);
  if (q.length < 12) return false;
  return examples.some((e) => {
    const shared = longestShared(q, flat(e));
    return shared >= 12 && shared * 2 >= q.length;
  });
}
