# Changelog

## v0.4.2 – 2026-08-28
- **Folded a full VxRail 5.2.2 → VCF 9.1 planning cycle into the docs** (issue
  #13). `docs/01-overview.md`: generalised the "source patch level matters"
  note into a per-component principle (the *newest* patch often has no 9.x
  path yet – e.g. VCF Operations 8.18.7, Operations for Networks 6.14.3, SDDC
  Manager 5.2.4.0 – so patching to latest as "prep" can strip the qualified
  path); added the two interop-matrix tools; a point release re-qualifies both
  source and target; VCF 9 licensing is subscription-only via the VCF Business
  Services console; Phase 1 now covers the unified Cloud Proxy (legacy 8.18
  proxies do not upgrade in place), Operations for Logs having no in-place
  path, and vRSLCM being left behind; new **Disaster Recovery Products in
  detail** section (combined Protection and Recovery appliance, convergence
  for VLSR 9.0.2.3 and earlier, the 9.0.2.2 Converge floor, the bridge-version
  reason DR goes first, Enhanced vSphere Replication prerequisites, the
  per-site Converge procedure); new **Identity: VIDM → VCF Identity Broker**
  section (9.1's users/groups migration script vs. what is rebuilt by hand).
- **Built out `docs/vxrail-addendum.md`** from a stub: the Dell-coordinated
  release stream and minimum source; the 9.x architecture change (SDDC Manager
  decoupled from VxRail Manager, the new hardware-lifecycle component, vLCM
  mandatory, single codebase); the VxRail Manager → VxRail Operations Manager
  conversion; unsupported deployment types (stretched / dynamic / 2-node /
  satellite); the Dell RPS engagement – Technical Consultation output, the
  11-step order with the Customer / Dell RPS responsibility split, the
  credential list; and a table of which general phases it replaces or wraps.
- **`reference/sources.md`:** added the interoperability matrix as a first-class
  tool; the Protection and Recovery "Convergence and Upgrade" guide; the
  identity migration guide; Broadcom KB 408127 / 313905 / 306446; the Dell
  KBs (000478885, 000021470) and the RPS Customer Preparation Guide; and notes
  on what the planner data does not model (SRM versions, VIDM, VxRail).
- **New `docs/02-identity-broker-migration.md`:** the VIDM / Workspace ONE
  Access → VCF Identity Broker transition as its own doc (not a subsection) –
  no in-place upgrade, the parallel-run model, the documented Access Control
  group-import procedure, what does not carry (directory / IdP connection,
  federation, MFA policies, branding, WS1A flows), the "embedded → instance"
  migration it is *not*, and the open items on the release-notes "script".
  The overview's Identity subsection is slimmed to a pointer; added to the
  site nav and the README.
- **`docs/01-overview.md` navigation and depth:** added a **Contents** list, a
  **"What changes in VCF 9.x"** primer (fleet construct, Management Services,
  subscription licensing, Identity Broker, vLCM-only, unified Cloud Proxy,
  behaviour changes), and a **"Windows, ordering and rollback"** section
  (sequential method, attended / unattended window split, safe stopping
  points, per-phase backout position, prechecks as a loop). Added an
  Operations for Networks row to the conditional phases and expanded
  post-upgrade validation (certificates, identity, integrations, DR re-test,
  backups).
- **`web/`:** the "On this page" nav now nests H3 sub-topics under the H2
  flow, so the longer overview is navigable to a specific phase.

## v0.4.1 – 2026-08-27
- **Adopted a no-em-dash prose rule.** Converted every em-dash (U+2014) to a
  spaced en-dash (U+2013) across `CLAUDE.md`, `README.md`, `CHANGELOG.md`,
  `docs/`, `reference/`, `.gitignore`, and `.gitlab-ci.yml`; documented the
  rule in `CLAUDE.md` (new "Prose style" section + pre-commit checklist
  item), with the byte-escape check command. A few em-dashes remain in
  `web/` source (comments + two visible `src/pages/` strings) and are logged
  as a follow-up to clear in a dedicated `web/` change with local preview.

## v0.4.0 – 2026-08-27
- **Drafted `docs/01-overview.md`** – the general (hardware-agnostic) VCF
  upgrade flow, built on the planner-verified 9-phase / 10-step core spine:
  how-to-use, a "Before you start" section (supported source paths, pinning a
  target build with a note that **VCF 9.1.1 is imminent but not yet
  released** – resolve "9.1.1" to a concrete build and re-run the planner
  once GA, prerequisites/guardrails table, pre-upgrade precheck), the nine
  phases with per-phase gotchas and "before moving on" checks, a table of the
  conditional phases that optional components insert (Avi + License Hub, SRM,
  HCX, NSX Global Manager, NSX Edge, Log Management, vSAN File Service),
  post-upgrade validation, and cleanup/decommission. Phase 7 (ESX/host
  cluster) cross-links the VxRail addendum as its replacement. Version
  numbers/sizes flagged as planner-derived (target 9.1.0.0400), pending
  verbatim TechDocs confirmation.

## v0.3.0 – 2026-08-27
- **Added `reference/sources.md`** – pinned index of authoritative source
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

## v0.2.0 – 2026-08-27
- **Renamed the repo `VCFVxRailUpgrade` → `VCFUpgradeGuide`** (both GitLab
  and GitHub remotes) and rescoped it: **general VCF upgrade guidance**
  (pre-upgrade, execution, post-upgrade validation, applicable regardless of
  underlying hardware), with hardware/HCI-specific extra steps layered on
  top as their own addendum – currently `docs/vxrail-addendum.md`. Updated
  site branding, nav, README, and CLAUDE.md accordingly. Added a Related
  repo section pointing at `VCF9-DeploymentPlanning` for foundational VCF9
  knowledge (shutdown/startup runbook, firewall ports, cert-authority setup,
  SSO config, Day-N component removal) rather than duplicating it here.

## v0.1.0 – 2026-08-27
- **Initial scaffold** – repo created for a Dell VxRail 5.2 → VCF 9.1.1
  customer upgrade engagement. Astro site scaffolding adapted from
  `VCF9-DeploymentPlanning`'s conventions (doc-rendering site, GitLab Pages
  CI, changelog/versioning discipline). GitLab set up as the primary remote
  (internal Pages hosting); GitHub is a private backup mirror. No upgrade
  content yet – `docs/overview.md` is a placeholder.
