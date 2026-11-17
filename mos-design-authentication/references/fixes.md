# Fixes, one section per checker item

Read only the section for an item the checker marked missing or needs attention.
Re-run `bun "$SKILL/scripts/check-setup.ts"` after each fix.

## Contents

- Git
- Node and npm
- Bun
- GitHub CLI and sign-in
- Cloudflare (Wrangler) sign-in
- MarketingOS CLI, skills and brain
- Windows and WSL notes

## Git

Needed to save and push the website project.

- macOS: `xcode-select --install` (installs Git with the developer tools), or `brew install git`.
- Windows: install Git for Windows from https://git-scm.com/download/win.
- Linux: the system package manager (`sudo apt install git` on Ubuntu).

Then set the name and email used on commits if they aren't set:
`git config --global user.name "Their Name"` and `git config --global user.email "their@email"`.
Ask for these rather than guessing.

## Node and npm

EmDash is created with `npm create emdash@latest` and needs a current Node
(20 or newer; the 22 LTS is a safe choice). Install from https://nodejs.org (LTS)
or with a version manager they already use. Check with `node --version`.

## Bun

The MarketingOS design skills run their helper scripts with Bun. Install from
https://bun.com/docs/installation, then open a new terminal so `bun` is found.

## GitHub CLI and sign-in

1. Install `gh`: https://cli.github.com (macOS `brew install gh`; Windows
   `winget install GitHub.cli`; Linux see the install page).
2. Sign in (the person runs this, a browser tab opens):
   `gh auth login --web --git-protocol https`
3. Let git use that login for pushes: `gh auth setup-git`
4. The website workflow pushes code and may add GitHub Actions, so the login
   needs the `repo` and `workflow` scopes. If the checker reports a missing
   scope: `gh auth refresh -h github.com -s workflow` (the person runs it).

If they have more than one GitHub account, confirm which one the website should
live under before going further (`gh auth status` lists them).

## Cloudflare (Wrangler) sign-in

EmDash deploys to Cloudflare Workers with D1 (database) and R2 (files).

1. Wrangler doesn't need a global install: `npx wrangler@latest whoami` works
   anywhere Node is installed.
2. No Cloudflare account yet? They sign up free at https://dash.cloudflare.com/sign-up.
3. Sign in (the person runs this, a browser tab opens): `npx wrangler@latest login`
4. Check: `npx wrangler@latest whoami` shows their email and account.

**When the browser login can't finish** (a remote machine, a container, some WSL
setups where the localhost callback never returns), use an API token instead:

1. They create one at https://dash.cloudflare.com/profile/api-tokens using the
   "Edit Cloudflare Workers" template, and add D1 Edit and R2 Edit permissions.
2. They save it themselves in a git-ignored `.env` in the website project as
   `CLOUDFLARE_API_TOKEN=...`, plus `CLOUDFLARE_ACCOUNT_ID=...` (shown on the
   dashboard's right-hand side).
3. Confirm `.env` is listed in `.gitignore` before any commit.

Never ask them to paste the token into the chat, and never print it.

If `whoami` lists several accounts, ask which one the website belongs to. Also
confirm a single account is the right one: people often have an employer's or a
client's Cloudflare login on the same computer. To switch: `npx wrangler@latest logout`,
then `login` again while signed in to the right account in the browser.

**"Signed in, but a token overrides it".** Wrangler reads `CLOUDFLARE_API_TOKEN`
from the shell and from a `.env` in the folder it runs in. A stale or expired one
(error 9109, "Invalid access token") beats a working browser login. The person
removes or replaces that line themselves; the website project keeps its own `.env`.

## MarketingOS CLI, skills and brain

1. Install the CLI: `pipx install marketing-os`, or `uv tool install marketing-os`
   if pipx isn't installed. Both put `mos` in `~/.local/bin`.
2. Wire the skills into Claude Code and Codex: `mos install --runtime all --yes --no-ui`
3. Skills are found when a session starts, so after installing they open a new
   agent session.
4. **No brain yet:** in a new session, inside the folder where the brain should
   live, they run `/mos-onboard` (Codex: `$mos-onboard`). Don't onboard inside
   this skill; it's a separate conversation about their business.
5. **Brain exists:** the checker runs `mos status` there. Errors (shown as
   `[error]`) are worth fixing before planning a site, usually with `mos fix` or
   by answering `mos context`. Warnings don't block the website work; mention the
   count and move on.

## Windows and WSL notes

- Run everything inside the same environment the agent uses. If the agent runs
  in WSL, install the tools inside WSL, not in Windows.
- Windows `.exe` tools called from WSL can fail with "Exec format error". Install
  the Linux versions inside WSL instead.
- If `npx wrangler login` opens a browser but the terminal never confirms, use
  the API token route above.
