# What this instrument does with what it reads

§9.6 of the standard requires an implementation to publish six things: who reads
the material, what is retained, for how long, where it is stored, how consent is
taken and revoked, and how a placement is disputed. These are this
implementation's answers. A reader evaluating any other implementation should
require the same list from it.

## Who reads the material

The coding agent you are already using. There is no service behind this, no
account, and no key: the program in `scripts/` prepares what the agent reads,
checks what it claims, and does the counting. It uses only Node's own modules
(`fs`, `path`, `os`, `url` and `child_process`), runs no program but `git` on
this machine, and opens no socket at all.

The agent's model does not run on your machine: it runs at the company that
provides it. What the agent reads for a reading — your messages, the replies,
and the parts of your files it opens — is sent to that provider, as everything
else in your conversations with the agent is, and is handled under the data
terms you already have with that provider. The program adds no other
recipient and sends nothing anywhere itself.

## What is retained

Under `~/.blindspot-checker`, per conversation read:

- your own messages, byte for byte as your agent recorded them, because a
  reading is a claim about what you said and every level above the first is
  checked against exactly this text;
- up to 400 characters of each reply that followed one, and the names of the
  tools it used — enough to tell whether your words landed, and no more;
- how the conversation was grouped into tasks;
- the two readings taken of each task, as written;
- the placements that survived checking, each with the fragment of your own
  words it was credited to;
- the counting, and one line per reading that moved anything.
- what the assistant settled on its own in each task, as written, with the
  words cited for whether it was put to you and whether you answered, and the
  list made from them;
- for that list, what its readers are given: each task's messages with every
  reply whole, what each change wrote into the work's files, and every document
  the assistant wrote or worked from in the session, as it is now; and what
  each reader wrote back, including the lines it copied from your files.

And once, for the whole machine, what the list of conversations showed: for
each record file, its size and time, and — where it holds two or more things
you said — the date, how many there were, and the first 96 characters of the
first and the last of them. It is kept so that listing again reads only new or
changed files instead of every file on the machine.

Nothing else: not the rest of any file, and nothing about anyone who appears
in your transcripts but did not write them.

## For how long

Until you remove it. Nothing here expires on its own and nothing is rotated
away, because a level is held over a run of readings and a run that silently
lost its early ones would report a different person.

`node scripts/cs.mjs forget --all` removes everything it kept.
`--session <id>` removes one conversation. Your agent's own records are
untouched by either: this only ever read them.

## Where it is stored

In one directory on the machine it ran on: `~/.blindspot-checker`, or wherever
`BLINDSPOT_CHECKER_DIR` points. Plain text and JSON. Nowhere else.

It lives with the person rather than beside a project, because a reading is
about a person: kept per directory, somebody working in three repositories
would have three separate records of themselves, each too thin to hold
anything.

## How consent is taken and revoked

You run it on your own record, and running it is the consent.

**Reading somebody else's record is a different act and needs their consent
first.** Where that person is a minor, §9.1 of the standard applies in full: a
guardian's informed consent is required, and the minor must be told, in terms
the minor can understand, that the minor's sessions are read and by whom.
Assessment conducted without the subject's knowledge is not an implementation
of this scale. Consent is revocable; revoking it stops future readings, and
`forget` removes the stored ones.

This instrument cannot tell whose transcripts it has been pointed at. That
check is yours, and the standard makes it a requirement rather than a courtesy.

## How a placement is disputed

Every level above the first quotes your own words, and
`node scripts/cs.mjs why <situation>` shows every placement with the fragment it
was credited to and the one line saying why it sits where it does.

If you say a placement is wrong, it is wrong. A guardian's or subject's ruling
stands against the machine's until evidence of a different kind arrives (§4,
B.4). Remove the reading it came from with `forget --session`, and the counting
follows.

## What a reading is not for

A level is a description of what you can currently get built. It is not a
diagnosis, not an intelligence measure, not an attainment record, and not
admissible as either. No certificate is issued and none can be. Levels may be
reduced. A reading over few tasks is a placement rather than a measurement, and
the card says so on every run.
