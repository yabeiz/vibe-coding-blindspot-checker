# Next to code review: two real sessions

Does this find what code review finds? No. Does it find something code review does not? Yes, and it is a different kind of thing. This page is how we know, and how far that goes.

**In short**

- **They barely overlap.** On two real sessions, 8 and 4 of code review's items were also on this checker's lists.
- **They find different things.** In the session sorted by hand, everything code review found and this missed was a bug; everything only this found was a product decision nobody had made, such as whether an admin reviewing an appeal sees the rest of the conversation.
- **Most of what this lists is right as it is, and that is the point.** It lists what was decided for you. In session B, 25 of the 40 items sampled from it were real and never settled by the person; most of them they would keep. Whether each is what you meant is yours to say. Bugs are code review's job, and it is better at them.

## What was compared

Two real Claude Code sessions in October 2026, by the author, on a web platform the author builds:

- **Session A** — three days, about 10 tasks, about 10,000 lines changed: direct messages, a reports page for admins, edit requests between collaborators, paid translation.
- **Session B** — three days, 14 tasks: a referral path from shared work to sign-up.

For each, everything the session changed was rebuilt as an isolated repository and run through:

| Tool | How it was run |
| --- | --- |
| Code review | Claude Code's own code-review instructions, high effort, by a fresh agent that had seen nothing else |
| Security review | Claude Code's own `/security-review` instructions, the same way |
| vet | [imbue-ai/vet](https://github.com/imbue-ai/vet) 0.2.16 with Claude Sonnet 5.5 (session A only) |
| This checker | the version of 29 October 2026, on the session's own record |

## How it was judged

Items from every tool were shuffled, their sources removed, and handed to four fresh agents that saw only the code as the session left it and the person's own messages. Each item was judged on four questions fixed beforehand:

1. Is it really in the code?
2. Did the person's own words settle it?
3. If it is not what they meant, what follows: money, data, access, something sent, or none of these?
4. Would the person want it changed?

From this checker, 40 items per session: the top 10 of each of its two lists, and 10 picked at random from the rest of each.

## Results

The judges' last question, "would the person want it changed", is a bug finder's measure, and code review wins it:

| | Session A | Session B |
| --- | --- | --- |
| Code review | 21 of 31 | 19 of 32 |
| Security review | 1 of 1 | reported nothing |
| This checker, first list, top 10 | 0 of 10 | 1 of 10 |
| This checker, first list, 10 at random from the rest | 5 of 10 | 0 of 10 |
| This checker, second list (old rule), top 10 | 0 of 10 | 1 of 10 |
| This checker, second list (old rule), 10 at random from the rest | 3 of 10 | 1 of 10 |
| vet | 5 of its 22 candidates | not run |

- **Little overlap.** Of code review's items, 8 in session A and 4 in session B were also on this checker's lists, none of them in either list's top 10.
- **What code review found and this missed is a bug.** In session A, code review's real problems were sorted by hand into two kinds: code that does not do what its own comments, constants or other code already state (16), and a design choice whose rightness depends on what the person wanted (4). Every one this checker missed was of the first kind. It found all four of the second kind, but ranked them 19th or lower.
- **What only this found is a decision.** Session A: 4 that no other tool reported, all product rules, such as whether an admin reviewing an appeal sees the rest of the conversation, and whether a dismissed appeal is ever told to its sender. Session B: 2, such as how page owners are charged for translation and in which regions a recommendation setting is on by default.
- **Most of what this lists is not wrong.** In session B, 27 of the 40 items sampled from it were really in the code and 25 were never settled by the person; most of them the person would keep. That is what it is for: it shows what was decided for you, and only you can say whether it is what you meant.

## What changed because of it

- Its second list used to be "what would cost most if it is not what you meant", picked from everything. It turned out to hold mostly what the first list already had, and it read like a security list without matching security review. In 0.1.0 it is replaced by **what the agent told you and you never answered**, gravest first. The first list is unchanged.
- The README now says to run code review first and let the agent fix what it finds.

## Limits

- Two sessions, one author, one product.
- "Would want it changed" is a model's judgment, with the person's own words as what they meant.
- The isolated repositories were rebuilt from the session's commits and missed a few files. That made one of code review's items in session A and both of vet's default reports false; they are counted as found, not as problems.
- The checker compared is the version before its second list changed.
- Reading the same session twice is not identical: a second reading of session A changed about a fifth of the first list (18 out, 13 in, of about 90). Its top 10 did not change.
- Cost, session A: this checker about 3.4 million tokens of helper reading; code review about 0.3 million.

The problems code review and security review found in session A have since been fixed.
