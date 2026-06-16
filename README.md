# 🔒 SecretKeeper

> **Because your AI agent is a generous philanthropist trying to donate your AWS budget and Stripe keys to the public domain.**

AI agents are brilliant, fast, and write code at 1000 WPM. They are also completely oblivious to security. If left unsupervised, they *will* hardcode your production database URL, log your JWT signing key to the console, and push it to main at 3:00 AM. 

**SecretKeeper** is the paranoid, caffeine-fueled security engineer that sits in your agent's context and blocks them from shipping credentials before you get paged.

---

## 🧐 The Problem

LLMs love credentials. To an LLM, `"AKIAIOSFODNN7EXAMPLE"` is just a string that completes a code snippet beautifully. They don't pay the cloud bills, and they don't have to explain the data breach to the board of directors. 

If you use Cursor, Claude Code, Cline, or Copilot, you are one tab-complete away from a public disclosure. 

---

## 🛡️ The Two Layers of Paranoia

SecretKeeper does not trust the LLM. It does not trust you. It barely trusts itself.

1. **Prompt Injections (The Agent Brainwashing):** Injected system instructions (`AGENTS.md`, `.cursorrules`, etc.) that train the agent to be pathologically terrified of hardcoded credentials. It forces the agent to use `process.env` and update `.env.example` automatically.
2. **Deterministic Scan (The Safety Net):** A zero-dependency, lightning-fast regex + Shannon entropy scanner that runs in pre-commit hooks and agent post-write hooks. Even if the LLM "hallucinates" that it's safe to write a secret, the scanner catches it on disk and intercepts the agent's flow.

---

## 🧗 The Ladder of Paranoia

When writing code, SecretKeeper forces your agent to follow the ladder:

1. **Deny existence:** Does the code *actually* need an API key to run a local test? No? Don't write it.
2. **Hide in Environment:** Use `process.env.STRIPE_SECRET_KEY` / `os.environ.get()` / equivalent.
3. **Document the placeholder:** Immediately add `STRIPE_SECRET_KEY=your_stripe_key_here` to `.env.example`.
4. **Silence the logs:** Never `console.log(apiKey)` or `print(password)`. If you log it, it leaks in browser DevTools.
5. **Complain:** If forced to write a literal secret, the agent will throw a warning, complain, and ask for parameterized configurations.

---

## ⚡ Quick Start

Install this repo as a plugin, or drop `AGENTS.md` in your project root, and run:

```bash
git clone https://github.com/Puja-Jorwar/secretkeeper.git
cd secretkeeper
npm test
node bin/secretkeeper.js audit
```

### CLI Commands for Humans (and Agents)

| Command | Action |
|---------|--------|
| `node bin/secretkeeper.js scan` | Scans current git diff (staged + unstaged) |
| `node bin/secretkeeper.js audit` | Audits the entire codebase for buried secrets |
| `node bin/secretkeeper.js history` | Scans git commit logs to find secrets you deleted but forgot to purge from history |

---

## 🎚️ Intensity Levels

Tell your agent how paranoid you want to be:

*   **/secretkeeper lite:** "Write the code, but if you hardcode a key, write a comment warning me." (Casual mode)
*   **/secretkeeper full:** "Auto-replace literal secrets with `process.env` and update `.env.example`." (Default)
*   **/secretkeeper ultra:** "Refuse to write. Block execution. Warn me about suspicious high-entropy strings." (Paranoid mode)

---

## 🧪 Installation per Agent

*   **Claude Code:** Copy this repo and point Claude Code at `.claude-plugin/`, or use `/plugin install`.
*   **Cursor:** Copy `.cursor/rules/secretkeeper.mdc` into your project's `.cursor/rules/`.
*   **Cline / Windsurf:** Copy `.clinerules/secretkeeper.md` or `.windsurf/rules/secretkeeper.md`.
*   **Universal:** Drop `AGENTS.md` in your root folder. Any reading agent will instantly inherit the paranoia.

---

## 🚫 False Positives

If your test suite relies on mock credentials (like `sk_test_123`), add them to `.secretkeeperignore` so SecretKeeper doesn't wake you up at night.

```
# .secretkeeperignore
tests/fixtures/
benchmarks/fixtures/
```

---

## 📜 License

MIT. Go ahead, fork it, run it, and stop donating your API budgets to bots scanning GitHub commits.
