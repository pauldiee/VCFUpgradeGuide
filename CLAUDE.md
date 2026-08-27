# VCFUpgradeGuide — Claude Code Context

> Auto-loaded by Claude Code. Conventions for any collaborator's Claude instance working in this repo.

---

## Project overview

ITQ Consulting Services (internal, private) guidance for planning a **VCF
upgrade** — pre-upgrade checks, the upgrade sequence, and post-upgrade
validation, applicable **regardless of underlying hardware**.
Hardware/HCI-specific extra steps are layered on **top** of the general flow
as their own addendum, not baked into it — currently **Dell VxRail**
(started from a specific customer engagement: VxRail 5.2 → VCF 9.1.1, but
the general guidance should stay reusable beyond that one engagement).

Unlike `VCF9-DeploymentPlanning` (public, generic field guide for
from-scratch deployment), this repo is **internal by default**. Scaffolded
2026-08-27 from that repo's conventions (doc/site structure, changelog
discipline, GitHub/GitLab issues discipline) — see that repo's `CLAUDE.md`
for the fuller version of these rules if something here is ambiguous.

**Cross-reference, don't duplicate.** `VCF9-DeploymentPlanning` holds
foundational VCF9 knowledge that's directly useful during an upgrade (fleet
shutdown/startup ordering, firewall ports, certificate-authority setup, SSO
config, Day-N component removal). Link to it rather than copying its content
here — see the Related repo section in `README.md`.

---

## File layout

| Path                 | Purpose                                                       |
| --------------------- | -------------------------------------------------------------- |
| `README.md`           | Project overview + link to the related deployment-planning repo |
| `CHANGELOG.md`        | Per-release notes; **newest entry at TOP**                    |
| `CLAUDE.md`           | This file                                                     |
| `.gitignore`          | Excludes customer artifacts                                   |
| `docs/01-overview.md` | General VCF upgrade guidance (any hardware)                    |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps, on top of the general flow |
| `reference/`          | Pinned reference material (Dell/VMware docs, KBs, etc.)        |
| `tools/`              | Helper scripts, if any get added                               |
| `web/`                | ITQ-branded Astro site (GitLab Pages, internal) rendering `docs/` in place |
| `.gitlab-ci.yml`      | GitLab Pages deploy — the primary hosting for this repo         |

**Keep the general/addendum split real, not cosmetic.** When adding upgrade
content, ask first whether it's true for any VCF upgrade or specific to
VxRail (or a future second hardware platform). General content goes in
`01-overview.md` (or a future `02-*.md` etc. as the general flow grows);
hardware-specific content goes in its own addendum doc, cross-linking back
to the general step it modifies or extends rather than repeating it.

---

## Author

| Field | Value                          |
| ----- | ------------------------------ |
| Name  | Paul van Dieen                 |

---

## Customer data hygiene

Even though this repo is **internal / private**, do not commit real customer
names, IPs, hostnames, credentials, or serial numbers — use generic
placeholders. Per-engagement working files (filled checklists, actual
upgrade logs with customer identifiers, case numbers) belong **outside** the
repo, in:

```
C:/Users/paul/OneDrive - ITQ/<customer>/VCFUpgradeGuide/
```

The repo holds the generalized procedure; the OneDrive folder holds what
actually happened at a specific customer.

---

## Pre-commit checklist

1. **`CHANGELOG.md`** — new entry at the **TOP** (newest first). **Max 10
   values on EVERY version component** (`.0`–`.9`, never `.10`): after patch
   `.9` roll the minor (`0.3.9` → `0.4.0`), after minor `.9` roll the major
   (`0.9.9` → `1.0.0`).
2. **README.md** — keep in sync if files are added/moved/removed.
3. Confirm no real customer data leaked in (use generic placeholders only).
4. Confirm new content actually belongs where it landed (general vs.
   hardware-addendum) — see the File layout note above.

---

## GitHub issues discipline

Same convention as `VCF9-DeploymentPlanning`: every bug, fix, idea, or doc
edit gets an issue on the primary tracker (**GitLab**, since GitLab is
primary here — see Git remotes below) — even if fixed in the same session.
Open the issue **before** starting the work. Always ask "who requested
this?" before filing — apply the matching label rather than guessing.

---

## Git remotes

This repo is set up the **opposite way round** from `VCF9-DeploymentPlanning`
— **GitLab is primary**, because it hosts the internal Pages site this repo
needs.

| Remote   | URL                                                                          | Status                    |
| -------- | ----------------------------------------------------------------------------- | -------------------------- |
| `origin` | `https://gitlab.msp.itq.eu/ugt_con_sddc_nl/vcfupgradeguide.git`               | **Primary** — internal ITQ GitLab |
| `github` | `https://github.com/pauldiee/VCFUpgradeGuide.git`                             | Private mirror (backup, not customer-facing) |

`main` tracks `origin/main` (GitLab). To push commits to both remotes use the
`pushall` alias (configured locally on this repo):

```bash
git pushall   # equivalent to: git push origin && git push github
```

Regular `git push` only goes to `origin` (GitLab).

## CI / Pages deploys

`.gitlab-ci.yml`'s `pages` job builds `web/` and publishes to GitLab Pages —
this is the **primary** way this repo's content gets shared internally. No
equivalent GitHub Actions workflow exists (the GitHub remote is a private
backup mirror, not a hosting target).
