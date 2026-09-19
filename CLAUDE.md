# VCFUpgradeGuide – Claude Code Context

> Auto-loaded by Claude Code. Conventions for any collaborator's Claude instance working in this repo.

---

## Project overview

ITQ guidance for planning a VMware upgrade, split into **three tracks**
depending on what licensing layer is actually driving the fleet:

- **Full VCF** – SDDC Manager / VCF Management Services / Fleet Management
  drives the upgrade end to end.
- **Standalone VVF** (VMware vSphere Foundation, no VCF Management
  Services) – vCenter/ESXi are patched with standard vSphere lifecycle
  mechanisms instead of SDDC-Manager-driven phases.
- **Standalone vSphere** – no VCF or VVF entitlement at all. Broadcom
  documents the *same* upgrade procedure for this as for standalone VVF
  (License Server included), so this track would reuse that content rather
  than getting an invented, undocumented one – see
  `docs/12-vsphere-standard-upgrade.md`. **Currently held back off the live
  site** (no picker card, no `/vsphere/` landing page, no nav entry –
  excluded from the `web` content collection in `content.config.ts`) since
  there's nothing distinct to show yet; the doc file stays in the repo. See
  the exclusion comments in `content.config.ts` and `nav.ts` to bring it
  back.

Each track covers pre-upgrade checks, the upgrade sequence, and
post-upgrade validation, applicable **regardless of underlying hardware**.
Hardware/HCI-specific extra steps are layered on **top** of any track as
their own addendum, not baked into it – currently **Dell VxRail** (started
from a specific customer engagement: VxRail 5.2 → VCF 9.1.1, but the
general guidance should stay reusable beyond that one engagement;
VxRail's addendum currently assumes full VCF, since it depends on SDDC
Manager talking to VxRail Manager).

The site (`web/`) surfaces this as landing pages – currently `/vcf/` and
`/vvf/` are live (`/vsphere/` pending, see above) – each showing only the
docs tagged for that track via `web/src/nav.ts`'s `tracks` field. Every
doc's track applicability should stay accurate there; when adding a doc,
decide up front which track(s) it applies to rather than defaulting to
"all". **Each track leads with its own dedicated phase-by-phase doc**
(`docs/13-vcf-upgrade-sequence.md` for VCF, `docs/14-standalone-vvf-upgrade.md`
for VVF) rather than a shared one – `01-overview.md` only holds what's
genuinely common (confirming a path, pinning a build) plus a pointer to
the two. This was a deliberate split (2026-09-18): a single combined
"Overview" doc meant both track landing pages funneled into the same wall
of text regardless of which track the reader picked, defeating the point
of the split. If a future addition would apply to only one track, put it
in that track's own doc (or a new `docs/NN-*.md` promoted from it), not
back into the shared `01-overview.md`.

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
| `docs/01-overview.md` | Shared router – confirm a supported path, pin a target build, pick a track (any hardware) |
| `docs/02-disaster-recovery.md` | SRM / vSphere Replication → Protection and Recovery convergence (pre-upgrade prep; VCF, VVF, or pre-9 vSphere) |
| `docs/03-identity-broker-migration.md` | VIDM / Workspace ONE Access → VCF Identity Broker (post-upgrade; **VCF only**, needs VCF Management Services) |
| `docs/04-field-notes.md` | Known issues and gotchas from real upgrades (reference) |
| `docs/05-operations-modernization.md` | Aria Operations → VCF Operations, Phase 1 (phase guide; VCF or VVF) |
| `docs/06-iwa-ldaps-migration.md` | IWA → AD-over-LDAPS migration before Phase 6, with a permissions/roles backup (pre-upgrade prep; VCF, VVF, or standalone vSphere) |
| `docs/07-vcenter-manual-upgrade.md` | Manual GUI vCenter upgrade, Phase 6 alternate path (phase guide; VVF or standalone vSphere, no Fleet Management) |
| `docs/08-vss-to-vds-migration.md` | VSS → VDS migration before extending standalone VVF to full VCF (pre-upgrade prep; **VVF only**) |
| `docs/09-avi-license-hub-upgrade.md` | Avi Load Balancer + License Hub upgrade, before SDDC Manager (phase guide; VCF or VVF, if Avi is in use) |
| `docs/10-nsx-edge-finalize.md` | NSX Edge cluster upgrade + NSX finalize, replacing plain Phase 8 (phase guide; VCF or VVF) |
| `docs/11-log-management-migration.md` | VCF Operations for Logs → Log Management 9.1, after NSX finalize (phase guide; VCF or VVF) |
| `docs/12-vsphere-standard-upgrade.md` | Standalone vSphere track landing doc – points at `docs/14`'s procedure rather than duplicating it (**vSphere-standard only**; excluded from the live site for now, see Project overview above) |
| `docs/13-vcf-upgrade-sequence.md` | The full-VCF 9-phase spine, prerequisites, conditional phases, post-upgrade validation, cleanup (**VCF only**) – what `01-overview.md` used to contain directly |
| `docs/14-standalone-vvf-upgrade.md` | The standalone-VVF 6-step manual procedure, no VCF Management Services (**VVF only**) – ditto |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps, on top of the general flow (hardware addendum; **VCF only**) |
| `reference/`          | Pinned reference material (Dell/VMware docs, KBs, etc.)        |
| `tools/`              | Helper scripts, if any get added                               |
| `web/`                | ITQ-branded Astro site rendering `docs/` in place, dual-deployed (public + internal); `src/pages/{vcf,vvf,vsphere}.astro` are the three track landing pages |
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
edit gets an issue on the primary **issue tracker**, which is **GitHub
Issues** (since 2026-09-19, to match `origin` – see [Git
remotes](#git-remotes) below) – even if fixed in the same session. Open the
issue **before** starting the work, with `gh issue create --repo
pauldiee/VCFUpgradeGuide`. Always ask "who requested this?" before filing –
apply the matching label rather than guessing.

---

## Git remotes

**`origin` is GitHub** (since 2026-09-19) – plain `git push`/`git pull`
default there, and it's also the primary **issue tracker** (see [GitHub
issues discipline](#github-issues-discipline) above). GitLab stays in the
loop for internal-ITQ Pages hosting and as a secondary push target only –
it is no longer where issues get filed.

| Remote   | URL                                                               | Status                                                      |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `origin` | `https://github.com/pauldiee/VCFUpgradeGuide.git`                 | **Primary** – plain push/pull target, issue tracker; hosts docs.hollebollevsan.nl via GitHub Pages |
| `gitlab` | `https://gitlab.msp.itq.eu/ugt_con_sddc_nl/vcfupgradeguide.git`   | Internal ITQ GitLab – internal Pages mirror only                |

`main` tracks `origin/main` (GitHub). To push commits to both remotes use the
`pushall` alias (configured locally on this repo):

```bash
git pushall   # equivalent to: git push origin && git push gitlab
```

Regular `git push` only goes to `origin` (GitHub).

## CI / Pages deploys

Two independent deploys, both driven off `main`:

- `.gitlab-ci.yml` – builds `web/` and publishes to **internal GitLab
  Pages**, for ITQ-internal use.
- `.github/workflows/pages.yml` – builds `web/` and publishes to **public
  GitHub Pages** under the custom domain in `web/public/CNAME`
  (`docs.hollebollevsan.nl`). This is the public-facing site.

Both read `SITE_URL` / `SITE_BASE` at build time (see `web/astro.config.mjs`)
so cross-links resolve correctly regardless of which one is serving.
