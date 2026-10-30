# Contributing

Issues and pull requests are welcome.

- **A misreading** (a decision listed that you did make, or a message placed in the wrong situation): open an issue with the template "Misreading". Paste only what you are comfortable sharing; never paste a whole session.
- **A new agent's records**: readers live in `scripts/lib/transcripts.mjs`. A record is recognised by what its lines look like, not by where it sits. Add a small anonymised fixture with your change.
- **The scale itself** (the four situations, the levels, the thresholds): those belong to the standard. Open the discussion at [farsurf/command-scale](https://github.com/farsurf/command-scale).

Before a pull request:

```bash
node --check scripts/cs.mjs
npm run conformance
```

Changes to anything in `prompts/` or `SKILL.md` change how every audit reads. Say in the pull request what you expect to change in a report, and on what kind of session you checked it.
