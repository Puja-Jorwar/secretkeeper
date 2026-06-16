# SecretKeeper

**Stops AI agents from leaking secrets into your code.**

The best secret is the one your agent never writes. SecretKeeper combines prompt-injected rules with a **deterministic regex + entropy scanner** that catches hardcoded credentials — independent of whether the model felt like checking.

## What it catches

| Category | Examples |
|----------|----------|
| Cloud keys | AWS access/secret keys, Azure connection strings, GCP service accounts |
| API tokens | OpenAI, Anthropic, Stripe, Twilio, SendGrid, Slack, npm, Google |
| VCS tokens | GitHub PATs (`ghp_`), GitHub OAuth (`gho_`), GitLab (`glpat-`) |
| Auth secrets | JWT signing secrets, OAuth client secrets, hardcoded passwords |
| Crypto | Private keys (`-----BEGIN PRIVATE KEY-----`) |
| Database | `postgres://user:pass@...`, `mysql://`, `mongodb://` with credentials |
| Fallback | High-entropy strings that look like unlabeled secrets |
| Console leaks | `console.log(apiKey)`, `console.log(process.env.SECRET)`, `print(token)`, `logger.debug(secret)` |

## Two layers

1. **Prompt rules** — agent refuses to write literals or log secrets, uses `process.env.X` instead
2. **Deterministic scanner** — regex + Shannon entropy, runs after file writes (hooks) and via CLI, zero dependencies

## How it works

```
Agent writes file → PostToolUse hook scans file → findings injected into agent context → agent fixes
```

SecretKeeper does **not** block file writes. It scans **after** the agent writes and tells it to fix leaks before continuing.

## Quick start

```bash
git clone https://github.com/yourname/secretkeeper.git
cd secretkeeper
npm test
node bin/secretkeeper.js audit
```

## CLI

```bash
node bin/secretkeeper.js scan      # Scan git diff (staged + unstaged)
node bin/secretkeeper.js audit     # Scan entire repo
node bin/secretkeeper.js history   # Scan git history for buried secrets
```

Exit code `1` if secrets found (CI-friendly).

## Agent commands

| Command | What it does |
|---------|-------------|
| `/secretkeeper [lite\|full\|ultra\|off]` | Switch intensity (default: **full**) |
| `/secretkeeper-scan` | Scan current diff |
| `/secretkeeper-audit` | Audit entire repo |
| `/secretkeeper-history` | Find secrets in git history |
| `/secretkeeper-help` | Show commands and detection scope |

### Intensity levels

| Level | Behavior |
|-------|----------|
| **lite** | Flag hardcoded secrets, suggest env var fix |
| **full** | Auto-replace with env vars, update `.env.example` (default) |
| **ultra** | Refuse to write any literal secret |

## Install per agent

### Claude Code

```bash
/plugin marketplace add yourname/secretkeeper
/plugin install secretkeeper@secretkeeper
```

Or copy this repo and point Claude Code at `.claude-plugin/`.

### Cursor

Copy `.cursor/rules/secretkeeper.mdc` to your project's `.cursor/rules/`, or install the full repo as a plugin.

### Codex

```bash
codex plugin install secretkeeper@secretkeeper
```

### OpenCode

Add to your `opencode.json`:

```json
{ "plugin": ["./.opencode/plugins/secretkeeper.mjs"] }
```

### Copilot CLI

Copy `hooks/copilot-hooks.json` into your Copilot hooks config.

### Windsurf / Cline

Copy `.windsurf/rules/` or `.clinerules/` to your project.

### Universal (any agent)

Drop `AGENTS.md` in your project root. Works with any agent that reads it.

## False positives

Add paths or patterns to `.secretkeeperignore` (like `.gitignore`):

```
# Test fixtures with fake secrets
tests/fixtures/
benchmarks/fixtures/
```

## Benchmark

```bash
npm run benchmark
```

Runs the scanner against synthetic seeded secrets and reports detection rate.

## Environment

```bash
SECRETKEEPER_DEFAULT_MODE=ultra   # Default agent intensity
```

Config file: `~/.config/secretkeeper/config.json` (or `%APPDATA%\secretkeeper\` on Windows)

## Project structure

```
secretkeeper/
├── skills/secretkeeper/SKILL.md   # Source of truth (ruleset)
├── hooks/                          # Scanner + activation hooks
│   ├── secretkeeper-scanner.js     # Deterministic detection engine
│   ├── secretkeeper-instructions.js
│   └── secretkeeper-activate.js
├── commands/                       # /secretkeeper-* slash commands
├── bin/secretkeeper.js             # Standalone CLI
├── benchmarks/                     # Detection rate benchmarks
├── .cursor/rules/                  # Cursor adapter
├── .opencode/plugins/              # OpenCode adapter
├── .codex-plugin/                  # Codex adapter
├── .claude-plugin/                 # Claude Code adapter
└── AGENTS.md                       # Universal adapter
```

## License

MIT — fork it, ship it, keep your secrets out of git.
