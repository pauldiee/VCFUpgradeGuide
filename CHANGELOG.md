# Changelog

## v0.4.0 — 2026-08-27
- **Drafted `docs/01-overview.md`** — the general (hardware-agnostic) VCF
  upgrade flow, built on the planner-verified 9-phase / 10-step core spine:
  how-to-use, a "Before you start" section (supported source paths, pinning a
  target build with a note that **VCF 9.1.1 is imminent but not yet
  released** — resolve "9.1.1" to a concrete build and re-run the planner
  once GA, prerequisites/guardrails table, pre-upgrade precheck), the nine
  phases with per-phase gotchas and "before moving on" checks, a table of the
  conditional phases that optional components insert (Avi + License Hub, SRM,
  HCX, NSX Global Manager, NSX Edge, Log Management, vSAN File Service),
  post-upgrade validation, and cleanup/decommission. Phase 7 (ESX/host
  cluster) cross-links the VxRail addendum as its replacement. Version
  numbers/sizes flagged as planner-derived (target 9.1.0.0400), pending
  verbatim TechDocs confirmation.

## v0.3.0 — 2026-08-27
- **Added `reference/sources.md`** — pinned index of authoritative source
  material for the general upgrade guidance: Broadcom TechDocs upgrade-guide
  tree, the 9.1 release-notes upgrade-sequence page, KB 440630 (sequence +
  known issues), the VMware VCF Upgrade Planner tool/repo, and supplementary
  (non-authoritative) blog walkthroughs for 5.2.x→9.1 and 9.0.x→9.1.
- **Captured the VCF Upgrade Planner output** for the engagement shape (VCF
  5.2 + VxRail HCI → Create New VCF 9.1 Fleet, target 9.1.0.0400) into
  `reference/sources.md`: the add-on compatibility gate (only VCF **5.2.2**
  has a supported direct path; no "9.1.1" build exists in the tool), the
  9-phase / 10-step core sequence with per-phase IP/size/rollback notes, and
  how optional components (SRM, Avi + License Hub, HCX, NSX Federation, Log
  Management, vSAN File Service) expand it to 15 phases / 17 steps. Phase
  ordering is now planner-verified; per-phase procedure detail still needs
  verbatim TechDocs confirmation before entering `docs/`.

## v0.2.0 — 2026-08-27
- **Renamed the repo `VCFVxRailUpgrade` → `VCFUpgradeGuide`** (both GitLab
  and GitHub remotes) and rescoped it: **general VCF upgrade guidance**
  (pre-upgrade, execution, post-upgrade validation, applicable regardless of
  underlying hardware), with hardware/HCI-specific extra steps layered on
  top as their own addendum — currently `docs/vxrail-addendum.md`. Updated
  site branding, nav, README, and CLAUDE.md accordingly. Added a Related
  repo section pointing at `VCF9-DeploymentPlanning` for foundational VCF9
  knowledge (shutdown/startup runbook, firewall ports, cert-authority setup,
  SSO config, Day-N component removal) rather than duplicating it here.

## v0.1.0 — 2026-08-27
- **Initial scaffold** — repo created for a Dell VxRail 5.2 → VCF 9.1.1
  customer upgrade engagement. Astro site scaffolding adapted from
  `VCF9-DeploymentPlanning`'s conventions (doc-rendering site, GitLab Pages
  CI, changelog/versioning discipline). GitLab set up as the primary remote
  (internal Pages hosting); GitHub is a private backup mirror. No upgrade
  content yet — `docs/overview.md` is a placeholder.
