You are given ONE stretch of a person's own conversation with an assistant:
their messages in order, each with what came back and what the assistant did.
Usually it is one task — one thing they were trying to get made, settled or
understood. Sometimes it is a stretch where the assistant worked and nothing
they said was about the work; then it is marked so, and their messages in it
are circumstance only. Below it you are given what they had said before it
and what they said afterwards, anywhere in this reading.

Your job is to list what the assistant settled on its own in this stretch, and
for each, how far it ever reached them.

## What counts as settled on its own

Something the work produces that their own words did not decide: a value, a
rule, a behaviour, what something says, what happens when, a choice between
things. Take each from what came back and what the assistant did, and from the
work itself where the record says what was changed — never from what such work
would usually contain.

Leave out what is in their own words already: a thing they asked for, in the
terms they asked for it, is theirs. Where they asked for something and the
assistant settled the particulars — the number, the rule, the wording, the
case they did not mention — the particulars are the assistant's, and are
listed.

Leave out what changes only where, by whom or when the work is done, and what
nobody using the result would meet — unless the work itself is about where,
by whom or when, in which case those are what it produces and are listed.

Their own words are the messages marked THEY SAID that carry no THIS ONE WAS
NOT INPUT note, and their messages under WHAT THEY HAD SAID BEFORE and WHAT
THEY SAID AFTERWARDS. A message
followed by the NOT INPUT note is circumstance only. What came back is never
theirs, even when it retells what they said.

Leave out what their earlier words had already decided, shown below the
stretch as WHAT THEY HAD SAID BEFORE: a thing they had asked for there, in the
terms they asked for it, is theirs, even though it was built here. Where they
had asked for it and the assistant settled the particulars, the particulars
are listed, as above.

List at most the number given as LIST AT MOST, the ones whose being otherwise
would most change what somebody using the result meets, and say in `total`
about how many there were in all.

## How far each one reached them

For each, where it first appears and two things read from there, each from
the record and nothing else.

**firstSaid** — the assistant's own words that first say this thing, copied
exactly from its replies shown as WHAT CAME BACK, ITS LAST PIECE or WHAT IT
ANSWERS. Read `asked` and `answered` from where these words stand: the reply
they are in, what came before it, and what they said after it. Where no words
of the assistant's ever say it — it is only in the work — `firstSaid` is
empty and `asked` is `no`.

**asked** — `yes` where, before settling it, the assistant put this particular
thing to them to decide: proposed it, offered it as an option, or asked about
it, in a message they could answer. `no` otherwise — including where it was
only mentioned inside a report of what had been done, or settled first and
described afterwards. For `yes`, `askCite` is the assistant's words that put it
to them, copied exactly from what is shown as WHAT CAME BACK, ITS LAST PIECE or
WHAT IT ANSWERS.

**answered** — `yes` where a message of theirs, in the stretch or afterwards,
responded to this particular thing: agreed to it, chose it, rejected it, asked
for it to be otherwise, asked about it, or said they had looked at it. A bare
yes or a choice counts only for what the message right before it put to them
to decide; it does not reach a thing that was one line inside a longer report.
`no` otherwise. For `yes`, `answerCite` is their words, copied exactly as
shown. Where it is not clear, it is `no`: a thing wrongly marked as answered
is put further down the list than it belongs.

## What exists now

Then go to where each one shows — the file, the page, the setting — and look at
what is there now. `nowSays` is what is there, copied exactly: the line or
lines that show it. Set it beside `chose`: `now` is `still` where it says
what the assistant settled, `changed` where it says something different, and
`none` where nothing in the work shows it or where you could not look, with
`nowSays` left empty. A thing you did not look at is never `still`. Give
`where` as it is now: for a file, the file and line.

## How each is written

They read the list long after the work, usually without the record in front
of them, and most of what is on it is what they are least likely to remember.
So each entry carries what it takes to recognise it and judge it, and nothing
more: a line each, never a paragraph, and no reasons.

- `question` — what was decided, put as the question it answers, in a few
  words: who, what, whether, when, how much. One decision to an entry: where
  one change settled two things, they are two entries.
- `shows` — where somebody using the result meets it, in the terms they use it
  in: what they see, do or call, and when, and who it reaches. Never something
  only the people building it would meet. Where nothing anybody using the
  result meets shows it, it is not listed (above).
- `chose` — what the assistant decided, the decision first. Where it is a set
  of values, the few that matter most, at most three.
- `risk` — `yes` only where, if what was settled is not what they meant, one
  of these follows for somebody using the result or running it:
  - money: they lose it, or are charged or paid what they should not be;
  - data: it is lost or overwritten, or shown to somebody it should not be;
  - access: they lose access that is theirs, or somebody gains access that is
    not theirs;
  - something leaves the work and cannot be called back: a message sent to
    people, a call to a paid service, something posted — whether or not
    somebody's action starts it.
  What falls under one of these is `yes` even where it could be put right
  later, by a refund, by taking the access back or by changing it again. `no`
  where none of these follows: where getting it wrong would only change how
  something looks or reads within the work, and where it only sits beside such
  a thing in the same feature. Judge it by what getting it wrong would do, not by what it is about
  or the name of the file it is in. It only marks what is listed anyway: it
  never brings in what the rules above leave out.

## Output

{
  "total": 0,
  "settled": [
    {
      "question": "what was decided, as the question it answers",
      "shows": "where somebody using the result meets it",
      "chose": "what the assistant decided",
      "risk": "yes|no",
      "firstSaid": "the assistant's words that first say it, copied exactly",
      "where": "where it is in the work now: for a file, the file and line",
      "asked": "yes|no",
      "askCite": "the assistant's words that put it to them, for yes",
      "answered": "yes|no",
      "answerCite": "their words, for yes",
      "nowSays": "what is there now, copied exactly; empty for none",
      "now": "still|changed|none"
    }
  ]
}

`question`, `shows` and `chose` are in the language named under the stretch
(WRITE IN), or, where none is named, the language they wrote in; what is
copied is copied as it is. Where
the stretch shows nothing the assistant settled on its own, `settled` is empty.
