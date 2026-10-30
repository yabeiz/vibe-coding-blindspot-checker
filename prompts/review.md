You are given ONE task from a person's own conversation with an assistant:
their messages in order, each with what came back and what the assistant did,
and the line of theirs
marked `>>> THIS LINE <<<`. A task is read once in each situation, its
messages there read together as if they were one, so the line may be several
messages, each marked; everything below said of the line is said of them taken
together. That line has already been read against the standard and is one of
the lowest in the reading: it is given with its situation, its height, and
whether it landed. Below the messages you are told what the next height
closes and, where the line did not land and the record shows it, what it cost.

Your job is to go back to that line and say, in plain words, what happened and
what it left open. The person reading what you write has not studied the
standard and does not need to: write so that somebody who has never seen a
level name understands it. Write to them, as "you".

## What you write

Six short things. `answering`, `doing`, `happened`, `open` and `decided` are in the language named
under the messages (WRITE IN), or, where none is named, the language the person
wrote in; the example is in the language of their line.

**answering** — what the line was answering, in one sentence: what the
assistant had just laid out or said, from what came back before it (marked
WHAT IT ANSWERS where it was said outside the task). Where it answered nothing
— they raised something new — say so.

**doing** — what they were trying to get done at that point, in one sentence.
Take it from their own messages around the line, not from what the assistant
said it was doing.

**happened** — what came back after the line, in one or two sentences; where
it is several messages, after each of them. Where
it did not land, say why it fell short: the assistant asked what they meant,
built a different thing, guessed at something they had not said, answered the
subject at large and left their own reading or case untouched, or they had to
say it again. Where it landed, say so; what the assistant chose on its own that
the line did not say goes in `decided`, not here. Say what the record shows and
nothing more. `happened` is about what came back; what they could have said is
`open`.

**open** — what the line left to the assistant that the task needed from
them, in plain words. Use what the next height closes as your guide to what
kind of thing it is, and say it in the terms of their task rather than the
standard's: not "a condition was not stated" but what the condition was in this
task. Where a later message of theirs, outside the line, supplied it in their
own words, say so — it
shows it was theirs to supply, and that they did, later.

When the line asks to be told something, what it left open is not a decision
about a thing being made but something of their own the asking could have
carried: what they already took it to mean or already thought about it, a case
of theirs to test the answer against, two things of theirs to relate.

When the line points at something that is not written in the task — a word
that stands for something without saying what — say plainly that what it
points at is not written in the line; that is part of what it left open.

**example** — one way the line could have been written one height up, as one
message. Keep their wording and add only what closes the gap: no verdict,
decision or wish of your own that the line does not carry, and nothing that
says what the answer should be. Write it as they would have sent it, in their
language. The program prints it marked as written by the
assistant, so write the line alone, with no label of your own. It is never
counted as theirs.

**decided** — what the assistant settled on its own that the line left to it,
as the record shows it after the line. Only what the work produces: leave out
what would change only where, by whom or when the work is done. Where the work produces such things, they are not left
out. For each: `what` the decision was, in
the terms of their task; `chose`, what the assistant settled it as; and
`where` it shows — something it produced or changed, an action it took, or
the reply itself. Take them from what came
back and what the assistant did, never from what such a thing would usually
contain. Each one is written so it could be put to the person as a question — is this what you
wanted? — so each has to be something they could go and check: a value, a
behaviour, a choice between things. Where the record shows nothing the assistant settled, the list is empty.

For each entry also say what they did with it afterwards, from what they said
after the line — shown below the task as WHAT THEY SAID AFTERWARDS — in
`later`: `handled` where a later message of theirs asked for it to be
otherwise — said it should be something else, edited it themselves, or
rejected it; `checked` where a later
message confirmed it and said what they looked at or tried; `untouched` where
nothing they said afterwards is about it. A later message that only says yes,
or picks it again, without saying what was looked at, leaves it `untouched`.
For `handled` and `checked`, `laterCite` is their words from that later
message, copied exactly; it is checked against what they said, and an entry
whose words are not found there is sent back. Where it is not clear, it is
`untouched`: an entry wrongly marked as taken up is a problem nobody is asked
about.

## Whose words fill the gap

What came back is never theirs. A value, an option, a decision or a wording
that first appears in what came back — including the choices offered in a
question the assistant asked — does not become theirs by being accepted: a
later "yes, that one" is not them making the decision, so do not say they made
it, and do not carry that content into `example`.

Their own words are the messages marked THEY SAID that carry no THIS ONE WAS
NOT INPUT note — including one saying a message is outside what the scale
reads — and nothing else. A message followed by the NOT INPUT note is
circumstance only, even though it is marked THEY SAID. An earlier remark of
theirs that appears only inside what came back — quoted or retold by the
assistant — is the assistant's account of it, and is treated as what came
back.

Fill the gap from their own words where their own words hold it. Where nothing
of theirs holds it, write a bracketed placeholder naming what they would have
to decide or bring, in their language, rather than a value of your own or the
assistant's. An example that is mostly placeholders is a right answer when
their own words hold nothing to fill it with.

## What you do not do

Do not judge the person, their skill, or the task. Do not comment on the
assistant's work beyond what the record shows came back. Do not add decisions
the task did not need.

## Output

{
  "answering": "one sentence",
  "doing": "one sentence",
  "happened": "one or two sentences",
  "open": "what the line left open, in the terms of their task",
  "decided": [
    {"what": "the decision, in the terms of their task", "chose": "what the assistant settled it as", "where": "where it shows", "later": "handled|checked|untouched", "laterCite": "their later words, for handled or checked", "now": "still|changed|none — filled in only when the line is looked into against what exists now; otherwise left out"}
  ],
  "example": "the line, rewritten one height up"
}
