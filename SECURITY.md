# Security

## What this skill touches

- **Reads:** the session records your coding agents keep on your machine (see the README for the folders), and, with `git`, the repositories those sessions changed.
- **Writes:** plain text and JSON under `~/.blindspot-checker` (or wherever `BLINDSPOT_CHECKER_DIR` points). Nothing else, except a file you explicitly ask it to write with `page --out`.
- **Network:** none. The program in `scripts/` imports only `fs`, `path`, `os`, `url` and `child_process`, and runs only `git`. Check it yourself:

  ```bash
  grep -rhoE "from '[^.][^']*'" scripts | sort -u
  grep -rn "execFileSync\|spawn" scripts
  ```

The reading itself is done by the agent you run the skill in. What it reads goes to that agent's model provider under the terms you already have with them.

To remove everything it kept: `rm -rf ~/.blindspot-checker`.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting on this repository ("Security" tab → "Report a vulnerability"). You will get an answer within a week.
