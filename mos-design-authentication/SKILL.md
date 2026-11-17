---
name: mos-design-authentication
description: "Get a computer ready to build a website with an AI agent: checks and completes sign-in for GitHub, Cloudflare and MarketingOS, confirms Node, Git and Bun, then hands off to EmDash (the Astro CMS on Cloudflare) and mos-design-site-planner. Use this first whenever someone wants to start a website project with MarketingOS, says 'set me up', 'connect GitHub', 'log in to Cloudflare', 'is everything connected', 'wrangler login', 'gh auth', 'get ready to build my site', 'start the website course', or hits an authentication error from gh, git push, wrangler or mos, even if they don't say 'authentication'. Not for deploying a site, writing code or planning pages."
---

# MarketingOS Design: Authentication

The first step of the MarketingOS website path. Before anyone plans or builds a
site with an AI agent, three accounts have to work from this computer:

- **GitHub**, so the website project can live in a private repo and be pushed.
- **Cloudflare**, because EmDash sites deploy there (Workers, D1 and R2).
- **MarketingOS**, so the agent reads the business brain instead of guessing.

The person running this is usually a marketer, not a developer, so explain each
step in plain English, one at a time, and never make them read raw terminal
output to work out what went wrong.

## How this skill works

1. **Check everything first, fix second.** Run the bundled checker before asking
   the person anything. It reports what is installed and signed in, so you only
   help with what is actually missing.

   ```sh
   bun "$SKILL/scripts/check-setup.ts"
   ```

   Resolve `$SKILL` to the directory holding this SKILL.md (agents install skills
   in different places). Add `--json` when you want to parse the result. If Bun
   is missing, the checker can't run: help them install Bun first
   (https://bun.com/docs/installation), then run it.

2. **Show a readiness card.** One line per item: ready, missing or needs
   attention, with the account name where there is one (GitHub username,
   Cloudflare account). Keep it short.

3. **Fix the gaps in this order:** tools (Git, Node, Bun) → GitHub → Cloudflare →
   MarketingOS. Later steps depend on earlier ones: EmDash needs Node, and
   pushing the project needs GitHub. Details for each are in
   `references/fixes.md`. Read only the section for what is missing.

4. **Re-run the checker** after each fix, and move on only when that item shows
   ready. A login that "seemed to work" but doesn't show in the checker isn't done.

5. **Hand off** with the next steps (see "Next step" below).

## Sign-ins the person does themselves

Browser logins (GitHub and Cloudflare) need the person to click through a
browser page, and the agent can't do that for them. Give them the exact command
and say what will happen ("a browser tab opens, click Authorize, then come back
here").

- In **Claude Code**, they can run it from the prompt with a leading `!`, for
  example `! gh auth login --web --git-protocol https`, so the output lands in
  the conversation.
- In **Codex** or another agent, ask them to run it in their own terminal and
  tell you when it's done.

## Keeping credentials safe

Tokens and keys are what let someone publish to the person's accounts, so treat
them like passwords:

- Never print, echo or repeat a token, even partly. The checker only reports
  whether one exists.
- Never ask them to paste a token into the chat. If an API token is needed (for
  example when a browser login can't complete), have them save it themselves in
  a `.env` file that git ignores, and confirm the file is ignored before anything
  is committed.
- Don't change account settings, create repos, or deploy anything in this skill.
  It only gets the computer signed in.

## Next step: EmDash, then the site plan

When everything shows ready, tell them what comes next, in this order:

1. **Create the website project with EmDash** (https://github.com/emdash-cms/emdash),
   a CMS built on Astro that deploys to Cloudflare. The **Marketing** template
   suits most small-business sites. The command is `npm create emdash@latest`.
   Offer to run it with them in a new folder next to their brain (not inside
   it), and ask before creating a GitHub repo for it, which should be private.
2. **Plan the site** with `mos-design-site-planner`. It reads the brain, asks
   what they need from the website and produces the sitemap.
3. **Build the design system** with `mos-atomic-design-system`.

End with the readiness card, what was fixed this session, anything still
blocked, and the single next action for the person.
