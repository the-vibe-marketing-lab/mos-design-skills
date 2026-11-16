# mos-design-skills

Design skills for MarketingOS, Claude Code and Codex. The first skill is
**mos-atomic-design-system**, ported from Richard's atomic design framework.

It turns the active business brain's brand and references into a documented
design system: discovery, foundations, atoms, molecules, organisms, templates
and representative pages. It includes token exports, component specifications,
an HTML review site, resumable state and verification scripts.

## Install

Ask your agent to run this command for Claude Code:

```sh
npx skills add https://github.com/the-vibe-marketing-lab/mos-design-skills --skill mos-atomic-design-system --agent claude-code --global --yes
```

For Codex, replace `--agent claude-code` with `--agent codex`. Omit `--global`
to install only in the current project. Start a new agent session after
installation so the skill can be discovered.

The installer needs Node.js/npm and Git. The bundled helper scripts run with
[Bun](https://bun.com/docs/installation). An agent can check for it and guide
installation if missing. No API key is required. Browser tools improve visual
verification; Mobbin and Figma exports are optional.

## Use

Open the correct MarketingOS brain, or a website session with that brain in
context, and paste:

```text
Use mos-atomic-design-system to build the design system for this business's
existing website project. Read the active MarketingOS brain and saved
references first. Use our Taste Skill direction if one is already approved.
Find the project and brand sources from the existing records. Follow the
atomic stages, show the visual reviews and continue after each approval in
this conversation. Save the system in the website project and explain how
its approved tokens and components connect to the existing application.
```

In Claude Code you can also invoke `/mos-atomic-design-system`; in Codex use
`$mos-atomic-design-system`. This builds the design system and its reference
artifacts. Production pages are implemented in the website project using that
system. Standalone brand files work too; MarketingOS is useful context rather
than a hidden runtime dependency.

[Taste Skill](https://github.com/leonxlnx/taste-skill) is a separate skill. Use
its appropriate frontend design guidance first when you want art direction,
then this framework to organise the approved design into reusable foundations
and components. It is not included by this installer.

## Verify the package

From a clone of this repository:

```sh
bun run check
bun run test
```

The deterministic regression suite exercises valid fixtures and deliberately
broken v1, v2 and legacy systems. It is not a substitute for reviewing the
rendered design or testing the complete agent workflow against your business.

## Provenance

`PORT-PROVENANCE.json` records the original source revision, source-file hashes
and portability changes. The pack includes the scripts, references, templates
and evaluation scenarios required by the framework. It does not require access
to Richard's private repos or course notes.

Licensed under MIT. See [LICENSE](LICENSE).
