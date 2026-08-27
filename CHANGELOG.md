# Changelog

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
