---
name: vibe-coding-blindspot-checker
description: "Find the blind spots in a vibe coding session: what a coding agent (today Claude Code, Cursor, Codex, Gemini CLI, Antigravity, or any agent's plain-text transcript) decided on its own that the person never decided and was never shown, still in the work now, with where it is. Tasks where their words were weakest on The Command Scale v1.0 come first; a second list holds what it showed them and they never answered, the gravest first if it is not what they meant. Each is theirs to decide on the spot. The session is also rated on the scale, adding up across audits. Use when a coding session has ended and someone wants it checked, asks what the agent decided without them, wants to review what an agent built, or asks where they stand on the scale. Reading costs model calls for each task. The program needs no key and opens no connection; the record is read by the assistant already in use, so what it reads goes to that assistant's model provider under the terms already in place."
---

# Auditing an AI coding session with The Command Scale

After a session with an AI coding assistant, this finds what the assistant
settled on its own — what the person's words never settled — and never showed
them, in a reply or in a document, and, on a list of its own, what it showed
them and they never answered, the gravest first by what would follow if it is
not what they meant — so they can check
each against what they meant and settle it themselves there and then. Which come first is read off The Command
Scale: where their words in a task were weakest, the assistant settled the
most. Weakest is first where their words spoke in the fewest of the four
situations of the task, and then where they reached the lowest height on
average; the fewer situations weighs more than the lower height. Every audit also rates the session on the scale, and the ratings add up
across audits; that is what comes with it, not what it is for.

**Which of their conversations get audited is theirs to say, and the report is
handed to them rather than described.** Everything else here follows from those
two; the program prints both again at the moment each applies.

You are the instrument's reader. A program prepares what you read, checks what
you claim, and does the counting; you do the one thing code cannot, which is
decide where a message sits. Nothing here calls a model — you are the model.
The program opens no connection, needs no key and adds no service; what you
read goes to your model provider as the rest of this conversation does, under
the terms already in place, and the program sends nothing anywhere else.

**Read `spec/the-command-scale-v1.0.md` before your first reading.** §4, §5 and
§9, together with Appendix B, are the normative text, and Appendix A is
normative for the fourth situation — `prompts/knowing.md` and `prompts/depth.md`
are its implementation. The prompts below are the
instrument, and they are written to be applied exactly as given.

## What the person sees

A reading is taken for somebody. Three things are owed to them, and none of
them is the program's to say.

**Before anything is read, say what will be read and stop.** `list` gives you,
for each conversation, when it ran, how many things they said in it, what they
said first and what they said last, and what reading it would cost; it also
offers whole slices with the cost of each. Put those in front of them and stop
there. Reading costs model calls for every task and cannot be undone once spent; a
selection they never saw is a selection they cannot correct, and correcting it
afterwards means paying twice.

Describe each conversation from those two ends and nothing else, and say that
is what you are doing. You have not read them; a summary written as though you
had is a claim about a conversation from sixty characters of it.

**Unless they have already said WHICH, in which case read.** Naming a
conversation, a date, a stretch of time, a source, or what the reading is to be
about is the choice the stop exists for, and stopping again asks them to make
it twice: say in one line what you are about to read and its cost, and go.

**How many is not which.** "Read a few", "read three", "find some conversations
and read them" all leave the choosing to you, and choosing for somebody is the
one thing this stop is there to prevent — a reading over conversations they did
not pick is a fact about your picking. Asking you to find conversations is
asking you to show them what you found. Put the list up, say what each would
cost, and let them say which.

**After each task, say one line to them**: what they were doing in that task,
and the heights it reached. The program prints this line. Pass it on as it
comes rather than saving it up — a run that says nothing until the end is
indistinguishable, from outside, from a program helping itself to the machine,
and a run stopped part way then hands over nothing at all.

**Give it in their language.** Before the first reading, tell the program the
language they speak: `node scripts/cs.mjs lang <code>` (for instance `zh-Hans`,
`ja`, `en`). For anything but English, `lang` hands you, once, the words of the
card and the page with the standards' definitions, to write back in that
language, and `next` asks again while they are unwritten; the program then fills in the numbers and their own words.

**When every task is read, list the decisions, then hand over the audit
report, then stop.** `rating` prints the report, and it goes to them in one
reply, in their language, their own words as they are. It opens with how
many things the assistant settled on its own, how many of them it showed them,
how many are left, and how many of those it showed them they never answered
(all of them, not only the ten the report shows), and has four parts:

- the TCS rating for this session — for each situation, the average height
  their words reached in this session; beside it, the same average over every
  session audited before, and whether this one is up or down from it. It is a
  rating of this session, never of the person; say so if they ask what it
  means about them.
- what they may not know, described below: what the assistant settled on its
  own and never showed them, grouped by task, the weakest task first, each
  task with how its words stood — in how many of the four situations they
  spoke, and the average height — numbered from 1 within each task, each put
  as the question it settled, with where it shows up, what the assistant
  settled, and where it is in the work — the file and lines, as the program
  finds them in the file now; for what it built in, also the words a reply or a
  document said nearest to it.
- what it showed them and they never answered, described below: a list of its
  own, the gravest first, under a heading for each band, numbered from 1
  through the whole list, each given the same way, with the task it is from,
  what would follow if it is not what they meant, and that they never
  answered it.
- what they can type next: the last lines, as on every page (below).

Then stop. What to do next is theirs to say, by typing one of the words on the
last lines.

## Pages

An audit moves between pages the way a site does, and every reply ends with the
three lines that say where they are: **You are on** (the page), **On this page**
(what can be done only here) and **Any time** (the same five pages, in the same
order, everywhere). The program prints them at the end of each page; translate
each line once into their language, use that same translation wherever it
appears, and end each reply with the lines its own page printed, so the words
they read are the words they type. They type a word
as it stands, in this conversation, with nothing added; in a new conversation
they name this skill first. Take the words in their language or in English
alike.

| they type | you run | page |
| --- | --- | --- |
| Back to the report | `node scripts/cs.mjs rating` | Audit report |
| Overall rating | `node scripts/cs.mjs status` | Overall rating — the level held in each situation over every session audited |
| All decisions | `node scripts/cs.mjs unseen --all` | All decisions |
| Lowest lines | `node scripts/cs.mjs lowest` | Lowest lines — the lines of theirs in this session that settled least |
| Audit another session | `node scripts/cs.mjs list`, then on "Audit session N", `import --take N` and `next` | Audit another session, then that session's report |
| Decide task N item M | `node scripts/cs.mjs fix N.M` | Decide |
| Decide shown N | `node scripts/cs.mjs fix sN` | Decide |
| Read this audit again | `node scripts/cs.mjs unseen --again`, then the briefs it prints, then `unseen --all` | All decisions |
| Trace line N | `node scripts/cs.mjs probe N` | Trace |
| Decide line N point M | the point as `probe` printed it | Decide |

**Deciding is theirs; making it so is ordinary work in this conversation.**
`fix` prints a thing the assistant settled and where it is in the work. It is
listed because their words did not settle it, so on this page they settle it,
not you: settling it again yourself only puts one more such thing in the work.
Ask what it should be, part by part as it was settled — the value, the rule,
the case it covers and the case it leaves out, what happens when it fails, as
far as it has them — and stop. Where an answer leaves a part open, or hands it
back to you, ask again for that part; do not fill it in. Where they will not
settle a part, it stays as it is: they can say it later, or "Leave it".
Anything somebody using the result would meet is theirs to say; how the code is
arranged to do it is yours. When every part is theirs or left as it is, say
exactly what will change, from what to what, and stop: "Apply" makes that
change and nothing else, and "Leave it" changes nothing. Where making it so
turns up something somebody using the result would meet that they have not
settled, stop and ask for it before going on. After "Apply", say anything
somebody using the result would meet that you settled anyway, and each part
left as it is, each as a thing they did not decide; then, as after "Leave it",
run the command of the page they came from again. "Explain this part" is for
when they cannot tell whether it is what they meant without knowing how that
part works: open where it is in the work, and what it is used by, as it is now,
and say in a few sentences, in their language, how that part works now and
where this decision sits in it — what they would see or do, not how the code is
written. Say that you wrote it from the code as it is now, and that it costs
reading that part of the work. Then ask again what they want, and stop. While
deciding, run `node scripts/cs.mjs nav fix N.M` (or `nav fix sN` for one
they were shown and never answered, or `nav fix line N.M` for a point from a trace) and end each
reply with the lines it prints.

**Trace the lines they name, then stop again.** `probe 1,3` sets up each
line they named; for each, read what it gives you, apply `prompts/review.md`,
and write the review it names. Each thing the assistant settled is followed
through what they said afterwards — asked to be otherwise, checked, or never come back to —
and then to the work: go to wherever it shows and look at what is there now,
mark it `still`, `changed` or `none`, and give where it is as it is now. A
thing you did not look at is not `still`. `probe` then puts to them only what
is still in the work as it was settled and that they either never came back to,
or asked to be otherwise — what a problem left in the work looks like — at most
five at once, each as a question: is this what you wanted? It says how many
were left out and why; `probe --all` shows the rest when they want them. Give that as it stands,
in their language, and stop: the answers are theirs. Keep each answer with
`answer <line>.<n> yes|no "what they wanted"`; it is what says, in the end,
whether that line got them what they meant.

**The decisions the assistant made on its own.** Once every task is placed,
`unseen` goes through every task in this reading in which the assistant changed
something, and every stretch where it worked and nothing they said was about
the work. Each is read against `prompts/settled.md` by a helper that saw
nothing of the conversation (below), and writes what it names: every decision their words did not settle, written so it
can be recognised without the record — the question it settled, where it shows
up and what was decided — where the assistant first said it, whether it was
put to them first, whether they ever answered it, and, after looking at the
work, what is there now and whether it is still as decided. The program checks
the words cited and keeps what is still there. What a reply said to them, what
they answered, and what was settled in a document of the session itself, they
were shown: the report counts it and does not list it among what they may
not know; what of it they never answered is listed in the second list. It is part of every audit, and the cost
`list` gives counts it: one more reading for each task.

**What it built in without saying it.** The decisions above are read from what
the assistant said and the names of the files it changed, so they hold only
what it said somewhere. `unseen` then goes through every task whose record
keeps what was written into the work's files — each edit made with the editing
tools, by the assistant or a helper it started, and what each commit made in
it put in, as the repository has it — in parts where the task wrote a great
deal. Documents are not judged: what a document the assistant wrote or worked
from states counts as said, and every such document of the session is put in
one file for the reader to search. Each part is read against
`prompts/unsaid.md` by a helper that saw nothing of the conversation, which
searches the documents file it names and writes what it names: what the
changes put into the work that their words did not decide, no reply said and
no document states, each with where it shows up and the lines of the change
that show it. The program finds those lines among what the changes put there or
took away, finds the words said nearest to it in the replies or the documents,
and keeps only what the file still holds now. What was changed by running a command and never committed, what
another session staged into a commit, and what was tried out in the
conversation's own scratch space is not in it. It costs one more reading for
each part.

**The order.** What they may not know is one list, ordered by task: first the
tasks where their words spoke in the fewest of the four situations, then,
among those, the tasks where the heights their situations reached, averaged
over all four, are lowest, then the earlier task. Within a task, what it
decided comes before what it built in. A thing read twice — from what was said
and from what was written, or in two tasks — is listed once: two entries are
one thing where they stand at largely the same lines of the same file (the
lines the program finds, or else the lines the reader named), and two of the
same kind from one task never are, nor more than two at once. The one kept is
the one that comes first in this order. An entry read from what was written
stays even where a decision at the same lines was shown to them, because what
it says is what no reply or document said. Where it is unclear, both stay.

**What it showed them and they never answered.** A second list: what the
assistant settled on its own and said to them in a reply, or wrote in a
document of the session, where nothing they said afterwards was about it. A
bare yes or a choice answers only what the message right before it put to
them to decide, never one line inside a longer report. What they were never
shown is in the first list, and what they answered is in neither list, except
what it built in, which stays in the first list (above).

It is ordered by what would follow if the thing is not what they meant, which
the readers mark on each, in three bands:

1. money, data, access, or something sent out that cannot be called back —
   someone loses money, or is charged or paid what they should not be; data is
   lost or overwritten, or shown to somebody it should not be; someone loses
   access that is theirs, or gains access that is not; or a message, a call
   to a paid service or a post leaves the work. These four are one band, even
   where it could be put right later;
2. something somebody using the result does or relies on would not work as
   they meant, or they would believe something that is not so;
3. only how something looks or reads would change, and nobody would do or
   believe anything differently.

Each is marked by what follows directly, not by what could follow through
some further failure. What a message, call or post says counts with its
going out; what a paid service charges whoever runs the work counts as
money.

Within a band, the weakest task first, by the same rule as the first list. A
reading made before the readers marked the band says only whether a thing was
one of the first four; the rest of it is then in the second band, and its
entry says that the two were not told apart. A thing read twice is listed
once, by the rule the first list uses, and left out where they answered
either.

The report shows the first ten of each; "All decisions" shows both lists
whole, and after them what it showed them and they answered. The lists say
what they may not know and what they were shown and never answered, not what
is wrong;
whether each is what they meant is theirs to say.

**Who reads what it decided and what it built in.** Not you. The assistant that did the
work reads its own record as it meant it: a thing it decided looks agreed, a
thing it thought about looks said. So both are read by helpers. `unseen`
prints every reading left, each with its brief; hand each brief to its own
helper agent that starts with a context of its own — a new one, never a copy of
this conversation — and give it nothing else. They can run side by side. When
they are done, run `unseen` again; an answer that cannot be used is named with
what is wrong, and goes back to a helper to be written again, with that. Where
your tooling cannot start a helper: if you took no part in the conversation
being audited, read each brief yourself, one after another; if you did, say so,
and ask them to run the audit in a new conversation, naming this skill first.

**A page file only when they ask for one.** `page --out <a file in the folder
they have open>` writes the long card as a single offline page. Do not offer a
path on its own: an assistant frequently runs somewhere the person is not, and
a path they cannot open is a reading they were not given. The long card
(`report`) and the lowest lines across every reading so far (`lows`) are there
when they ask for them.

## The order of work

Run the program and do what it says next. It is resumable: a run that stops is
continued, never started again.

```
node scripts/cs.mjs status        # where they stand — costs nothing, asks no model
node scripts/cs.mjs list          # what is waiting, and what reading it would cost
node scripts/cs.mjs import --take 2,5     # read what they named; --since, --project,
                                  # --budget N and --sessions N are the other ways
                                  # they can say it. With none of them it shows the
                                  # list and stops, because there is no default for
                                  # whose conversations get read.
node scripts/cs.mjs lang zh-Hans   # the language they speak; reviews are written in it
node scripts/cs.mjs next          # what to do, one step at a time
```

**Looking costs nothing; only reading new conversations costs anything.**
`status`, `recent`, `why` and `report` are arithmetic over what is already on
disk. Say so when somebody asks how much checking their level costs.

**Never read their whole history unasked.** `list` says how many conversations
are waiting altogether, then shows the newest twenty — `--limit` shows more —
with an estimate beside each of how many readings it would take and a total for
the ones it showed. The estimate comes from how many messages they sent, by a
ratio this implementation guessed and the standard does not fix. `--budget N`
takes conversations newest first, skipping any that would take the total past
the budget, and refuses rather than reading past it. If they have not said how
much to spend, read a few of the newest and say plainly that this is a
placement over a few tasks.

**Offer the slice by what it worked on, by when it happened, or by which source
it came from** — `--work <folder>`, `--since`, `--project`, `--take`, where the
sources are whatever `list` prints. What was left in a piece of work shows up
later and elsewhere: the conversation where it was settled is often not the one
where it was built, and not the one where it went wrong. So offer, first, the
work itself over a stretch of time — `list --work <the folder it lives in>
--since <date>` lists every conversation that touched it — and say what reading
all of them would cost. Numbers they choose are read against the list as it
was shown.
Choosing their best conversations and leaving out the rest makes the reading a
fact about those conversations rather than about them, and `list` says so on
every run.

**Say what this implementation can read.** It looks for the records coding
agents leave on the machine and reads the shapes it knows — today Claude Code's
under `~/.claude/projects`, Cursor's under `~/.cursor/projects`,
Antigravity's under `~/.gemini/antigravity*/brain`, Codex's under
`~/.codex/sessions` and Gemini CLI's under `~/.gemini/tmp/<project>/chats`. A record is
claimed by what its lines look like rather than by where it sits, so one kept
in an unusual place still reads and one nobody here has seen is passed over
rather than mangled. `status` and `list` both print which kinds were looked for
and which are on this machine; pass that on, because "you have nothing to read"
and "your agent keeps its record in a shape this does not know" are different
facts. A conversation kept any other way is read with `--file` once it has been
saved as plain text with each side's turns marked.

`next` tells you which file to read, which rules to apply, and which file to
write. These are the things you write:

**A grouping**, one per conversation. Read the conversation it names, apply
`prompts/grouping.md` exactly, and write the JSON that prompt specifies. Then
`node scripts/cs.mjs group <session>`. The grouping also gives every message
the one situation it is chiefly for; each pass afterwards places a message only
in the situation it was given, and the program takes it out of a placement in
any other. The first pass places the task's opening — the first thing they said
in it, before anything was built — on its own, and reads whether it landed from
the whole task: a later message that says what came back for it is wrong, or must
change, means it did not. Later messages in the opening's situation, and
messages that only accept or choose, are not placed; later reports of what is
wrong, or that progress has stopped, are read together and placed once. The
second pass reads the task's questions together and places them once, as
before.
Read the whole of what it names: a conversation too long to hold at once is
read in parts, never from a summary of it, because a task drawn from a summary
is drawn from what the summary kept.

**Show them how it was split before anything is placed.** `group` ends with a
table — each task, what it is about, their words in it and the situation each
was taken to be for, and which were about running the work rather than the
thing being made. Put it in front of them as it stands (`node scripts/cs.mjs
tasks <session>` prints it again). Everything after it stands on it, and it is
the one step they can check at a glance; a split they would not recognise is
worth hearing about before the readings are spent on it.

**A reading**, twice per task, in two passes that are blind to each other.

The first pass applies `prompts/placing.md` and places the first three
situations. The second applies `prompts/knowing.md` and places the fourth on
its own. Each writes the JSON its own prompt specifies, to its own file, and
each carries its own `elsewhere` — the messages it does not place because they
are chiefly for what the standard the other pass holds measures. A message named in a pass's `elsewhere` is taken
out of that pass's placements, which is what keeps a question from being counted as a
request and a request from being counted as a question.

**Take the second pass without the first answer in view.** Held in one standard
with the other three, the fourth situation's arrival moves them: the same words
and the same model give different levels inside the first three. Two passes over
one input cost one more reading and leave the first three the reading they were.

Not having it in view means not having it in your context, which you cannot
arrange by deciding to ignore it. Where your tooling can start a helper agent
with a context of its own, hand the second pass to one: give it the task file
and `prompts/knowing.md`, and nothing of the first pass. Where it cannot, take
the second pass for every task before the first pass for any of them, so that
no first answer exists yet when a second is written.

`node scripts/cs.mjs place <session> <task>` keeps the first pass;
`node scripts/cs.mjs know <session> <task>` keeps the second. When every task
is read: `node scripts/cs.mjs unseen` until it has gone through every stretch,
then `node scripts/cs.mjs rating`, and stop as it says.

Where the grouping gave messages their situations, a pass over a task with no
message given one of its own and none left unmarked answers with two empty
lists, and a pass names in
`elsewhere` every message of its own situations it does not place. A task
whose messages carry no situations follows what each prompt says for that
case. Either is an answer, not a fault.

**Then the sixth level**, when they ask for it and there are enough tasks: `next --deep` forms batches of
ten closed tasks, oldest first, and asks for each batch to be read against
`prompts/depth.md`. Hand each batch to a fresh helper that has seen nothing of
this reading — not the tasks one by one, not their heights, not the card — and
write what it answers where `next` says. A batch, once formed, keeps its tasks.
Where your tooling cannot start a helper: if you have seen anything of this
reading — its tasks, their heights, the card, the rating — say so, and ask them
to read each batch in a new conversation of its own, naming this skill first
and asking for the sixth level. If you have seen none of it, read the one batch
`next --deep` gives you, write the answer where it says, run `next --deep`
once more to have it taken in, and stop, telling them whether it gave another
batch, which is for another new conversation. Run nothing else there — not
`status`, `report`, `rating`, `why`, `gap` or `lows` — and read nothing but the
files it names, the batch and its rules, and the standard.

## What the program will refuse

Every level above the first must quote the person's own words, and the quote
must be found in one of the messages it is credited to, ignoring case and
spacing. A quote that is not there is thrown out, and the level it claimed goes with it.
This is not a formality: it is the whole defence against crediting somebody
with what the assistant said.

A placement in the `asking` situation with nothing in `becomes` is thrown out
too — a message that asks only to be told something has nothing that situation
measures, and belongs in `elsewhere`.

A message the grouping gave another situation leaves the placement that names
it; a placement left with none of its messages is thrown out. A second
placement in a situation the task is already placed in is thrown out, and the
first stands.

When a quotation is not found in its messages, the program asks once for the
words to be copied again exactly, and shows which. Copy them from the messages;
do not change what you placed. The second answer stands as it comes back.

If the program says your answer came back malformed, write it again before
moving on. Nothing was claimed about that conversation, so nothing about it has
been found out.

## Things you are not asked

While you read, you are never told what level the person is on, you see no
running total, and you are not asked for an opinion about them. The level is a result of the
counts and is never an input to them. Do not read earlier readings before
taking one. A report shows the averages of earlier audits, and the overall
rating shows the levels held; so when they ask to audit another session after
either was in front of you, hand the grouping and both passes for it to
helpers that have seen none of it, as with the second pass below. Where your
tooling cannot, say so, and ask them to audit the next session in a new
conversation, naming this skill first.

Difficulty has no bearing anywhere, nor does how long a message is, nor
anything about the person.

## The four situations

The instrument's field names and the standard's names are the same four things:

| field | standard (B.2) | what it is |
| --- | --- | --- |
| `asking` | Request | says what should become true |
| `reacting` | Review | says what is true of what came back |
| `blocked` | Roadblock | says progress has stopped |
| `knowing` | Question | asks to be told something not yet held |

## What the reading owes them beyond a number

§8 puts three parts in the method and only the third is arranging an occasion.
The second — **naming the single lowest-standing capability at the level they
hold** — is part of the reading, and `node scripts/cs.mjs gap` is where it is
said: their own sentence at the height they reached, what that height closed,
and what the next one closes that it does not. Every sentence in it is either
the standard's, parsed from it, or theirs, quoted from the messages it was
credited to.

**Go back to the lowest lines across every reading, when asked.** `node
scripts/cs.mjs lows` does it. It picks the lowest lines of the reading, at most
three and one per task, taking from each task only what it was placed at in a
situation, with the lines read together for it — among those at the same height, one that did not land
before one that did, the longer before the shorter — and for each it hands you
the whole task the line was in, whether it landed and, if not, what
it cost, and what the next height closes. Write one review per line against
`prompts/review.md`: what they were doing, what happened, what the line left open in the terms of their task, what the assistant
settled on its own that the line left to it — each written so it could be put
to them as a question — and one example of the line one height up.
What `lows` prints is shown to them when they asked for it, and the long card
and the page carry it too. Reviews written through `lows` leave `now` out:
it is filled only when a line is looked into with `probe`. Where the same thing was left open often enough
before, they say it is a habit.

**The example is the only sentence you write for them, and it is labelled.** A
sentence handed over is the assistant's, and this standard says in so many
words that what the assistant said is never theirs. So it appears only where
the program prints it — the long card, a page asked for, and what `lows`
prints —
marked as written by the assistant, and the program remembers every example it
handed over: pasted back into a later conversation, it is not counted as
theirs. Nowhere else — not in conversation, not when asked nicely — write the
better sentence for them.

**Do not arrange their practice.** Choosing a subject for them, setting them an
exercise, scheduling a next occasion, or tracking whether they did it is the
third part of the method and no part of this instrument.

## What this reading cannot say, and must not imply

**L6 Myth is read only across batches.** Ten closed tasks to a batch, three
batches at least that can speak to it (A.5), each read by a fresh helper against
`prompts/depth.md`. Until there are three, the card says how many there are and
how many are needed; it never reads the sixth level from one task.

**Question counts toward a level as the other three do (B.2).** It is read on
a ladder of its own, with names of its own, because what it measures is not
what the other three measure: nothing is being made, so what somebody supplies
is their own thinking rather than the design of a thing. That is why it has its
own five names and no reason to leave it out of a level — a level is held where
every conferring situation holds it, and this is one of the four.

**Under ten occasions at a height with seven met, no level is held there.**
That is the standard's published default (§5.3). This implementation also sets
a sample floor of five, under which no rate is printed at all; five is this
implementation's own value, not the standard's, and §5.3 requires it to be
stated as such. A reading over few tasks is a placement, not a measurement
(§10). Say that plainly if you are asked to summarise the card;
never round it up into a verdict about the person.

**Reading somebody else's record needs their consent first**, and where that
person is a minor, a guardian's informed consent and the minor's knowledge are
required by §9.1 — assessment without the subject's knowledge is not an
implementation of this scale. This program cannot tell whose transcripts it was
pointed at, so the check is yours. `policy/reading-your-record.md` states what
is kept, where, and how to remove it; say so when somebody asks.

**A level can be disputed and the dispute stands.** If the person says a
placement is wrong, it is wrong until evidence of a different kind arrives
(§4, B.4). Show them the words behind it — `node scripts/cs.mjs why Review` —
rather than defending the number.
