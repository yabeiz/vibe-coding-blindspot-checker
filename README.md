# vibe-coding-blindspot-checker

**Every vague request is a blank check. This shows you what your coding agent wrote on yours.**

[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-standard-green)](https://agentskills.io)
[![skills.sh](https://img.shields.io/badge/skills.sh-compatible-blue)](https://skills.sh)
[![Runs in](https://img.shields.io/badge/runs%20in-Claude%20Code%20·%20Cursor%20·%20Codex%20·%20Gemini%20CLI%20·%20Antigravity-blueviolet)](#install)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)](package.json)
[![Conformance](https://github.com/yabeiz/vibe-coding-blindspot-checker/actions/workflows/conformance.yml/badge.svg)](https://github.com/yabeiz/vibe-coding-blindspot-checker/actions/workflows/conformance.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0%20%2B%20CC--BY--4.0-lightgrey)](#license)

Run it when a coding session ends. It reads what you and your agent said, and finds:

- **What your agent decided on its own** — the decisions your words never made and no reply or document ever showed you, still in your code now, with the file and the line.
- **Where your words left them open.** Every task is read against [The Command Scale](https://github.com/farsurf/command-scale): in how many of four situations your words spoke, and how high they reached. Where your words were weakest, the agent decided the most — so that is where the list starts.
- **What your agent told you and you never answered** — a decision it put in a reply or a document, that you let pass. On a list of its own, the gravest first: money, data, access, or something sent that cannot be called back, then what would not work as you meant, then what only looks different.

Then each one is yours to decide, on the spot. The agent does not get to decide it a second time.

<!-- EXAMPLE: replaced by a real English report before publishing -->

## How it differs

All of these read your work. They answer different questions.

| | What it reads | What you get |
| --- | --- | --- |
| Code review (e.g. Claude Code's review, open-code-review) | the diff | bugs in the code: does the code do what it is meant to |
| [Paxel](https://paxel.ycombinator.com) (YC) | your sessions | a profile of how you work with AI |
| Claude Code `/insights` | your sessions | a report on your habits and workflow |
| **vibe-coding-blindspot-checker** | **your sessions and your code** | **the decisions your agent made for you, where they are in your code now, and how your words in each task measured on The Command Scale — a list you can act on today** |

Run it after code review, not instead of it:

1. **Run code review first, and let your agent fix what it finds.** Those are bugs: the code does not do what it is meant to. They need no decision from you.
2. **Then run this.** What it lists is not bugs. Most of it works exactly as written; what it shows you is what your agent decided for you. Whether each is what you meant only you can say.

## Install

Tell your agent:

```
Install the skill at https://github.com/yabeiz/vibe-coding-blindspot-checker
```

Or with one command, for any agent that loads Agent Skills:

```bash
npx skills add yabeiz/vibe-coding-blindspot-checker
```

Or as a Claude Code plugin:

```
/plugin install vibe-coding-blindspot-checker --marketplace yabeiz/vibe-coding-blindspot-checker
```

<details>
<summary>Or clone it into your agent's skills folder</summary>

| Agent | Folder |
| --- | --- |
| Codex, Gemini CLI, Cursor, GitHub Copilot, opencode, Amp | `~/.agents/skills/vibe-coding-blindspot-checker` |
| Claude Code | `~/.claude/skills/vibe-coding-blindspot-checker` |
| Antigravity | `~/.gemini/config/skills/vibe-coding-blindspot-checker` |
| Cline | `~/.cline/skills/vibe-coding-blindspot-checker` |
| Kiro | `~/.kiro/skills/vibe-coding-blindspot-checker` |
| JetBrains Junie | `~/.junie/skills/vibe-coding-blindspot-checker` |

```bash
git clone https://github.com/yabeiz/vibe-coding-blindspot-checker ~/.claude/skills/vibe-coding-blindspot-checker
```
</details>

It needs Node 18 or newer and nothing else: no dependencies, no account, no key. Claude Code asks before it installs a skill in auto mode; say yes once.

Then, when a session ends:

```
Check my last coding session for blind spots.
```

It first shows you which conversations it found and what reading each would cost, and waits for you to pick. Nothing is read until you say which.

## Whose sessions it can read

It reads the records these agents keep on your machine: **Claude Code** (`~/.claude/projects`), **Cursor** (`~/.cursor/projects`), **Codex** (`~/.codex/sessions`), **Gemini CLI** (`~/.gemini/tmp`) and **Antigravity** (`~/.gemini/antigravity*/brain`). A conversation from any other tool can be read once it is saved as plain text with each side marked (`Me: …` / `AI: …`).

Claude Code deletes session records after 30 days by default. To audit older work, raise `cleanupPeriodDays` in your Claude Code settings before the records are gone.

## What it costs

Looking at results costs nothing. Reading a session does: the agent you already use does the reading, with helper agents that start from a clean context, so it spends your own plan's allowance or tokens. For scale: one real three-day session — 10 tasks, about 10,000 lines changed — took about 17 minutes and about 3.4 million tokens of helper reading on Claude. It tells you what a reading would cost before it starts.

It works best in an agent that can start helper agents (Claude Code, Codex, Cursor, Gemini CLI, Antigravity, Copilot, Kiro). Where it cannot, it reads one piece at a time, which is slower.

## What it does with what it reads

The program in `scripts/` imports five Node built-ins — `fs`, `path`, `os`, `url` and `child_process` (to run `git` on your own repository) — and opens no network connection. `grep -rhoE "from '[^.][^']*'" scripts | sort -u` shows the whole list. What it keeps is plain files under `~/.blindspot-checker`, and [`policy/reading-your-record.md`](policy/reading-your-record.md) says what, where, and how to delete it.

The reading itself is done by the assistant you are already using, so what it reads goes to that assistant's model provider, under the terms you already have with them. Nothing goes anywhere else.

## How it works

1. Your session is split into tasks.
2. Each of your messages is placed in one of four situations — asking for something, reviewing what came back, saying progress has stopped, asking a question — and given a height on [The Command Scale](https://github.com/farsurf/command-scale), with your own words quoted. A quote that is not in your messages is thrown out.
3. Helpers that never saw the conversation read what the agent decided and what it wrote into your code without saying so. The program keeps only what is still in your code.
4. What you were never told goes on the first list: tasks where your words spoke in the fewest situations come first, then those where they reached least.
5. What a reply or a document told you, and you never answered, goes on the second list, ordered by what would follow if it is not what you meant. A bare "ok" answers only what the message right before it asked you; it does not answer one line inside a long report. What you did answer is on neither list.

The session also gets a rating on the scale, added up across every audit you run, so you can see whether your sessions are getting better. It rates a session, never a person.

## What it cannot tell you

- **Whether a decision is wrong.** It finds what you did not decide. Whether each is what you meant is yours to say.
- **Bugs.** A line that contradicts another line is code review's job. Run code review too.
- **Anything it cannot read.** Changes made by shell commands and never committed, and conversations kept in tools it does not read, are not in it.
- **A verdict about you.** One session is a placement, not a measurement.

## Repository

- [`SKILL.md`](SKILL.md) and [`references/`](references) — how the agent runs an audit.
- [`prompts/`](prompts) — what each reader is told.
- [`scripts/`](scripts) — preparing, checking and counting, in Node with no dependencies.
- [`spec/`](spec/the-command-scale-v1.0.md) — The Command Scale v1.0.
- [`conformance/`](conformance) — cases with their answers: `npm run conformance`.

## License

Code, prompts and fixtures under [Apache 2.0](LICENSE); the spec and text under [CC BY 4.0](LICENSE-TEXT.md). "The Command Scale" and its level names are covered by neither — see [TRADEMARK.md](TRADEMARK.md).

The Command Scale is published by [Mentor by farsurf](https://mentor.farsurf.com), which sells a subscription product whose assessments are taken against it. That is a direct commercial interest in the scale being adopted, stated here so it can be weighed.
