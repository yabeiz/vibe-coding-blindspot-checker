// Turning a coding agent's own record into the turns a reading is taken from.
//
// Two rules govern this file. The person's words are carried through byte for
// byte — no trimming inside a message, no spelling repaired, no punctuation
// normalised — because a reading is a claim about what somebody said and the
// citation check compares against exactly this text. And which side said what
// is decided from the shape of the record, never from a product name, because
// a record this does not recognise is the ordinary case rather than the
// exception.
import fs from 'fs';
import path from 'path';
import os from 'os';

/** How much of a reply travels with the turn it answered.
 *
 *  Enough to tell whether the words landed — whether what came back was a
 *  question about what they meant, or the thing they asked for — and no more.
 *  The whole reply would put the assistant's sentences in front of the reader
 *  as if they were evidence about the person; the citation check is what stops
 *  those sentences being credited to anyone, and this bound is what stops them
 *  crowding out the message they followed. */
const REPLY_CHARS = 400;

/** What came back, with the next piece of the same reply added, up to the
 *  bound. A reply arrives in several pieces — a line, a tool, then the answer
 *  — and keeping only the first piece kept "checking now" and dropped the
 *  answer that showed whether their words landed. */
const addReply = (had, more) => {
  if (had.length >= REPLY_CHARS) return had;
  const joined = had ? `${had}\n${more}` : more;
  return joined.length > REPLY_CHARS ? `${joined.slice(0, REPLY_CHARS)}…` : joined;
};

/** How much of the end of a reply travels with the turn as well.
 *
 *  The opening of a reply says whether the words landed; its last piece is
 *  what the person's next message answers — a proposal, a set of options, a
 *  finished result — and a message that answers it cannot be read without
 *  it. The citation check still stops any of it being credited to them. */
const LAST_CHARS = 3000;

/** How many of the assistant's own actions travel with one turn. */
const DID_MAX = 40;

const short = (v, n) => {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** What the assistant did, as opposed to what it said: the files it changed,
 *  what it committed, and the work it handed to another session or a helper.
 *  Read from the tool calls by their shape, so that what happened after a
 *  message can be told apart from what was only described. */
function actionsOf(calls) {
  const out = [];
  for (const c of calls || []) {
    const name = String((c && c.name) || '');
    const a = (c && c.input && typeof c.input === 'object') ? c.input : {};
    const file = a.file_path || a.notebook_path || a.TargetFile || a.target_file || a.path;
    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(name) || /(write_to_file|replace_file_content|edit_file|create_file|search_replace)/i.test(name)) {
      if (typeof file === 'string') out.push(`changed ${file}`);
      continue;
    }
    const cmd = typeof a.command === 'string' ? a.command : (typeof a.CommandLine === 'string' ? a.CommandLine : '');
    if (/\bgit\b[^\n]*\bcommit\b/.test(cmd)) {
      const m = /-m\s+(?:"([^"]*)"|'([^']*)'|"?\$\(cat <<'?EOF'?\n([^\n]*))/.exec(cmd);
      out.push(`committed${m ? `: ${short(m[1] || m[2] || m[3], 160)}` : ''}`);
      continue;
    }
    if (/send_?message/i.test(name)) {
      out.push(`sent to ${short(a.to || a.session_id || a.recipient, 60)}: ${short(a.message || a.text || a.content, 240)}`);
      continue;
    }
    if (/start_session/i.test(name)) { out.push(`started a session: ${short(a.title || a.name, 100)}`); continue; }
    if (/^(Agent|Task)$/.test(name)) out.push(`started a helper: ${short(a.description || a.prompt, 140)}`);
  }
  return out;
}

/** One piece of a reply added to the turn it answered: its words, its last
 *  piece, and what it did. */
const took = (pending, body, calls) => {
  if (body) {
    pending.back = addReply(pending.back, body);
    // The end of the whole reply, not only its last piece: what the next
    // message answers is often laid out in one piece and asked about in the
    // short piece after it.
    const joined = pending.last ? `${pending.last}\n${body}` : body;
    pending.last = joined.length > LAST_CHARS ? `…${joined.slice(-LAST_CHARS)}` : joined;
  }
  const did = actionsOf(calls);
  if (did.length) pending.did = [...new Set([...(pending.did || []), ...did])].slice(0, DID_MAX);
};

const callsIn = (content) => (Array.isArray(content)
  ? content.filter((b) => b && b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input }))
  : []);

/** Shorter than this and a quotation cannot be found again in what it came
 *  from. Records really do contain a turn whose whole text is one character. */
const SHORTEST = 4;

const text = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
};

const toolsIn = (content) => {
  if (!Array.isArray(content)) return [];
  return [...new Set(content.filter((b) => b && b.type === 'tool_use' && b.name).map((b) => b.name))];
};

const isToolResult = (content) =>
  Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');

/** A block the harness wraps around, or puts in front of, what was typed: a
 *  tag whose name is lowercase with a hyphen in it, attributes allowed, closed
 *  by its own end tag. */
const WRAPPER = /^\s*<([a-z]+(?:-[a-z]+)+)(?:\s[^>]*)?>[^]*?<\/\1>\s*/;

/** An image carried into the person's side of the record as a placeholder
 *  line. It is a picture, not words. */
const IMAGE_LINE = /^\[Image[^\]\n]*\]\s*$/gm;

/** What was typed, with whatever the harness put in front of it taken off.
 *
 *  Desktop harnesses put notes for the model ahead of the person's words in the
 *  same message. Read whole, the message opens with a tag and was set aside as
 *  something the harness wrote, and everything typed after the tag went with
 *  it. Only blocks in front are taken off; their words are carried through
 *  byte for byte. A slash command keeps its tags, because the tags are how it
 *  is recognised as an invocation. */
function typedPart(body) {
  let s = body;
  for (let m = WRAPPER.exec(s); m && !/^command-/.test(m[1]); m = WRAPPER.exec(s)) {
    const rest = s.slice(m[0].length);
    if (!rest.trim()) break;                 // the whole message is the harness's
    s = rest;
  }
  const words = s.replace(IMAGE_LINE, '');
  return words.trim() ? s : body;
}

/** A line that was not an attempt to say anything, or not the person's to say.
 *
 *  It stays in its task and in its order — what follows one of these often only
 *  makes sense because it happened — and nothing is placed for it. The tests
 *  are structural: a slash command is an invocation rather than words, and an
 *  interruption is the harness speaking. */
function notInputReason(body) {
  const s = body.trim();
  if (/^<command-(name|message|args)>/m.test(s)) return 'a command invocation, not words';
  if (/^\[Request interrupted/i.test(s)) return 'an interruption recorded by the harness';
  if (!s.replace(IMAGE_LINE, '').trim()) return 'an image with no words';
  // Some harnesses write their own feedback into the person's side of the
  // record. The category is general — text the harness inserted — and the
  // spellings are not, so they are recognised here rather than reasoned about
  // by the reader, which is shown the whole record and no harness at all.
  if (/^(Stop hook feedback|Caveat: The messages below were generated|This session is being continued from a previous conversation)/i.test(s)) {
    return 'inserted by the harness, not typed';
  }
  if (/^Base directory for this skill:/i.test(s)) return "a skill's instructions loaded by the harness, not typed";
  // Another agent speaking in the person's place: a session sending a message,
  // a helper handing its report back, the brief one session writes when it
  // starts another, a notice about a session going idle. None of it was typed
  // by the person, however much of it reads like instructions.
  if (/^(Another Claude session sent a message|Background \(from the session that started this one\)|\[Cross-session [a-z ]*notice\])/i.test(s)) {
    return 'written by another agent, not typed';
  }
  // A harness reporting its own machinery back into the person's side of the
  // record: a background job finishing, a hook firing, a tool being answered.
  // The opening tag is the whole test, because what follows it is a report and
  // reads like one.
  if (/^<[a-z][a-z-]{2,30}[\s>]/.test(s)) return 'a report the harness wrote, not typed';
  return '';
}

/** Every string of some length inside the tool calls of one reply.
 *
 *  A reply can offer replies — buttons, choices — and a person who picks one
 *  sends the assistant's words as their message. Those words are the
 *  assistant's, so a message identical to one of them is a choice, not a
 *  sentence of theirs. */
function offeredIn(content, into) {
  if (!Array.isArray(content)) return;
  const walk = (v) => {
    if (typeof v === 'string') { if (v.trim().length >= SHORTEST * 2) into.add(v.trim()); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const b of content) if (b && b.type === 'tool_use') walk(b.input);
}

/** What one tool call wrote into a file, as the call itself carries it: the
 *  text it replaced and the text it put there, or the whole of what it wrote.
 *  Null for a call that writes nothing. */
function editsOf(call) {
  const name = String((call && call.name) || '');
  const a = (call && call.input && typeof call.input === 'object') ? call.input : {};
  const file = a.file_path || a.notebook_path;
  if (typeof file !== 'string') return null;
  if (name === 'Edit') return [{ file, before: String(a.old_string || ''), after: String(a.new_string || '') }];
  if (name === 'MultiEdit') return (Array.isArray(a.edits) ? a.edits : []).map((e) => ({ file, before: String((e && e.old_string) || ''), after: String((e && e.new_string) || '') }));
  if (name === 'Write') return [{ file, before: null, after: String(a.content || '') }];
  if (name === 'NotebookEdit') return [{ file, before: null, after: String(a.new_source || '') }];
  return null;
}

/** A commit one call made, as the call carries it: the first line of its
 *  message, and the folders it may have been run in — the one the record says
 *  the assistant was in, and any the command moved to first. What it changed
 *  is in the repository, found again by that line and when it was made. */
function commitOf(call, cwd, at) {
  const a = (call && call.input && typeof call.input === 'object') ? call.input : {};
  const cmd = typeof a.command === 'string' ? a.command : '';
  if (!/\bgit\b[^\n]*\bcommit\b/.test(cmd)) return null;
  const m = /-m\s+(?:"([^"\n]*)|'([^'\n]*)|"?\$\(cat <<'?EOF'?\n([^\n]*))/.exec(cmd);
  const subject = m ? String(m[1] || m[2] || m[3] || '').trim() : '';
  if (!subject) return null;
  const dirs = [...cmd.matchAll(/(?:\bcd\s+|\bgit\s+-C\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/g)].map((x) => x[1].replace(/^["']|["']$/g, ''));
  // The files the command itself put into the commit. A repository shared
  // with other work can hold what someone else staged, and a commit takes it
  // along; what the assistant added by name is what it meant to commit.
  const adds = [...cmd.matchAll(/\bgit\s+(?:-C\s+\S+\s+)?add\s+([^;&|\n]*)/g)]
    .flatMap((x) => x[1].split(/\s+/)).map((w) => w.replace(/^["']|["']$/g, ''))
    .filter((w) => w && !w.startsWith('-') && !/^\d?>/.test(w) && !/^&\d$/.test(w));
  // A commit made through an index of its own, read fresh from the last
  // commit, holds nothing anybody else staged.
  const privateIndex = /\bGIT_INDEX_FILE=/.test(cmd) && /\bread-tree\b/.test(cmd);
  return { subject, dirs: [...new Set([...dirs, cwd].filter(Boolean))], adds, at, call: call.id, ...(privateIndex ? { privateIndex } : null) };
}

/** Everything a record holds about one call's edits being refused: a call
 *  whose answer is an error wrote nothing. */
const refusedIn = (content, into) => {
  for (const b of Array.isArray(content) ? content : []) if (b && b.type === 'tool_result' && b.is_error) into.add(b.tool_use_id);
};

/** The edits made in one record, each with the id of the call that made it,
 *  and the ids of the helpers it started. A helper's record is kept beside
 *  its parent's, and says which call started it. */
function editsIn(file) {
  const edits = [];
  const commits = [];
  const commands = [];
  const refused = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const msg = o.message;
    if (!msg || typeof msg !== 'object' || !Array.isArray(msg.content)) continue;
    if (o.type === 'user') { refusedIn(msg.content, refused); continue; }
    if (o.type !== 'assistant') continue;
    for (const b of msg.content) {
      if (!b || b.type !== 'tool_use') continue;
      for (const e of editsOf(b) || []) edits.push({ ...e, call: b.id });
      const c = commitOf(b, o.cwd, o.timestamp);
      if (c) commits.push(c);
      if (b.input && typeof b.input.command === 'string') commands.push(b.input.command);
      if (b.input && typeof b.input.file_path === 'string') commands.push(b.input.file_path);
    }
  }
  return { edits: edits.filter((e) => !refused.has(e.call)), commits: commits.filter((c) => !refused.has(c.call)), commands };
}

/** One agent session file, in the JSON-lines shape Claude Code writes.
 *
 *  With `work`, each turn also carries everything the assistant said back to
 *  that message, whole, and every edit written into a file while answering
 *  it — by the assistant itself or by a helper it started then. A reading of
 *  what was built without being said needs both whole; the turns a reading
 *  of their words is taken from carry neither. */
export function turnsFromClaudeCode(file, { work = false } = {}) {
  const out = [];
  let pending = null;
  // Which turn each tool call was made in, and which calls were refused.
  const callTurn = new Map();
  const refused = new Set();
  // What the replies since their last message offered to be sent back.
  let offered = new Set();
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    // A tool's output is most of a record by size and none of it is anybody's
    // words. Passed over before it is parsed, it stops costing the minute that
    // listing a large machine otherwise takes.
    if (!work && line.includes('"type":"tool_result"') && line.includes('"type":"user"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.isSidechain) continue;               // a subagent's conversation, not theirs
    const msg = o.message;
    if (!msg || typeof msg !== 'object') continue;
    if (o.type === 'assistant') offeredIn(msg.content, offered);
    if (o.type === 'user') {
      if (isToolResult(msg.content)) { if (work) refusedIn(msg.content, refused); continue; } // the harness answering a tool call
      const body = typedPart(text(msg.content));
      if (!body.trim() || body.trim().length < SHORTEST) continue;
      const picked = offered.has(body.trim());
      offered = new Set();
      flush();
      // The record itself can say a line was put there by the harness — a
      // loaded skill's text, a note about the session — rather than typed.
      const why = (o.isMeta ? 'inserted by the harness, not typed' : '')
        || notInputReason(body)
        || (picked ? "a choice the assistant offered, sent in the assistant's words" : '');
      pending = {
        quote: body,
        at: String(o.timestamp || ''),
        back: '',
        tools: [],
        source: path.basename(file),
        ...(why ? { notInput: why } : null),
      };
    } else if (o.type === 'assistant' && pending) {
      const body = text(msg.content).trim();
      const tools = toolsIn(msg.content);
      if (tools.length) pending.tools = [...new Set([...pending.tools, ...tools])];
      took(pending, body, callsIn(msg.content));
      if (work) {
        if (o.cwd && !pending.cwd) pending.cwd = o.cwd;
        if (body) pending.said = pending.said ? `${pending.said}\n${body}` : body;
        for (const b of Array.isArray(msg.content) ? msg.content : []) {
          if (!b || b.type !== 'tool_use') continue;
          callTurn.set(b.id, pending);
          for (const e of editsOf(b) || []) (pending.edits = pending.edits || []).push({ ...e, call: b.id });
          const c = commitOf(b, o.cwd, o.timestamp);
          if (c) (pending.commits = pending.commits || []).push(c);
          if (b.input && typeof b.input.command === 'string') (pending.commands = pending.commands || []).push(b.input.command);
          if (b.input && typeof b.input.file_path === 'string') (pending.commands = pending.commands || []).push(b.input.file_path);
        }
      }
    }
  }
  flush();
  if (!work) return out;
  for (const t of out) {
    if (t.edits) t.edits = t.edits.filter((e) => !refused.has(e.call));
    if (t.commits) t.commits = t.commits.filter((c) => !refused.has(c.call));
  }
  // A helper's edits go with the turn whose call started it, however long it
  // ran; a helper it started in turn goes with the same turn.
  const dir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
  let helpers = [];
  try {
    helpers = fs.readdirSync(dir).filter((n) => n.endsWith('.meta.json')).map((n) => {
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch { /* unreadable */ }
      return { meta, file: path.join(dir, n.replace(/\.meta\.json$/, '.jsonl')) };
    }).sort((a, b) => (Number(a.meta.spawnDepth) || 0) - (Number(b.meta.spawnDepth) || 0));
  } catch { helpers = []; }
  for (const h of helpers) {
    const t = callTurn.get(h.meta.toolUseId);
    if (!t || !fs.existsSync(h.file)) continue;
    let got = { edits: [], commits: [] };
    try { got = editsIn(h.file); } catch { /* unreadable */ }
    for (const e of got.edits) (t.edits = t.edits || []).push({ ...e, helper: true });
    for (const c of got.commits) (t.commits = t.commits || []).push({ ...c, helper: true });
    if (got.commands.length) t.commands = [...(t.commands || []), ...got.commands];
    try {
      for (const line of fs.readFileSync(h.file, 'utf8').split('\n')) {
        if (!line.includes('"tool_use"')) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        for (const b of (o.message && Array.isArray(o.message.content) ? o.message.content : [])) if (b && b.type === 'tool_use') callTurn.set(b.id, t);
      }
    } catch { /* unreadable */ }
  }
  return out;
}

/** A conversation copied out of a chat window and saved as plain text.
 *
 *  Which side is speaking is read off the shape of the paste: a short name at
 *  the start of a line, then a colon. Short is the whole test, and deliberately
 *  not a list of names — anybody who copies a chat gets whatever that window
 *  calls the two sides, in whatever language they were reading it in. */
export function turnsFromPaste(file) {
  const raw = fs.readFileSync(file, 'utf8');
  // The colon is either kind: a chat copied in Chinese, Japanese or Korean
  // marks the sides with the full-width one, and writes straight on after it.
  // The half-width one needs a space after it, or a URL would be a speaker.
  const speaker = /^([^\s:：]{1,20}(?:\s[^\s:：]{1,20}){0,2})(?::\s*$|：\s*$|:\s+(.*)$|：\s*(.+)$)/;
  const lines = raw.split('\n');
  const named = (line) => {
    const m = speaker.exec(line);
    if (!m || /^https?$/i.test(m[1])) return null;
    return { who: m[1].trim(), first: m[2] || m[3] || '' };
  };
  // A side is a name that speaks more than once. "Note: …" inside a reply
  // starts a line the same way and is said once; counted as a speaker, it
  // would cut that reply in two. A paste of a single exchange has every name
  // once, and then every name counts.
  const count = new Map();
  for (const line of lines) {
    const n = named(line);
    if (n) count.set(n.who, (count.get(n.who) || 0) + 1);
  }
  const repeated = [...count.keys()].filter((k) => count.get(k) > 1);
  const sides = new Set(repeated.length >= 2 ? repeated : count.keys());
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const n = named(line);
    if (n && sides.has(n.who)) {
      if (cur) blocks.push(cur);
      cur = { who: n.who, body: n.first ? [n.first] : [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) blocks.push(cur);
  if (blocks.length < 2) return [];
  // The first speaker is taken to be the person: a copied conversation starts
  // where they started it.
  const them = blocks[0].who;
  const out = [];
  let pending = null;
  for (const b of blocks) {
    const body = b.body.join('\n').trim();
    if (!body) continue;
    if (b.who === them) {
      if (pending) out.push(pending);
      pending = { quote: body, at: '', back: '', tools: [], source: path.basename(file) };
    } else if (pending) {
      took(pending, body, []);
    }
  }
  if (pending) out.push(pending);
  return out;
}

// Within one run, a directory is walked once and a file's opening is parsed
// once. Both `status` and `list` ask what is on the machine and then what is
// waiting, and without this every file under every root is opened twice for
// the same answer.
const walked = new Map();
const heads = new Map();

/** Every session file under a directory, newest first: JSON-lines records,
 *  or whole JSON files for a reader that keeps one conversation per file. */
export function sessionFiles(dir, ext = '.jsonl') {
  const key = `${ext}\0${dir}`;
  if (walked.has(key)) return walked.get(key);
  const out = walkFor(dir, ext);
  walked.set(key, out);
  return out;
}

function walkFor(dir, ext) {
  const found = [];
  const walk = (d, depth) => {
    if (depth > 4) return;
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const p = path.join(d, e.name);
      // A record kept behind a link is still a record: the entry for a link
      // says neither file nor directory, so a link is followed to what it
      // points at before it is judged.
      let kind = e;
      if (e.isSymbolicLink()) { try { kind = fs.statSync(p); } catch { continue; } }
      if (kind.isDirectory()) walk(p, depth + 1);
      else if (kind.isFile() && e.name.endsWith(ext)) {
        try { found.push({ path: p, at: fs.statSync(p).mtimeMs }); } catch { /* unreadable */ }
      }
    }
  };
  walk(dir, 0);
  found.sort((a, b) => b.at - a.at);
  return found.map((f) => f.path);
}

/** The first few objects of a record, for deciding whose shape it is.
 *
 *  Only the opening of the file is read: whose record this is shows in its
 *  first lines, and reading a hundred whole files to find out would be the
 *  slowest part of a command that is supposed to cost nothing. */
function head(file) {
  if (heads.has(file)) return heads.get(file);
  const out = headOf(file);
  heads.set(file, out);
  return out;
}

function headOf(file) {
  // Grown until a whole line is in hand rather than fixed: one message of
  // theirs can be longer than any opening this would otherwise read, and a
  // file whose first line is longer than the window comes back with no
  // complete line at all — which reads as "this is nobody's record" about a
  // record that is perfectly readable.
  for (const bytes of [16384, 262144, Infinity]) {
    let buf = '';
    // Whether the whole file is in hand is a count of bytes, not of letters:
    // a record written in a language of wide characters holds fewer letters
    // than bytes, and counting letters reads a long record as a short one.
    let all = true;
    try {
      if (bytes === Infinity) buf = fs.readFileSync(file, 'utf8');
      else {
        const fd = fs.openSync(file, 'r');
        const b = Buffer.alloc(bytes);
        const n = fs.readSync(fd, b, 0, bytes, 0);
        fs.closeSync(fd);
        all = n < bytes;
        buf = b.slice(0, n).toString('utf8');
      }
    } catch { return []; }
    const whole = buf.split('\n');
    // The last piece is a line cut in half unless the read reached the end.
    if (buf.length && !buf.endsWith('\n') && !all) whole.pop();
    const out = [];
    for (const line of whole) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch { /* not a line of ours */ }
    }
    // A record can open with lines of the harness's own bookkeeping — a title,
    // a mode, snapshots of files — and nobody's words for a long way. Whose
    // shape it is shows only in a line somebody said something in, so the
    // window grows until one is in hand.
    if (out.some((o) => o && (o.message || Number.isInteger(o.step_index) || o.payload))) return out;
    if (all) return out;   // the whole file was read
  }
  return [];
}

/** A wall-clock stamp with its offset written beside it, as a harness that
 *  hands the model a human-readable date writes one. Parsed without the offset
 *  it reads as that many hours from the truth, and the listing then sorts and
 *  prints the wrong day. */
function stamped(s) {
  const m = /\(UTC([+-])(\d{1,2})(?::(\d{2}))?\)/.exec(s);
  const base = Date.parse(s.replace(/\s*\(UTC[^)]*\)/, ''));
  if (!Number.isFinite(base)) return '';
  if (!m) return new Date(base).toISOString();
  const mins = ((Number(m[2]) * 60) + Number(m[3] || 0)) * (m[1] === '-' ? -1 : 1);
  return new Date(base - (mins * 60000)).toISOString();
}

/** What a harness wrapped around the person's message, taken off again.
 *
 *  The envelope is the harness's and the text inside it is theirs. Left on,
 *  every message in the record opens with a tag and is read as something the
 *  harness inserted rather than something they typed; taken off, their words
 *  are carried through exactly as they were. */
function unwrap(body) {
  const q = /<user_query>\n?([^]*?)\n?<\/user_query>/.exec(body);
  const t = /<timestamp>([^<]*)<\/timestamp>/.exec(body);
  return { quote: q ? q[1] : body, at: t ? stamped(t[1]) : '' };
}

/** One agent session file, in the JSON-lines shape Cursor writes. */
export function turnsFromCursor(file) {
  const out = [];
  let pending = null;
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  // When no stamp travels with a message, when the file was last written is
  // the only date there is. It is the same for every turn in the file, which
  // is true rather than precise.
  let fallback = '';
  try { fallback = new Date(fs.statSync(file).mtimeMs).toISOString(); } catch { /* unreadable */ }
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const msg = o.message;
    if (!msg || typeof msg !== 'object') continue;
    if (o.role === 'user') {
      if (isToolResult(msg.content)) continue;
      const { quote, at } = unwrap(text(msg.content));
      if (!quote.trim() || quote.trim().length < SHORTEST) continue;
      flush();
      pending = {
        quote,
        at: at || fallback,
        back: '',
        tools: [],
        source: path.basename(file),
        ...(notInputReason(quote) ? { notInput: notInputReason(quote) } : null),
      };
    } else if (o.role === 'assistant' && pending) {
      const body = text(msg.content).trim();
      const tools = toolsIn(msg.content);
      if (tools.length) pending.tools = [...new Set([...pending.tools, ...tools])];
      took(pending, body, callsIn(msg.content));
    }
  }
  flush();
  return out;
}

/** One conversation file, in the JSON-lines shape Antigravity writes.
 *
 *  Each line is a step. What the person typed is a step of their own, wrapped
 *  in a request tag and followed by notes the harness appends — the time, a
 *  setting that changed; only the request is theirs. The agent's replies and
 *  tool calls are steps of their own, and a tool's output is a further step
 *  that is nobody's words. */
export function turnsFromAntigravity(file) {
  const out = [];
  let pending = null;
  let offered = new Set();
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'PLANNER_RESPONSE') {
      offeredIn((o.tool_calls || []).map((c) => ({ type: 'tool_use', input: c && c.args })), offered);
      if (!pending) continue;
      const names = (o.tool_calls || []).map((c) => c && c.name).filter(Boolean);
      if (names.length) pending.tools = [...new Set([...pending.tools, ...names])];
      const body = typeof o.content === 'string' ? o.content.trim() : '';
      took(pending, body, (o.tool_calls || []).map((c) => ({ name: c && c.name, input: c && c.args })));
      continue;
    }
    if (o.type !== 'USER_INPUT' || typeof o.content !== 'string') continue;
    const m = /<USER_REQUEST>\n?([^]*?)\n?<\/USER_REQUEST>/.exec(o.content);
    const body = typedPart(m ? m[1] : o.content);
    if (!body.trim() || body.trim().length < SHORTEST) continue;
    const picked = offered.has(body.trim());
    offered = new Set();
    flush();
    const why = (o.source && o.source !== 'USER_EXPLICIT' ? 'inserted by the harness, not typed' : '')
      || notInputReason(body)
      || (picked ? "a choice the assistant offered, sent in the assistant's words" : '');
    pending = {
      quote: body,
      at: String(o.created_at || ''),
      back: '',
      tools: [],
      source: path.basename(path.dirname(path.dirname(path.dirname(file)))),
      ...(why ? { notInput: why } : null),
    };
  }
  flush();
  return out;
}

/** A shell command as a string, from the shapes a call carries it in: a
 *  string, or an argument list that may run a shell with the command after
 *  its flag. */
function commandOf(v) {
  if (typeof v === 'string') return v;
  if (!Array.isArray(v)) return '';
  const a = v.map(String);
  if (a.length >= 3 && /(^|\/)(ba|z|da)?sh$/.test(a[0]) && /^-l?c$/.test(a[1])) return a.slice(2).join(' ');
  return a.join(' ');
}

/** The edits one patch makes, in the patch format Codex writes: each file it
 *  adds whole, and each hunk of a file it updates, as the lines it replaced and
 *  the lines it put there. A path is taken from the folder the work ran in. */
function patchEdits(patch, cwd) {
  const out = [];
  for (const m of String(patch || '').matchAll(/\*\*\* Begin Patch\n([^]*?)\n?\*\*\* End Patch/g)) out.push(...onePatch(m[1], cwd));
  return out;
}

function onePatch(body, cwd) {
  const out = [];
  const abs = (p) => (path.isAbsolute(p) || !cwd ? p : path.join(cwd, p));
  let file = null;
  let mode = '';
  let before = [];
  let after = [];
  const close = () => {
    if (file && mode === 'add') out.push({ file, before: null, after: after.join('\n') });
    if (file && mode === 'update' && (before.length || after.length)) out.push({ file, before: before.join('\n'), after: after.join('\n') });
    before = [];
    after = [];
  };
  for (const line of body.split('\n')) {
    const head = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (head) { close(); file = abs(head[2].trim()); mode = head[1].toLowerCase(); continue; }
    const moved = /^\*\*\* Move to: (.+)$/.exec(line);
    if (moved) { file = abs(moved[1].trim()); continue; }
    if (line.startsWith('@@')) { if (mode === 'update') close(); continue; }
    if (mode === 'add' && line.startsWith('+')) after.push(line.slice(1));
    else if (mode === 'update') {
      if (line.startsWith('-')) before.push(line.slice(1));
      else if (line.startsWith('+')) after.push(line.slice(1));
      // A blank line of context is written with its space or without it.
      else if (line.startsWith(' ') || line === '') { before.push(line.slice(1)); after.push(line.slice(1)); }
    }
  }
  close();
  return out;
}

/** What the harness puts into the person's side of a Codex record ahead of
 *  anything typed: the environment, the project's instructions, a note about
 *  an interrupted turn. */
const CODEX_INSERTED = /^\s*(<(environment_context|user_instructions|turn_aborted|user_shell_command)>|# AGENTS\.md instructions for )/;

/** One session file, in the JSON-lines shape Codex writes.
 *
 *  Each line is an item. What the person typed is a user message, and in the
 *  newer shape also an event of its own that carries only what was typed; the
 *  replies are assistant messages; the tools are function and custom calls,
 *  each answered by an output item. The older shape writes the items bare,
 *  without the wrapper. */
export function turnsFromCodex(file, { work = false } = {}) {
  const items = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o && o.payload && typeof o.type === 'string') items.push({ kind: o.type, p: o.payload, at: String(o.timestamp || '') });
    else if (o && typeof o.type === 'string') items.push({ kind: 'response_item', p: o, at: String(o.timestamp || '') });
    // The older shape stamps the session once, on its first line, and none of
    // the items after it: that stamp is the only date there is for them.
    else if (o && o.id && typeof o.timestamp === 'string' && !items.length) items.push({ kind: 'session_meta', p: o, at: o.timestamp });
  }
  let stamp = '';
  for (const i of items) { if (i.at) stamp = i.at; else i.at = stamp; }
  // Where the record keeps what was typed as an event of its own, that is
  // what was typed; the user messages beside it also carry what the harness
  // added, and would count every message twice.
  const typedEvents = items.some((i) => i.kind === 'event_msg' && i.p.type === 'user_message');
  const failed = new Set();
  const patching = new Set(items.filter((i) => i.kind === 'response_item' && /^(function_call|custom_tool_call|local_shell_call)$/.test(String(i.p.type))
    && /Begin Patch/.test(JSON.stringify([i.p.input, i.p.arguments, i.p.action]))).map((i) => i.p.call_id));
  for (const i of items) {
    if (i.kind !== 'response_item' || !/_output$/.test(String(i.p.type))) continue;
    let out = i.p.output;
    if (typeof out === 'string') { try { out = JSON.parse(out); } catch { /* plain text */ } }
    const said = typeof out === 'string' ? out : String((out && (out.output || out.content)) || '');
    const exit = /^\s*(?:Exit code:|Process exited with code)\s*(\d+)/m.exec(said);
    const code = out && typeof out === 'object' && out.metadata ? out.metadata.exit_code : (exit ? Number(exit[1]) : undefined);
    // A patch reports what it did; one whose report says it failed did not
    // write. Only a patch is read this way: a command's own output can say
    // anything.
    const patchFailed = patching.has(i.p.call_id) && /apply_patch verification failed|^\s*(error|failed)\b/i.test(said);
    if ((out && typeof out === 'object' && out.success === false) || (Number.isInteger(code) && code !== 0) || patchFailed) failed.add(i.p.call_id);
  }
  const out = [];
  let pending = null;
  let cwd = '';
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  for (const i of items) {
    const p = i.p;
    if (i.kind === 'session_meta' || i.kind === 'turn_context') { if (typeof p.cwd === 'string') cwd = p.cwd; continue; }
    let typed = null;
    if (typedEvents && i.kind === 'event_msg' && p.type === 'user_message') typed = String(p.message || '');
    if (i.kind === 'response_item' && p.type === 'message' && p.role === 'user' && !cwd) {
      const where = /<cwd>([^<\n]+)<\/cwd>/.exec((Array.isArray(p.content) ? p.content : []).map((c) => (c && c.text) || '').join('\n'));
      if (where) cwd = where[1].trim();
    }
    if (!typedEvents && i.kind === 'response_item' && p.type === 'message' && p.role === 'user') {
      typed = (Array.isArray(p.content) ? p.content : []).filter((c) => c && typeof c.text === 'string').map((c) => c.text).join('\n');
    }
    if (typed !== null) {
      // The older shape names the folder only inside the context it sends.
      const where = /<cwd>([^<\n]+)<\/cwd>/.exec(typed);
      if (where && !cwd) cwd = where[1].trim();
      const body = typedPart(typed);
      if (!body.trim() || body.trim().length < SHORTEST) continue;
      flush();
      const why = (CODEX_INSERTED.test(body) ? 'inserted by the harness, not typed' : '') || notInputReason(body);
      pending = { quote: body, at: i.at, back: '', tools: [], source: path.basename(file), ...(why ? { notInput: why } : null) };
      continue;
    }
    if (!pending || i.kind !== 'response_item') continue;
    if (p.type === 'message' && p.role === 'assistant') {
      const body = (Array.isArray(p.content) ? p.content : []).filter((c) => c && typeof c.text === 'string').map((c) => c.text).join('\n').trim();
      took(pending, body, []);
      if (work && body) pending.said = pending.said ? `${pending.said}\n${body}` : body;
      continue;
    }
    if (!/^(function_call|custom_tool_call|local_shell_call)$/.test(String(p.type))) continue;
    let args = p.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { /* left as text */ } }
    const name = String(p.name || (p.type === 'local_shell_call' ? 'shell' : ''));
    const command = commandOf((args && (args.command || args.cmd)) || (p.action && p.action.command));
    const patch = typeof p.input === 'string' ? p.input : (typeof args === 'string' ? args : command);
    if (name) pending.tools = [...new Set([...pending.tools, name])];
    const here = (args && typeof args === 'object' && typeof args.workdir === 'string' && args.workdir) || cwd;
    const edits = failed.has(p.call_id) ? [] : patchEdits(patch, here);
    const calls = [...edits.map((e) => ({ name: 'Edit', input: { file_path: e.file } })), ...(command ? [{ name: 'Bash', input: { command } }] : [])];
    took(pending, '', calls);
    if (!work || failed.has(p.call_id)) continue;
    if (cwd && !pending.cwd) pending.cwd = cwd;
    for (const e of edits) (pending.edits = pending.edits || []).push({ ...e, call: p.call_id });
    if (command) {
      const c = commitOf({ input: { command }, id: p.call_id }, here, i.at);
      if (c) (pending.commits = pending.commits || []).push(c);
      (pending.commands = pending.commands || []).push(command);
    }
    for (const e of edits) (pending.commands = pending.commands || []).push(e.file);
  }
  flush();
  return out;
}

/** The text of one Gemini CLI message, from the shapes it is kept in: a
 *  string, a part, or a list of parts. */
const geminiText = (c) => {
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(geminiText).filter(Boolean).join('\n');
  if (c && typeof c === 'object' && typeof c.text === 'string') return c.text;
  return '';
};

/** One whole conversation file, as Gemini CLI keeps it. */
function geminiRecord(file) {
  try {
    const o = JSON.parse(fs.readFileSync(file, 'utf8'));
    return o && Array.isArray(o.messages) ? o : null;
  } catch { return null; }
}

/** One conversation, in the JSON shape Gemini CLI writes: a single object
 *  whose messages are the person's, the model's — each with the tool calls it
 *  made, their arguments and how they ended — and the harness's own notices. */
export function turnsFromGemini(file, { work = false } = {}) {
  const rec = geminiRecord(file);
  if (!rec) return [];
  // The folder the conversations of a project are kept under can name the
  // project's own folder in a file of its own.
  let cwd = '';
  try { cwd = fs.readFileSync(path.join(path.dirname(path.dirname(file)), '.project_root'), 'utf8').trim(); } catch { cwd = ''; }
  const out = [];
  let pending = null;
  const flush = () => { if (pending) { out.push(pending); pending = null; } };
  for (const m of rec.messages) {
    if (!m || typeof m !== 'object') continue;
    if (m.type === 'user') {
      // Files named with @ are added to the message after what was typed;
      // they are file contents, not words of theirs.
      const body = typedPart(geminiText(m.content).split('--- Content from referenced files ---')[0]);
      if (!body.trim() || body.trim().length < SHORTEST) continue;
      flush();
      const why = notInputReason(body);
      pending = { quote: body, at: String(m.timestamp || ''), back: '', tools: [], source: path.basename(file), ...(why ? { notInput: why } : null) };
      continue;
    }
    if (m.type !== 'gemini' || !pending) continue;
    const body = geminiText(m.content).trim();
    const calls = [];
    const edits = [];
    const commands = [];
    for (const c of Array.isArray(m.toolCalls) ? m.toolCalls : []) {
      if (!c || typeof c !== 'object') continue;
      const name = String(c.name || '');
      if (name) pending.tools = [...new Set([...pending.tools, name])];
      // Only a call that finished did anything; one cut off, refused or still
      // waiting wrote nothing.
      if (String(c.status || '') !== 'success') continue;
      const a = c.args && typeof c.args === 'object' ? c.args : {};
      const f = typeof a.file_path === 'string' ? a.file_path : (typeof a.absolute_path === 'string' ? a.absolute_path : '');
      if (f && /^(replace|edit)$/.test(name) && (typeof a.old_string === 'string' || typeof a.new_string === 'string')) {
        edits.push({ file: f, before: String(a.old_string || ''), after: String(a.new_string || ''), call: c.id });
        calls.push({ name: 'Edit', input: { file_path: f } });
      } else if (f && name === 'write_file') {
        edits.push({ file: f, before: null, after: String(a.content || ''), call: c.id });
        calls.push({ name: 'Write', input: { file_path: f } });
      } else if (typeof a.command === 'string' && /shell/.test(name)) {
        commands.push({ command: a.command, dir: typeof a.directory === 'string' ? a.directory : '', id: c.id });
        calls.push({ name: 'Bash', input: { command: a.command } });
      }
    }
    took(pending, body, calls);
    if (!work) continue;
    if (cwd && !pending.cwd) pending.cwd = cwd;
    if (body) pending.said = pending.said ? `${pending.said}\n${body}` : body;
    for (const e of edits) {
      (pending.edits = pending.edits || []).push(e);
      (pending.commands = pending.commands || []).push(e.file);
    }
    for (const c of commands) {
      const dir = c.dir && cwd && !path.isAbsolute(c.dir) ? path.join(cwd, c.dir) : (c.dir || cwd);
      const done = commitOf({ input: { command: c.command }, id: c.id }, dir, String(m.timestamp || ''));
      if (done) (pending.commits = pending.commits || []).push(done);
      (pending.commands = pending.commands || []).push(c.command);
    }
  }
  flush();
  return out;
}

/**
 * The records this knows how to read.
 *
 * One entry per shape, not per product: a record is claimed by what its lines
 * look like rather than by where it was found or what wrote it, so a directory
 * holding two kinds is read correctly and a record nobody here has seen is
 * passed over rather than mangled. Adding another agent is adding one entry.
 */
export const READERS = [
  {
    name: 'Claude Code',
    where: '~/.claude/projects',
    roots: () => [path.join(os.homedir(), '.claude', 'projects')],
    project: (file) => path.basename(path.dirname(file)),
    claims: (objs) => objs.some((o) => o && (o.type === 'user' || o.type === 'assistant') && o.message),
    turns: turnsFromClaudeCode,
    work: (file) => turnsFromClaudeCode(file, { work: true }),
  },
  {
    name: 'Cursor',
    where: '~/.cursor/projects',
    roots: () => [path.join(os.homedir(), '.cursor', 'projects')],
    // .../projects/<project>/agent-transcripts/<id>/<id>.jsonl — the session's
    // own folder is named after the session, so the project is the folder the
    // transcripts live under.
    project: (file) => {
      const parts = file.split(path.sep);
      const i = parts.lastIndexOf('agent-transcripts');
      return i > 0 ? parts[i - 1] : path.basename(path.dirname(file));
    },
    claims: (objs) => objs.some((o) => o && (o.role === 'user' || o.role === 'assistant') && o.message),
    turns: turnsFromCursor,
  },
  {
    name: 'Antigravity',
    where: '~/.gemini/antigravity*/brain',
    roots: () => ['antigravity-cli', 'antigravity', 'antigravity-ide']
      .map((d) => path.join(os.homedir(), '.gemini', d, 'brain')),
    // .../brain/<conversation>/.system_generated/logs/transcript_full.jsonl.
    // The same folder holds a shorter transcript that leaves some of the
    // person's messages out; only the full one is read.
    accepts: (file) => path.basename(file) === 'transcript_full.jsonl',
    project: () => 'Antigravity',
    claims: (objs) => objs.some((o) => o && Number.isInteger(o.step_index) && (o.type === 'USER_INPUT' || o.type === 'PLANNER_RESPONSE')),
    turns: turnsFromAntigravity,
  },
  {
    name: 'Codex',
    where: '~/.codex/sessions',
    roots: () => [path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions')],
    // .../sessions/<year>/<month>/<day>/rollout-<time>-<id>.jsonl
    accepts: (file) => /^rollout-.*\.jsonl$/.test(path.basename(file)),
    project: (file) => {
      const meta = head(file).map((o) => (o && o.payload) || o).find((p) => p && typeof p.cwd === 'string');
      return meta ? meta.cwd.replace(/[\\/]+/g, '-') : 'Codex';
    },
    claims: (objs) => objs.some((o) => o && ((o.type === 'session_meta' && o.payload) || (o.type === 'response_item' && o.payload)
      || (o.type === 'message' && /^(user|assistant)$/.test(String(o.role)) && Array.isArray(o.content) && o.content.some((c) => c && /^(input|output)_text$/.test(String(c.type)))))),
    turns: turnsFromCodex,
    work: (file) => turnsFromCodex(file, { work: true }),
  },
  {
    name: 'Gemini CLI',
    where: '~/.gemini/tmp/<project>/chats',
    roots: () => [path.join(os.homedir(), '.gemini', 'tmp')],
    // .../tmp/<project>/chats/session-<time>-<id>.json, one conversation whole
    // to a file.
    ext: '.json',
    peek: (file) => { const r = geminiRecord(file); return r ? [r] : []; },
    accepts: (file) => path.basename(path.dirname(file)) === 'chats',
    project: (file) => path.basename(path.dirname(path.dirname(file))),
    claims: (objs) => objs.some((o) => o && Array.isArray(o.messages) && o.messages.some((m) => m && (m.type === 'user' || m.type === 'gemini'))),
    turns: turnsFromGemini,
    work: (file) => turnsFromGemini(file, { work: true }),
  },
];

/** The opening of a record, as the reader of that kind looks at it. */
const peekOf = (r, file) => (r.peek ? r.peek(file) : head(file));

/** Which kinds of record are on this machine, and how many of each.
 *
 *  Said out loud by `status` and `list`, because "nothing to read" and "your
 *  agent keeps its record somewhere this cannot read" are different facts and
 *  only one of them is worth doing something about. */
export function sources() {
  return READERS.map((r) => {
    const dirs = r.roots().filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
    let files = 0;
    for (const d of dirs) for (const f of sessionFiles(d, r.ext)) if ((!r.accepts || r.accepts(f)) && r.claims(peekOf(r, f))) files += 1;
    return { name: r.name, where: r.where, present: dirs.length > 0, files };
  });
}

/** Every record on this machine that something here can read. */
export function discover() {
  const out = [];
  const seen = new Set();
  for (const r of READERS) {
    for (const root of r.roots()) {
      let ok = false;
      try { ok = fs.statSync(root).isDirectory(); } catch { ok = false; }
      if (!ok) continue;
      for (const file of sessionFiles(root, r.ext)) {
        if (seen.has(file)) continue;
        if (r.accepts && !r.accepts(file)) continue;
        if (!r.claims(peekOf(r, file))) continue;
        seen.add(file);
        let at = 0;
        let size = 0;
        try { const st = fs.statSync(file); at = st.mtimeMs; size = st.size; } catch { /* unreadable */ }
        out.push({ file, reader: r, from: r.name, project: r.project(file), at, size });
      }
    }
  }
  out.sort((a, b) => b.at - a.at);
  return out;
}

/** Read a file whatever shape it is in.
 *
 *  A file named on the command line is claimed the same way one found on the
 *  machine is — by what its lines look like — so a record copied out of its
 *  usual place still reads, and one nobody here recognises falls through to
 *  the plain-text reader rather than coming back empty with no reason. */
export function turnsFrom(file) {
  const r = readerOf(file);
  return r ? r.turns(file) : turnsFromPaste(file);
}

/** Which reader claims a file, by its shape: the JSON-lines readers for a
 *  JSON-lines record, the whole-file readers for a JSON file. */
function readerOf(file) {
  const ext = file.endsWith('.jsonl') ? '.jsonl' : file.endsWith('.json') ? '.json' : '';
  if (!ext) return null;
  return READERS.find((x) => (x.ext || '.jsonl') === ext && x.claims(peekOf(x, file))) || null;
}

/** The same turns, each with the whole of what was said back and what was
 *  written into files while answering it — or null for a record whose shape
 *  does not keep what was written. */
export function workFrom(file) {
  const r = readerOf(file);
  return r && r.work ? r.work(file) : null;
}
