# VCFUpgradeGuide – Claude Code Context

> Auto-loaded by Claude Code. Conventions for any collaborator's Claude instance working in this repo.

---

## Project overview

ITQ guidance for planning a **VCF upgrade** – pre-upgrade checks, the
upgrade sequence, and post-upgrade validation, applicable **regardless of
underlying hardware**. Hardware/HCI-specific extra steps are layered on
**top** of the general flow as their own addendum, not baked into it –
currently **Dell VxRail** (started from a specific customer engagement:
VxRail 5.2 → VCF 9.1.1, but the general guidance should stay reusable
beyond that one engagement).

**Public.** This repo is public and is the first section of a planned
general **VMware Docs** site (docs.hollebollevsan.nl) – future guides need
not be upgrade-specific or even VCF-specific, just VMware. Scaffolded
2026-08-27 from `VCF9-DeploymentPlanning`'s conventions (doc/site
structure, changelog discipline, GitHub/GitLab issues discipline) – see
that repo's `CLAUDE.md` for the fuller version of these rules if something
here is ambiguous.

**Cross-reference, don't duplicate.** `VCF9-DeploymentPlanning` holds
foundational VCF9 knowledge that's directly useful during an upgrade (fleet
shutdown/startup ordering, firewall ports, certificate-authority setup, SSO
config, Day-N component removal). Link to it rather than copying its content
here – see the Related repo section in `README.md`.

---

## File layout

| Path                 | Purpose                                                       |
| --------------------- | -------------------------------------------------------------- |
| `README.md`           | Project overview + link to the related deployment-planning repo |
| `CHANGELOG.md`        | Per-release notes; **newest entry at TOP**                    |
| `CLAUDE.md`           | This file                                                     |
| `.gitignore`          | Excludes customer artifacts                                   |
| `docs/01-overview.md` | General VCF upgrade guidance (any hardware) – the spine     |
| `docs/02-disaster-recovery.md` | SRM / vSphere Replication → Protection and Recovery convergence |
| `docs/03-identity-broker-migration.md` | VIDM / Workspace ONE Access → VCF Identity Broker |
| `docs/04-field-notes.md` | Known issues and gotchas from real upgrades |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps, on top of the general flow |
| `reference/`          | Pinned reference material (Dell/VMware docs, KBs, etc.)        |
| `tools/`              | Helper scripts, if any get added                               |
| `web/`                | ITQ-branded Astro site rendering `docs/` in place, dual-deployed (public + internal) |
| `.gitlab-ci.yml`      | Internal GitLab Pages deploy                                   |
| `.github/workflows/pages.yml` | Public GitHub Pages deploy – docs.hollebollevsan.nl      |

**Keep the general/addendum split real, not cosmetic.** When adding upgrade
content, ask first whether it's true for any VCF upgrade or specific to
VxRail (or a future second hardware platform). General content goes in
`01-overview.md` (or a numbered `docs/NN-*.md` – see the next rule);
hardware-specific content goes in its own addendum doc, cross-linking back
to the general step it modifies or extends rather than repeating it.

**Promote a topic to its own `docs/NN-*.md` when it would bloat
`01-overview.md`.** `01-overview.md` is the spine – phase list, prerequisites,
conditional-phase table, validation. When a conditional workstream needs more
than a table row plus a short subsection (roughly: a full procedure,
prerequisites, and version detail), give it its own numbered doc. Number by
position in the flow where it helps (`02-disaster-recovery.md` runs before
the core, `03-identity-broker-migration.md` after). Add it to
`web/src/nav.ts` and the `README.md` contents table. A short subsection *in*
the overview is fine while a topic is still small.

**The overview always links to the guides.** `01-overview.md` is the entry
point – every promoted `docs/NN-*.md` keeps a one- or two-line summary plus a
link in the overview, at the point in the flow where it slots in (the
conditional-phase table row and, where it warrants it, a short pointer
paragraph). A guide is reached *through* the overview, never orphaned.

---

## Prose style

- **No em-dashes (codepoint U+2014).** Use a spaced en-dash (U+2013) for
  parenthetical breaks and ranges, or restructure the sentence. Applies to
  all hand-written prose: `docs/`, `reference/`, `README.md`, `CHANGELOG.md`,
  `CLAUDE.md`, and the repo-root config files. Check before committing (PCRE
  escape, so this file stays clean):

  ```bash
  grep -rn $'\xe2\x80\x94' --include='*.md' --include='*.yml' . | grep -v node_modules
  ```

  Known follow-up: a few em-dashes remain in `web/` source (comments plus two
  visible strings in `src/pages/`); clear them in a dedicated `web/` change
  with a local preview, per the web-preview rule.

---

## Author

| Field | Value                          |
| ----- | ------------------------------ |
| Name  | Paul van Dieen                 |

---

## Customer data hygiene

This repo is **public** – never commit real customer names, IPs, hostnames,
credentials, or serial numbers – use generic placeholders. Per-engagement
working files (filled checklists, actual upgrade logs with customer
identifiers, case numbers) belong **outside** this repo entirely, in
separate per-engagement storage.

The repo holds the generalized procedure only; per-engagement storage
holds what actually happened at a specific customer.

**Customer data is never used with Claude on this repo, period, no
exceptions.** No real customer names, IPs, hostnames, credentials, or
other identifying details are ever entered into a Claude session while
working on this repo – not in chat text, not in a screenshot.

---

## Pre-commit checklist

1. **`CHANGELOG.md`** – new entry at the **TOP** (newest first). **Max 10
   values on EVERY version component** (`.0`–`.9`, never `.10`): after patch
   `.9` roll the minor (`0.3.9` → `0.4.0`), after minor `.9` roll the major
   (`0.9.9` → `1.0.0`).
2. **README.md** – keep in sync if files are added/moved/removed.
3. Confirm no real customer data leaked in (use generic placeholders only).
4. Confirm new content actually belongs where it landed (general vs.
   hardware-addendum) – see the File layout note above.
5. **No em-dashes** – see the Prose style section for the check.

---

## GitHub issues discipline

Same convention as `VCF9-DeploymentPlanning`: every bug, fix, idea, or doc
edit gets an issue on the primary tracker (**GitLab**, since GitLab is
primary here – see Git remotes below) – even if fixed in the same session.
Open the issue **before** starting the work. Always ask "who requested
this?" before filing – apply the matching label rather than guessing.

---

## Git remotes

GitLab remains primary for commit history and ITQ-internal issue tracking;
GitHub is now also a real hosting target, not just a backup mirror – it
serves the **public** site.

| Remote   | URL                                                               | Status                                              |
| -------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `origin` | `https://gitlab.msp.itq.eu/ugt_con_sddc_nl/vcfupgradeguide.git`   | **Primary** – internal ITQ GitLab, issue tracking     |
| `github` | `https://github.com/pauldiee/VCFUpgradeGuide.git`                 | **Public** – hosts docs.hollebollevsan.nl via GitHub Pages |

`main` tracks `origin/main` (GitLab). To push commits to both remotes use the
`pushall` alias (configured locally on this repo):

```bash
git pushall   # equivalent to: git push origin && git push github
```

Regular `git push` only goes to `origin` (GitLab).

## CI / Pages deploys

Two independent deploys, both driven off `main`:

- `.gitlab-ci.yml` – builds `web/` and publishes to **internal GitLab
  Pages**, for ITQ-internal use.
- `.github/workflows/pages.yml` – builds `web/` and publishes to **public
  GitHub Pages** under the custom domain in `web/public/CNAME`
  (`docs.hollebollevsan.nl`). This is the public-facing site.

Both read `SITE_URL` / `SITE_BASE` at build time (see `web/astro.config.mjs`)
so cross-links resolve correctly regardless of which one is serving.
