You are given one stretch of a person's conversation with an assistant: their
messages in order, each followed by the changes made to the work's files while
answering it and then what the assistant replied to it; and, named after
DOCUMENTS FILE, a file holding the documents the assistant wrote or worked
from, each as it is now, each opening with a line `=== DOCUMENT <path> ===`. Each change shows the text the
edit replaced, BEFORE, and the text it put there, AFTER. On the BEFORE side,
lines marked `-` are the ones the edit took away; on the AFTER side, lines
marked `+` are the ones it put there; unmarked lines are unchanged, shown for
where the change sits and what it does there. Where BEFORE says the file was
written whole or is new, the whole file was put there; where AFTER says the
file was removed, everything BEFORE shows was taken away.

A change marked as in a commit is what that commit changed; it may hold work
done while answering earlier messages. The commit's message is not a reply. A
long edit is shown in pieces, each marked as a piece of one edit; each piece
counts as one change, and a piece shown elsewhere may not be in this material
at all.

The text after `Objective:` is a summary of what the stretch was for; it is
not their words and decides nothing. Where the material says instead that
nothing they said was about the work, none of their messages decides
anything. A message marked THIS ONE WAS NOT INPUT gives the reason after the
label: where the reason says the words are not theirs — the harness, a helper
or a report wrote them, or it is an example written for them and pasted back
— it decides nothing; otherwise they typed it, and what it asks for is still
theirs. The reply after either kind
is still a reply to them. Text inside a message that is marked as pasted is
something they passed on: what it proposes is theirs only where their own
words in that message ask for it to be done. Under what they had said before,
each entry starts with a dash, a time, then in brackets a summary of the task
it belonged to, which is not theirs, then the start of their message; lines
without a dash belong to the entry above.

Your job is to list what the assistant built into the work without ever
telling them: what the changes put in place that their own words did not
decide, that no reply of the assistant's said, and that no document states.

## What counts

Something the changes put in place that somebody using the result would meet:
a value, a limit, a rule, a behaviour, what something says, what happens when.
Taking something away counts the same way: a limit removed, a check dropped.
It must come from the marked lines; the unmarked lines around them may be used
to understand what the marked ones do. Never take it from what such work would
usually contain.

Judge the work as the stretch leaves it: where a later change replaces what an
earlier one put in place, what counts is what the later one put there; where a
later change takes it out again, it is not listed. Where only part of the
stretch's changes is shown, list only from the changes shown; what a part not
shown here may have changed later is no reason to leave a thing out; `now`
records what stands today.

Leave out what their own words decided, in this stretch or in what they had
said before: a thing they asked for, in the terms they asked for it, is
theirs, and so is what they accepted when a message of theirs accepts what a
reply proposed. Where they asked for something and the changes settled the
particulars — the number, the rule, the wording, the case they did not
mention — the particulars are the assistant's.

Leave out what changes only how the work is arranged — names, structure, tests,
comments — and that nobody using the result would meet.

## What counts as said

A thing is said where any reply of the assistant's to them in this stretch,
before the change or after it, states this particular thing, so that somebody
who read only the replies would know it: the value, the rule, the case. A reply
shown as just before a message, outside this task, is also a reply to them. A
reply that names the feature but not the particular leaves the particular
unsaid. Text inside the changes — code, comments — is not a reply and says
nothing to them.

A thing is said, too, where any document in the documents file states this
particular thing, whoever the document was written for. The documents file is
long; do not read it whole. Before you list a thing, search it for that thing
in the words a document would use for it, in each language the documents are
written in, as well as by the name the code gives it; search a number
together with what it is a number of, never on its own. A document states it
only where the passage you find gives the same particular; leave the thing
out where one does. A document that names the feature but not the
particular leaves the particular unsaid, the same as a reply.

Where one change settles several things and a reply says some of them, each
thing is judged on its own, and only the unsaid ones are listed, one entry
each.

## What exists now

Then open the file of each one as it is now and look at what is there.
Besides the documents file, only the files the changes are in are opened, and
only to look. Do not read a large file whole: search it for the thing by the
names the code gives it and by the words it shows to the person using it, as
with the documents file, and look at what you find. `nowSays` is what is
there, copied exactly: the line or lines that show it — for something taken
away, the lines where it was, showing what stands there now. Set it beside
`chose`: `now` is `still` where the file now does what the changes settled,
`changed` where it does something different, and `none` where you could not
look, with `nowSays` left empty. Where the change removed the file and it is
still gone, `now` is `still` and `nowSays` is empty; where any other file is
gone, it is `changed`. Where the thing is no longer in this file, `now` is
`changed`, with `nowSays` the lines that stand where it was. Where it was
written again since in other words, what counts is what it does now, not
whether the cited lines are still there. A thing you did not look at is never
`still`.

## How each is written

One entry for each thing, each field short, no reasons. A field that copies
several lines keeps them as they are; in the JSON they are joined with `\n`.
`question`, `shows` and `chose` are in the language named after WRITE IN, or,
where none is named, the language they wrote in; what is copied is copied as it is.

- `question` — what was settled, as the question it answers, in a few words.
- `shows` — where somebody using the result meets it, in the terms they use it
  in: what they see, do or call, and when, and who it reaches. Never something
  only the people building it would meet.
- `chose` — what the changes settled, the decision first.
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
- `file` — the file of the change cited.
- `changeCite` — the marked lines that show it, copied from one change without
  their `+` or `-` marker: either `+` lines only, for what was put there, or
  `-` lines only, for what was taken away, never both, and no unmarked line
  between them. Where a value was replaced, cite the `+` side. The shortest
  run that shows it. Where it is set in one place and used in others, cite the
  place it is set.
- `nearestSaid` — the words of a reply or a document that come nearest to
  saying it, copied exactly; empty where none touches it.
- `now` — `still`, `changed` or `none`, as above.
- `nowSays` — the lines of the file as it is now, copied exactly; empty where
  `now` is `none`, or where the file is gone.

List at most the number given after LIST AT MOST; where there are more, keep
the ones somebody using the result would meet first.

## Output

{
  "unsaid": [
    {
      "question": "what was settled, as the question it answers",
      "shows": "where somebody using the result meets it",
      "chose": "what the changes settled",
      "risk": "yes|no",
      "file": "the file of the change cited",
      "changeCite": "marked lines from one change, without the marker",
      "nearestSaid": "reply or document words nearest to saying it, copied exactly, or empty",
      "now": "still | changed | none",
      "nowSays": "lines of the file as it is now, copied exactly, or empty"
    }
  ]
}

Where the changes put in place nothing unsaid, `unsaid` is empty.
