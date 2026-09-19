# Changelog

## v0.9.8 – 2026-09-19
- **Flag untested PowerCLI snippets.** Added an "Untested" callout above the
  scripts in `08-vss-to-vds-migration.md` and `13-vcf-upgrade-sequence.md`
  (v0.9.7) – neither has run against a live vCenter yet. Standing policy
  going forward: any posted code not yet field-verified gets this callout
  until it's confirmed working (field or lab), per author direction.

## v0.9.7 – 2026-09-19
- **Add PowerCLI snippets to the steps that had none.** `08-vss-to-vds-migration.md`'s
  VSS inventory step had no scriptable path at all (there is no vCenter
  export API for standard switches, unlike `Export-VDPortGroup` on a VDS) –
  added a PowerCLI script covering port groups, VLAN, security policy,
  teaming, MTU, and VMkernel adapters, as its own `### Inventory script
  (PowerCLI)` subsection rather than buried under a bullet. Also added a
  build/VMware-Tools/vSAN-on-disk-format PowerCLI spot-check to the
  post-upgrade validation checklists in `13-vcf-upgrade-sequence.md` and
  `14-standalone-vvf-upgrade.md`. Left the rest of `docs/` as-is – most
  remaining steps are genuinely GUI- or vendor-tool-driven (SDDC Manager,
  Avi Controller, Dell RPS) with no Broadcom-documented CLI/API equivalent
  to verify against.

## v0.9.6 – 2026-09-18
- **Fix every internal doc-to-doc link on the live site.** `astro.config.mjs`'s
  link rewriter built hrefs as `${BASE}/docs/<slug>/`, and both deploy
  targets set `SITE_BASE` to a value with **no trailing slash stripped**
  (GitHub Pages: `/`; GitLab Pages: a path prefix) – so on a root deploy
  the result was `//docs/<slug>/`, a **protocol-relative URL** the browser
  resolves as host `docs` (`ERR_NAME_NOT_RESOLVED`) instead of a
  same-origin path. This broke every markdown cross-link and code-span
  auto-link between docs on both live deploys, not just the two new
  track docs that surfaced it. Fixed by stripping trailing slashes from
  `BASE` before building hrefs, mirroring `lib/path.ts`'s existing
  `withBase()`. Verified against both `SITE_BASE=/` (GitHub Pages) and a
  `SITE_BASE=/<project>` prefix (GitLab Pages).

## v0.9.5 – 2026-09-18
- **Split `01-overview.md`'s phase-by-phase content into two track-specific
  docs.** Both the `/vcf/` and `/vvf/` landing pages led with the same
  giant `01-overview.md` "Overview" card, so filtering the rest of the
  grid by track didn't actually stop either reader from hitting the same
  wall of text. New `docs/13-vcf-upgrade-sequence.md` (the full 9-phase
  spine, prerequisites, conditional phases, post-upgrade validation,
  cleanup) and `docs/14-standalone-vvf-upgrade.md` (the 6-step manual
  procedure) now hold that content; `01-overview.md` is a lean shared
  router (confirm a path, pin a build, pick a track). Both new docs are
  placed right after `01-overview` in `web/src/nav.ts`'s `NAV` array with
  `tracks: ['vcf']` / `['vvf']` respectively, so each track's landing page
  now leads with its own dedicated procedure doc instead of the shared
  one. Every cross-reference into the old anchors (`#phase-N-...`,
  `#vvf-confirm-whether-...`, `#conditional-phases-...`, etc.) across
  `docs/02` through `12`, `vxrail-addendum.md`, and `README.md` updated to
  point at the new docs.

## v0.9.4 – 2026-09-18
- **Hold the standalone-vSphere track back off the live site.** It has no
  content of its own yet – `docs/12-vsphere-standard-upgrade.md` is just a
  pointer into the standalone-VVF procedure – so shipping a `/vsphere/`
  landing page felt like an empty track. Excluded
  `12-vsphere-standard-upgrade.md` from the `web` content collection
  (`web/src/content.config.ts`), dropped its `nav.ts` entry and its picker
  card on `index.astro`, and removed the now-dead `web/src/pages/vsphere.astro`
  route and the dangling `/vsphere/` cross-links on the `vcf.astro` /
  `vvf.astro` landing pages. The doc file itself stays in the repo
  (still readable on GitHub/GitLab); each excluded spot has a comment
  pointing at the others so the track is easy to bring back once it has
  real content.

## v0.9.3 – 2026-09-18
- **Split the guide into three tracks: full VCF, standalone VVF, and a new
  standalone-vSphere track.** The site's flat card grid tried to serve
  every reader at once; now `/vcf/`, `/vvf/`, and `/vsphere/` landing
  pages each show only the docs relevant to that situation, via a new
  required `tracks` field on `web/src/nav.ts`'s `NavItem`. `index.astro`
  becomes a track picker, with the previous full grid demoted to a
  collapsed "Browse all docs" fallback. New shared `NavCard.astro`
  component avoids duplicating card markup three times over.
  New: `docs/12-vsphere-standard-upgrade.md` – a thin landing doc for the
  standalone-vSphere track. Broadcom documents the *same* upgrade
  procedure for plain vSphere as for standalone VVF (License Server
  included, per Broadcom's "Upgrading vSphere 8 and Optionally vSAN and
  Aria Operations 8 to 9.1"), so this doc routes into the existing
  standalone-VVF section of `01-overview.md` rather than inventing a
  separate, undocumented spine. `CLAUDE.md` and `README.md` updated to
  frame the repo around three tracks instead of a VCF/VVF split, and the
  file-layout tables brought up to date with `docs/08-11` (merged
  previously but not yet listed there).

## v0.9.2 – 2026-09-18
- **Promote three conditional-phase sections out of `01-overview.md` into
  their own docs.** Per the promotion rule, each had grown past a table
  row plus a short subsection: `docs/09-avi-license-hub-upgrade.md` (Avi
  Load Balancer + License Hub, before SDDC Manager),
  `docs/10-nsx-edge-finalize.md` (NSX Edge cluster upgrade + finalize,
  after the host phase), and `docs/11-log-management-migration.md` (VCF
  Operations for Logs to Log Management 9.1, after NSX finalize).
  `01-overview.md`'s conditional-phase table, TOC, and companion-docs list
  now link out instead of carrying the full detail; `web/src/nav.ts` and
  `README.md` updated to match.

## v0.9.1 – 2026-09-18
- **`docs/01-overview.md`: document the VSS→VDS prerequisite for
  standalone VVF extending to full VCF.** New note in the "VVF: confirm
  whether VCF Management Services is even in scope" section – VVF itself
  has no distributed-switch requirement, but full VCF does, for two
  independent reasons: NSX 4.0+ (shipped in VCF 9) only supports VDS for
  ESXi transport nodes (N-VDS removed), and SDDC Manager / VCF Operations
  Fleet Management's workload-domain automation only creates/manages
  clusters on VDS, with no VSS option. A VSS-based standalone VVF fleet
  heading toward full VCF needs this scoped as its own prerequisite step.

## v0.9.0 – 2026-09-18
- **`docs/06-iwa-ldaps-migration.md`: fix the CLI Leave AD fallback to
  actually reach Active Directory.** The documented command
  (`domainjoin-cli leave <DomainName.com>`, no credentials) only disjoins
  the appliance locally – per the `domainjoin-cli` man page, *"If no
  credentials are specified, the machine will no longer behave as a member
  of domain but its machine account will remain enabled in AD."* Adds
  `<username> <password>` to the documented command and a note that even
  with credentials the tool only disables the AD object, not deletes it.
  Step 7 (cleanup) reworded to state plainly it's required regardless of
  which method (UI or CLI) was used, not just a tidiness step.

## v0.8.9 – 2026-09-18
- **`docs/06-iwa-ldaps-migration.md`: correct the Leave AD error root
  cause, link every Source inline.** Follow-up to v0.8.8 – field-verified
  the actual error text is `Idm client exception: Error trying to leave AD,
  error code [11]`, and field-confirmed the cause is an unsupported
  down-level username format (`DOMAIN\user`), not a missing AD delegated
  permission. Per Broadcom KB 399350 (documented for the join operation,
  now confirmed to apply on leave too): use `user@domain` (UPN format)
  instead. The delegated-rights note from v0.8.8 is kept as a secondary
  check, not the primary cause. Also adds an inline link at every point a
  KB/TechDocs source is cited in the body, not just in the trailing
  Sources list.

## v0.8.8 – 2026-09-18
- **`docs/06-iwa-ldaps-migration.md`: fix step ordering for same-AD-domain
  migrations, document AD-leave rights.** Field-reported: adding the
  AD-over-LDAPS identity source while the IWA source for the same domain
  still exists fails with "connection already exists" (per Broadcom
  KB 316596, vCenter SSO doesn't allow two identity sources against one AD
  domain at once). Reordered steps 2-4: confirm a
  `administrator@vsphere.local` fallback login works, remove IWA, then add
  and verify LDAPS immediately after, instead of add-then-remove. Also adds
  a "Required rights" note to the Leave AD step – field-reported "Unable to
  leave: insufficient rights" traces to the AD-side delegated
  create/delete-computer-object permission on the target OU (KB 322859),
  separate from the vCenter-side SystemConfiguration.Administrators
  requirement.

## v0.8.7 – 2026-09-18
- **`docs/04-field-notes.md`: add per-APIC-train version support for the
  ACI/vSphere 8/9 entry.** Follow-up to v0.8.6 – the earlier entry flagged
  the per-cell certification grid as not extractable from the rendered page
  text; pulled it from the underlying `v-yes`/`v-no` cell data instead.
  vSphere 8.0 is supported on APIC 5.2(8), 5.3(1)-5.3(2), not 6.0(1)-6.0(2)
  (a gap in Cisco's own matrix), then 6.0(3) onward. VCF (vSphere) 9.0 is
  supported starting only at APIC 6.2(2)-6.2(3) - no earlier train, even
  ones that already support vSphere 8.0.

## v0.8.6 – 2026-09-18
- **`docs/04-field-notes.md`: document Cisco ACI (APIC/VMM) vSphere 8/9
  interop constraints.** New entry in "Open items to confirm" – VDS-based
  VMM domain integration is gated by Cisco's own ACI Virtualization
  Compatibility Matrix independent of the VCF interop matrix, quoting the
  matrix verbatim: VDS is required for every vSphere version including 9.0
  (listed there as "VCF (vSphere) 9.0"), and AVE (ACI Virtual Edge) is a
  confirmed hard blocker for both vSphere 8.0 and VCF 9.0, not just
  deprecated. Flags the per-APIC-train certification grid as not yet
  captured – it renders as interactive tooltips, not extractable text.

## v0.8.5 – 2026-09-17
- **`docs/04-field-notes.md`: document KB 455842 (Day-0-only worker nodes
  don't rightsize after a 9.1 → 9.1.1+ patch).** New "VCF Management
  Services Runtime" section – a brownfield patch from 9.1 to 9.1.1+ doesn't
  reconcile worker sizing for a management domain that hasn't had Log
  Management or Real-time Metrics added yet, leaving it on larger pre-patch
  worker VMs. Documents Broadcom's `rightsize-day0-workers.sh` remediation
  script and its worker-rollout/maintenance-window caveat.

## v0.8.4 – 2026-09-16
- **Add "rename the old vCenter appliance" step to `docs/07-vcenter-manual-upgrade.md`.**
  New section before Stage 1: rename the outgoing appliance first so the
  new appliance can be given the correct destination name at deployment
  time (Stage 1 step 5) instead of renaming it after cutover, and so the
  old and new appliances don't briefly share a name once the old one is
  powered off but not yet deleted.

## v0.8.3 – 2026-09-16
- **Fix Stage 2 step order in `docs/07-vcenter-manual-upgrade.md`.**
  Field-verified during a live Stage 2 walkthrough: the pre-upgrade check
  runs *after* reconnecting to the source appliance and source ESX
  host/vCenter, not before. The doc had them in the opposite order.

## v0.8.2 – 2026-09-16
- **Group guides into flow bands, tag VCF/VVF applicability.**
  `web/src/nav.ts`, the README Contents table, and CLAUDE.md's file-layout
  table now group each `docs/NN-*.md` guide by where it slots into the
  upgrade flow (pre-upgrade prep, phase guide, post-upgrade, reference,
  hardware addendum) instead of a flat "Guide" label, matching
  `VCF9-DeploymentPlanning`'s convention. Each guide also carries a
  VCF/VVF applicability tag, since VCF Management Services is optional for
  VVF and some guides (Identity Broker migration, the standalone vCenter
  manual upgrade) are scoped to one licensing model. Also fixes CLAUDE.md's
  file-layout table, which was missing docs 05–07.

## v0.8.1 – 2026-09-15
- **Shrink the landing-page hero.** The full-height hero (large title +
  intro paragraph + CTA button) read as if it were the whole site's
  identity, when it's really just the one guide in the new "VMware Docs"
  hub. Replaced with a one-line compact banner (`.hero--compact`) – eyebrow
  plus a single headline – so the guide-cards grid gets top billing.

## v0.8.0 – 2026-09-15
- **Repo goes public.** Dropped the "internal, private" / "ITQ Consulting
  Services" framing across `README.md`, `CLAUDE.md`, `docs/01-overview.md`,
  and the site (header, footer, landing page, PDF cover) in favor of plain
  **ITQ**. Site-wide brand renamed **VMware Docs** – this repo's content is
  its first section, with room for future non-upgrade, non-VCF-specific
  VMware guides without another rebrand.
- **New public deploy target.** `.github/workflows/pages.yml` builds and
  publishes to **GitHub Pages** under the custom domain in the new
  `web/public/CNAME` (`docs.hollebollevsan.nl`) – the `github` remote is no
  longer just a private backup mirror. Internal GitLab Pages
  (`.gitlab-ci.yml`) is unaffected and continues serving ITQ-internal use.
  `web/astro.config.mjs`'s comment updated to describe both deploy targets.
- Header's repo/feedback links repointed from the internal GitLab project
  to the public GitHub repo (issues, changelog blob link).
- **Explicit no-customer-data-with-Claude rule** added to `CLAUDE.md` and
  `docs/01-overview.md`'s Customer data hygiene section – a plain
  statement, appropriate for a public reader, that real customer names,
  IPs, hostnames, or credentials are never entered into a Claude session
  while working on this repo.

## v0.7.1 – 2026-09-15
- **Fix header/footer bleeding onto every printed page.** `.site-header`
  and `.site-footer` are `position: sticky` for normal browsing, and
  Chrome's print engine repeats sticky/fixed elements on every physical
  page instead of placing them once – the ITQ footer band was overlapping
  the tail of the doc content on page 1 of the "Print / Save as PDF"
  output. Fixed by hiding both elements wholesale in `@media print` rather
  than only their header-nav-links/footer-meta sub-pieces. Verified via a
  real `@media print`-emulated render (not just CSS review): both computed
  to `display: none`, and a Chromium print-to-PDF came out clean.

## v0.7.0 – 2026-09-15
- **Replaced the rasterized per-doc PDF download with native browser
  print.** The `html2pdf.js`/`html2canvas` approach kept hitting layout
  bugs (v0.6.9's page-break fix wasn't enough) because it fundamentally
  rasterizes the page into one image and slices it, rather than laying out
  real text. The **Print / Save as PDF** button on each doc page now just
  calls `window.print()`, reusing the site's existing `@media print` rules
  (`site.css`) – real text, correct pagination, small files, no CDN
  dependency. One extra click (the browser's print dialog) in exchange for
  actually-correct output. Removed the `html2pdf.js` CDN script and all
  the theme-forcing/canvas-slicing JS that came with it.

## v0.6.9 – 2026-09-15
- **Fix ugly page breaks in the per-doc PDF download.** The `html2pdf.js`
  slicer was cutting mid-table, mid-code-block, and mid-list-item since it
  only knew about `mode: ['css', 'legacy']` with no elements to avoid
  splitting. Added a `pagebreak.avoid` list (`pre`, `table`, `tr`,
  `blockquote`, `h1`–`h4`, `li`, `img`) so those elements now move to the
  next page as a whole instead of splitting across the boundary.

## v0.6.8 – 2026-09-15
- **Removed the whole-guide `/guide-pdf/` print page** and its header
  link – superseded by the per-doc **Download PDF** button on each guide
  page (v0.6.7), which is the workflow actually wanted. The local
  `npm run pdf` generator (`web/scripts/generate-pdf.mjs`) still covers
  the whole-guide-as-one-file case.

## v0.6.7 – 2026-09-15
- **Per-doc "Download PDF" button.** Each guide page
  (`web/src/pages/docs/[...slug].astro`) now has a button that generates
  and downloads *that single doc* as an actual PDF file straight to the
  browser's Downloads folder – no print dialog, no server/CI involved.
  Client-side via `html2pdf.js` (CDN, loaded on first click only), forcing
  light theme for the capture regardless of the viewer's current scheme.
  Verified end to end: `01-overview.md` → a correctly paginated 21-page
  PDF. Complements, rather than replaces, the whole-guide
  `/guide-pdf/` print page and the local `npm run pdf` generator.

## v0.6.6 – 2026-09-15
- **Live on-site printable guide.** New `web/src/pages/guide-pdf.astro`
  (`/guide-pdf/`), a single flattened page with every `NAV`-ordered doc in
  sequence and a page-break between each, plus a "Print / Save as PDF"
  button that calls the browser's own print. Entirely client-side – no
  build-time Chromium needed, so unlike `npm run pdf`
  (`web/scripts/generate-pdf.mjs`) this actually runs live on GitLab
  Pages. Linked from the site header (new **PDF** entry next to Search/
  Docs). Documented in `README.md`.

## v0.6.5 – 2026-09-15
- **Field-verified: GUI installer "invalid SSO credentials" gotcha.**
  `docs/07-vcenter-manual-upgrade.md` gets a new Stage 1 troubleshooting
  subsection covering seven failure modes that all produce the identical
  error at "Connect to source appliance" (clock skew, IP-vs-FQDN against
  the Machine SSL cert's SAN, custom SSO domain suffix, account lockout,
  credential-entry artifacts, and reading the real reason from the source
  appliance's own STS log). `docs/04-field-notes.md` gets a short
  cross-linked entry recording the confirmed root cause from a live
  engagement: a customized SSO domain suffix typed incorrectly, with every
  other candidate (reachability, cert thumbprint, root, SSO password,
  clock skew) independently ruled out first.

## v0.6.4 – 2026-09-15
- **`docs/07-vcenter-manual-upgrade.md`: CLI-driven upgrade alternative.**
  New section covering `vcsa-deploy` (the CLI installer bundled on the same
  ISO as the GUI wizard) as the closest supported "point it at the OVA
  file" alternative to Stage 1/Stage 2 of the interactive GUI upgrade:
  JSON template location, the `image` field pointing at
  `vcsa/VMware-vCenter-Server-Appliance-*_OVF10.ova`, the ASCII-only
  caveat, and the `--verify-template-only` / `--precheck-only` / upgrade
  command sequence. Explicitly distinguishes this from manually running
  "Deploy OVF Template" in the vSphere Client, which Broadcom TechDocs
  document only as the fresh-install flow, not a supported upgrade path.

## v0.6.3 – 2026-09-15
- **Customer-handoff PDF export.** `web/scripts/generate-pdf.mjs`
  (`npm run pdf`, new devDependencies `playwright` + `pdf-lib`) builds the
  site, renders a cover page plus every `NAV`-ordered doc through headless
  Chromium, and merges them into `web/dist-pdf/vcf-upgrade-guide.pdf` – a
  single file that can be handed to a customer, since the GitLab Pages site
  itself is internal-only. Local/on-demand only, not wired into
  `.gitlab-ci.yml` (the Pages runner is a bare shell executor with no
  Chromium). Added a `@media print` block to `site.css` (forces light
  scheme, drops header nav/sidebar/TOC/pager/copy-buttons) so the same
  rules also work for a reader's manual browser print-to-PDF. Documented
  in `README.md`.

## v0.6.2 – 2026-09-15
- **`docs/05-operations-modernization.md` clarification.** Explicit note in
  the in-place upgrade walkthrough's "Apply the upgrade" step: install the
  PAK against the running cluster, don't manually bring it online first –
  the Offline → Online transition happens automatically as part of the
  update. Also clarifies the separate manual take-offline/bring-online
  sequence applies only to the re-IP sub-procedure.

## v0.6.1 – 2026-09-15
- **New `docs/07-vcenter-manual-upgrade.md`** (issue #23). Manual GUI
  upgrade walkthrough for a standalone vCenter (no Fleet Management):
  Stage 1 (deploy the new appliance with a temporary network) and Stage 2
  (migrate data, cut over), plus the prerequisites (backup/snapshot, port
  22/443, DRS automation level, DNS/DHCP). Leads with the vCenter-specific
  back-in-time compatibility finding – 8.0 U3j and later has no path to any
  9.1.0.x or 9.0.x build, only to 9.1.1.0 (KB 448135, Upgrade Path tool) –
  and flags an unresolved discrepancy against the GUI installer TechDocs
  page's own "9.0 or later" wording, recommending validation before a
  production run. Cross-linked from `01-overview.md` (the VVF manual-upgrade
  path and the back-in-time callout), the README contents table, and
  `web/src/nav.ts`.

## v0.6.0 – 2026-09-14
- **New `docs/06-iwa-ldaps-migration.md`** (issue #22). Step-by-step
  walkthrough for moving a vCenter off Integrated Windows Authentication
  to AD-over-LDAPS before its Phase 6 upgrade: VM snapshot + VAMI
  file-based backup + a permissions/roles export (PowerCLI
  `Get-VIPermission`/`Get-VIRole`, plus Global Permissions separately) as
  the "role/rights specific backup", then add-and-verify the LDAPS
  identity source alongside the existing IWA one, reconcile permissions,
  remove IWA, leave the AD domain, and clean up the stale AD computer
  object. Includes a rollback note anchored to the pre-change snapshot.
  Cross-linked from `01-overview.md` Phase 6; added to the README contents
  table and `web/src/nav.ts`.

## v0.5.9 – 2026-09-14
- **`docs/05-operations-modernization.md` – add connected/disconnected
  licensing registration steps** (issue #21). Full numbered procedures for
  registering VCF Operations + License Server with the VCF Business
  Services console: connected mode (activation-code flow, 6-month
  recurring license update) and disconnected mode (JWS registration file,
  two-way verification/confirmation file exchange, 6-month recurring
  manual usage-report/license-update task instead of an automatic
  heartbeat). Cross-referenced from the in-place walkthrough's new
  License Server step so it isn't duplicated per path.

## v0.5.8 – 2026-09-14
- **`docs/05-operations-modernization.md` – expand into full numbered
  walkthroughs** (issue #20). Turned the summary bullets for both paths
  into step-by-step procedures: pre-upgrade snapshot/assessment, PAK
  install, and re-IP for the in-place path; OVA deployment + initial setup
  wizard, HA activation (deploy a Data node, then Activate under High
  Availability and select it as Replica – not a separate "deploy a
  Replica node" step), additional Data nodes, License Server deployment,
  Content Management export/import (Configuration before Content), data
  source registration, and fleet attach for the fresh-install path. Added
  a "when VCF Installer is the better fit instead" callout so the
  walkthrough doesn't read as the only route.

## v0.5.7 – 2026-09-14
- **New `docs/05-operations-modernization.md`** (issue #19). Promoted out of
  the Phase 1 discussion in `01-overview.md` into its own guide: Aria
  Operations to VCF Operations in-place upgrade vs. fresh-install-and-
  migrate-content decision, the Aria Operations re-IP procedure, deploying
  VCF Operations standalone without VCF Management Services, VCF
  Installer's HA-mode and converge prerequisites, HA vs. Continuous
  Availability (don't conflate a look-alike node/site count with an
  actual CA deployment), node-removal data-loss behavior, and registering
  vCenter as a VCF Operations data source (Administration > Integrations,
  separate from the fleet/SDDC-Manager attach). Cross-linked from
  `01-overview.md` Phase 1; added to the README contents table and
  `web/src/nav.ts`.

## v0.5.6 – 2026-09-11
- **`docs/01-overview.md`, `docs/04-field-notes.md` – close out the two
  remaining TC deck gaps** (issue #17). **01-overview.md**: documented
  **VCF Operations Orchestrator** (formerly Aria Automation Orchestrator)
  in Phase 4 – upgrades alongside Automation, manual on a 5.2.x source,
  driven by VCF Operations on a 9.0.x source; a component seen in two TC
  deck component-order tables but never previously documented in this
  repo. **04-field-notes.md**: logged the "optimized" combined vCenter +
  NSX Manager upgrade window (prep vCenter, upgrade NSX, then switchover)
  as an open question – the mechanics relative to the RDU switchover
  weren't confirmed, so the doc explicitly defaults to the sequential
  Phase 5 → Phase 6 order until clarified.

## v0.5.5 – 2026-09-11
- **`docs/01-overview.md` – VCFcheck operational detail, small wording fix**
  (issue #17). Expanded the pre-upgrade precheck section with a "How it's
  run" block: the actual `--product sddc` / `--product esxi` (run
  separately so ESXi checks can proceed in parallel on a large environment)
  / `--product sddc-post-check` commands, the WinSCP-to-`/tmp` +
  PuTTY-as-root mechanics, and the `nonvcf-*` per-cluster interactive
  credential-prompt behaviour for the VVF path. Corrected the 9.0.x source
  path label from "fleet transition" to Broadcom's actual term,
  **fleet-lifecycle transition**.

## v0.5.4 – 2026-09-11
- **`docs/01-overview.md`, `docs/04-field-notes.md` – TC checklist
  follow-ups** (issue #17). **01-overview.md**: added a **Bundle staging**
  prerequisites row – bundles downloaded/staged/integrity-checked, and free
  disk space confirmed on SDDC Manager (a common, avoidable staging
  failure). **04-field-notes.md**: logged two TC checklist items as open
  questions rather than guessing at their meaning – **VCFverify (VoV only)**
  (listed alongside SOS/VCFcheck as a Dell VxRail pre-check tool, but
  neither "VoV" nor what it checks is confirmed) and **NSX Intel** (likely
  NSX Intelligence, not confirmed, no documented upgrade interaction yet).

## v0.5.3 – 2026-09-11
- **`docs/01-overview.md`, `docs/03-identity-broker-migration.md`,
  `docs/04-field-notes.md` – more TC deck follow-ups** (issue #17), covering
  the 9.0.x fleet-transition path, hard blockers, and time estimates.
  **01-overview.md**: added a hard-blocker callout that **Avi Load Balancer
  32.1.1 is the minimum for VCF 9.1** (NSX / vCenter upgrades block below
  it); added a hard-blocker note that the first VCF Instance needs a Cloud
  Proxy or the upgrade cannot complete, including the no-Aria-present case;
  added a per-component **time-estimate table** (SDDC Manager, NSX-T,
  vCenter, ESXi, Aria Suite LCM, post-upgrade checks) from Broadcom's own
  upgrade-plan template, alongside the existing Upgrade Time Calculator
  mention; added a lead-in to **Post-upgrade validation** covering
  VCFcheck's post-check mode, a vSAN Skyline Health re-check, and evidence
  packaging for handover, mirroring the pre-upgrade gate.
  **03-identity-broker-migration.md**: new section for the **9.0.x
  fleet-transition path** – an existing Identity Broker 9.0.x on an NSX
  overlay network fails the VCF Operations upgrade outright unless first
  moved to the VCF management network (condition, procedure, and
  maintenance-window impact). **04-field-notes.md**: new **VCF Automation**
  section correcting a TC-deck claim – Broadcom KB 403314 only covers
  migrating Idem-based Avi load-balancer resources, it is not a blanket
  "must be on Aria Automation 8.18.1 Patch 3" upgrade prerequisite.

## v0.5.2 – 2026-09-11
- **`docs/01-overview.md`, `docs/04-field-notes.md`, `docs/vxrail-addendum.md`
  – further Technical Consultation gate follow-ups** (issue #17), continuing
  the TC deck review. **01-overview.md**: expanded the single-line rollback
  bullet into a per-component breakdown (VCF Operations snapshot-and-revert;
  SDDC Manager / NSX Manager restore-from-backup; vCenter RDU auto-revert;
  Avi's own procedure; ESX forward-only) under the explicit principle that
  recovery is per-component with no single "undo"; named the **go / no-go
  gate** explicitly in the precheck section and added a short note that
  findings split across ownership tiers (direct fix, customer-executed
  change, hardware vendor, support escalation); added a Cleanup step to
  delete pre-upgrade snapshots after a successful upgrade; added the NSX
  VIBs-ship-in-the-ESX-image note to Phase 7; labeled the two source paths
  **skip-level** (5.2.x) and **fleet transition** (9.0.x) per Broadcom's own
  terminology. **04-field-notes.md**: added an **Open items to confirm**
  section with the unverified "certificates renew automatically on upgrade"
  claim; added SDDC Manager's own UI deprecation (separate from the
  already-noted vCenter installer-UI deprecation) to the deprecations list.
  **vxrail-addendum.md**: noted that hardware-fault / firmware-limit /
  Dell-design-guidance findings route to Dell, not RPS, for investigation.

## v0.5.1 – 2026-09-11
- **`docs/01-overview.md` – fold in Broadcom Technical Consultation gate
  content** (issue #17). Sourced from internal Broadcom TC deck screenshots
  and a Slack thread reviewed with the customer TC process in mind.
  **Run the pre-upgrade precheck**: added **VCFcheck** as Broadcom's
  supplementary in-house health-check tool alongside the SDDC Manager
  precheck – what it produces (color-coded per-domain result files feeding
  the go/no-go decision), the PSO-account access requirement, and a
  cross-link to the `nonvcf-*` modes for the VVF manual-upgrade path (no
  SDDC Manager). **Prerequisites table**: added **CPU & TPM 2.0** and
  **NTP** rows; extended **vSAN HCL** to cover Broadcom plugin support;
  added a **vSAN health** row for the Skyline Health workflow. **Windows,
  ordering and rollback**: cited the Broadcom **Upgrade Time Calculator**
  for per-component estimates; strengthened the rollback bullet to require
  a *written* per-phase backout position, not just verbal agreement.
  Deliberately left out as internal Broadcom SRE process rather than
  guidance for this repo's audience: remediation ownership tiers, the
  Issues-on-Site tracker, comms templates, and the Cloud-Builder
  deployment-checks mode (belongs in `VCF9-DeploymentPlanning` instead).
- **`docs/02-disaster-recovery.md` – VLSR/SRM licensing section** (issue
  #18). New **Licensing** section: Advanced Cyber Compliance (a paid VCF
  Advanced Service) vs. a standalone Site Recovery Manager license; per-VM
  capacity counted on both sites of a protection pair; the license rides
  the same VCF License Server as [Phase 3](01-overview.md#phase-3--deploy-vcf-management-services--license-server),
  not the Protection and Recovery appliance directly; and automatic
  conversion of an existing legacy SRM key on activation. Added an open
  question to Field notes: exact point in the convergence procedure to
  assign the ACC/SRM license relative to deploying the 9.1 appliance – no
  authoritative source found yet, confirm against the account's actual
  SPD/entitlement first. Sources added to the reference table.

## v0.5.0 – 2026-09-04
- **`docs/` – reframe version guidance for VCF 9.1.1 GA** (issue #16).
  VCF 9.1.1 went GA on 2026-09-03. `01-overview.md`: **"Pin a target build"**
  no longer says 9.1.1 is unreleased – it is now the current point release,
  and a component qualified against a 9.1.0.0x00 build is not automatically
  qualified against 9.1.1. Corrected the **VCF Operations 8.18.7** worked
  example throughout (the "back in time" note, the "a component can force the
  wait" note): 8.18.7 has no path to any 9.1.0.x build, but the Broadcom
  Upgrade Path tool (checked 2026-09-04) shows **8.18.7 → 9.1.1.0 is
  supported** – "upgrades are only supported from VCF 9.1.1.0 onward" – so it
  is the textbook case of a point release re-qualifying source versions, not
  an example of "no 9.x path at all". Status note flags that the 2026-08-27
  planner run predates 9.1.1. `02-disaster-recovery.md`: note that 9.1.1
  ships its own Protection and Recovery build with its own qualified
  vCenter / ESX set. `vxrail-addendum.md`: status note refreshed. No BOM
  build numbers changed – the docs already defer those to the matrix and the
  reader's target build.

## v0.4.9 – 2026-08-28
- **`docs/01-overview.md` – NSX Edge & NSX Finalize conditional phase**
  (issue #8). Expanded Phase 8 / the table row into an **"NSX Edge & NSX
  Finalize in detail"** subsection: it is the last core step, running after
  the ESX / host phase because the Edge dataplane aligns with the host
  transport-node dataplane – VCF LCM greys out the Configure button until
  every vCenter and ESX in the domain (and dependent domains) is on 9.1.
  Driven from SDDC Manager / VCF Operations (NSX Upgrade Coordinator), run
  prechecks first; Edge clusters upgrade in parallel, edges within a cluster
  serially, each via maintenance mode + reboot with Active/Standby failover;
  brief north-south blip per node, with the missed-GARP ~10-min stale-ARP
  risk (KB 440381); the shared-NSX rule (finalize from the management domain
  only); what "finalize" commits; and the stale / orphaned Host Transport
  Node gotcha that blocks the step (KB 444026). Added to the Contents list.
  Sources: Broadcom "Upgrading vCenter and NSX Manager", NSX upgrade guide,
  KB 444026, KB 440381.

## v0.4.8 – 2026-08-28
- **`docs/01-overview.md` – vSAN File Service conditional phase** (issue #10).
  Expanded the table row into a **"vSAN File Service in detail"** subsection:
  it is the last conditional phase, runs **after the vSAN on-disk format
  upgrade** (prereqs: ESX hosts → vCenter → on-disk format), refreshes the
  per-host **File Service agent VMs (OVF)** on a **rolling** basis with
  container fail-over, is driven from the **vSphere Client** (Configure → vSAN
  → Services → File Service → Check upgrade; Automatic or Manual OVF), keeps
  file shares accessible with brief interruptions, and finishes with a
  Skyline-Health / agent-health check. Added to the Contents list and
  cross-linked from the post-upgrade validation list. Source: Broadcom
  "Upgrade vSAN File Service".

## v0.4.7 – 2026-08-28
- **`docs/01-overview.md` – Log Management conditional phase** (issue #9).
  Expanded the table row into a **"Post-Infrastructure Products – Log
  Management in detail"** subsection: it is now a component of VCF Management
  Services deployed from VCF Operations, not an in-place upgrade; the 9.0.x
  path transfers config automatically, the 8.x / VCF 5.x path is a fresh
  deploy with manual re-pointing; custom dashboards/alerts/queries need the
  Content Pack → Management Pack conversion; log forwarders copy across
  inactive; historical data via transfer utility / archive import / 90-day
  parallel query; the new instance must be on the management network (not a
  custom NSX overlay) with a new FQDN; log-data transfer needs the
  split-proxy Cloud Proxy; decommission the legacy appliances after cut-over.
  Added to the Contents list and cross-linked from Phase 1 and the field
  notes. Sources: Broadcom "Upgrade to Log Management 9.1" + "Deploy Log
  Management".
- **`web/` source – cleared the last em-dashes** (issue #2). U+2014 → spaced
  U+2013 in `astro.config.mjs`, `src/content.config.ts`,
  `src/layouts/BaseLayout.astro` (comments) and the two visible strings in
  `src/pages/index.astro` and `src/pages/docs/[...slug].astro`. The
  no-em-dash rule now holds across the whole repo including `web/`.

## v0.4.6 – 2026-08-28
- **`web/src/nav.ts`:** regrouped `04-field-notes` from "Guide" to
  "Reference" – it is a companion symptom/cause/fix list, not a step-by-step
  guide like `02-disaster-recovery.md` / `03-identity-broker-migration.md`.

## v0.4.5 – 2026-08-28
- **New `docs/04-field-notes.md`** (issue #15) – de-identified known issues
  and gotchas from a prior VCF 5.2.2 → 9.0.2 multi-domain upgrade, grouped by
  phase / component (symptom → cause → fix / KB): entitlement + the
  three-place depot token drift; the "back in time" patch trap; the Fleet
  Manager "stage 17" migration failure chain (443 → TLS 1.3 → cert node IPs →
  inverted `is_admin_node` → manual registration); SDDC Manager 502 /
  `/etc/hosts` (KB 412614); NSX Manager → Policy promotion (KB 385606) and
  the vCenter 9 IWA-removal / AD-unjoin (KB 373004); ESX gotchas (Sub-NUMA
  PSOD, NSX host locks, scripted Tools, HBA failures); Supervisor bridging
  version + K8s gating (KB 92227); Identity Broker key desync (KB 377519),
  NTP skew, ELM drift; the UCP / split-proxy log-transfer requirement;
  Operations for Networks intermediate hop; the upgrade-specific firewall
  port set; and the deprecations to expect. Linked from the overview and
  from `03-identity-broker-migration.md`.
- **Inline sharpenings:** `01-overview.md` – the "back in time" term in the
  source-patch note, the AD-unjoin KB and installer-UI-deprecated note in
  Phase 6, the depot-token re-check after vCenter, and "Universal Cloud Proxy
  / UCP" naming plus the split-proxy pointer in Phase 1.
- Added the doc to `web/src/nav.ts`, `README.md`, and the CLAUDE.md
  file-layout table.

## v0.4.4 – 2026-08-28
- **`docs/01-overview.md` – vSphere Supervisor placement** (issue #11). Added
  a conditional-phases row and a **"vSphere Supervisor in detail"** subsection.
  Per the VCF Upgrade Planner scenario, the Supervisor upgrade lands **after
  vCenter (Phase 6) and before the ESX host phase (Phase 7)** – after NSX
  Local Manager / Global Manager, ahead of the host kernels. It is driven by
  vCenter Workload Management / vLCM (not SDDC Manager), requires the
  Supervisor clusters to be on vLCM images, must match the vCenter version
  (auto-upgrade removed at vCenter 9.0), rolls each host through maintenance
  mode for the Spherelet, and is followed by any vSphere Kubernetes Service
  (VKS / Tanzu) guest-cluster upgrades per the Supervisor-VKS matrix. KB
  440630's core sequence does not list it.

## v0.4.3 – 2026-08-28
- **`docs/01-overview.md` conditional phases – expanded two of the table rows
  into subsections** (issues #7, #5).
  - **NSX Global Manager / Federation in detail:** what Federation is and how
    to detect it, the Global-Manager-before-Local-Manager order, prerequisites
    (compatible versions per site, inter-site connectivity, GM backup), and
    that the whole NSX upgrade is driven from SDDC Manager / VCF Operations in
    a VCF context.
  - **Avi Load Balancer + License Hub in detail:** Avi Controller upgrades
    ahead of the core tier; **License Hub is not the License Server**; License
    Hub gates on **vDefend or Avi**, not SSP alone; License Hub 2.0 is a
    single standalone OVA (no SSP Installer, no 5.1.2 → 2.0 upgrade path);
    the older 5.1.2 three-VM / IP-pool shape kept for environments still on it.
- Closed #3, #4, #12 (superseded by v0.4.2's `02-disaster-recovery.md`,
  `03-identity-broker-migration.md`, and the built-out `vxrail-addendum.md`).

## v0.4.2 – 2026-08-28

Folded a full VxRail 5.2.2 → VCF 9.1 planning cycle into the guides (issue #13).

- **`docs/01-overview.md`.** Generalised the "source patch level matters" note
  into a per-component principle – the *newest* patch after a qualified source
  often has no 9.x path yet (VCF Operations 8.18.7, Operations for Networks
  6.14.3, SDDC Manager 5.2.4.0), so patching to latest as "prep" can strip
  the path; added the two interop-matrix tools. A point release re-qualifies
  both source and target. VCF 9 licensing is subscription-only via the VCF
  Business Services console. Phase 1 now covers the unified Cloud Proxy
  (legacy 8.18 proxies do not upgrade in place), Operations for Logs having no
  in-place path, and vRSLCM being left behind. Phase 2 notes NSX and vCenter
  are driven from SDDC Manager / VCF Operations from that point. New
  **Contents** list, a **"What changes in VCF 9.x"** primer, and a
  **"Windows, ordering and rollback"** section (sequential method, attended /
  unattended window split, safe stopping points, per-phase backout position,
  prechecks as a loop). Added an Operations for Networks row to the
  conditional phases; expanded post-upgrade validation (certificates,
  identity, integrations, DR re-test, backups).
- **New `docs/02-disaster-recovery.md`.** SRM / vSphere Replication →
  VCF Protection and Recovery as its own doc: the combined appliance,
  convergence for VLSR 9.0.2.3 and earlier, the 9.0.2.2 Converge floor
  (KB 408127), the bridge-version reason DR goes first, the Enhanced vSphere
  Replication prerequisites, and the per-site Converge procedure.
- **New `docs/03-identity-broker-migration.md`.** VIDM / Workspace ONE Access
  → VCF Identity Broker as its own doc: no in-place upgrade, the parallel-run
  model, the documented Access Control group-import procedure, what does not
  carry (directory / IdP connection, federation, MFA policies, branding, WS1A
  flows), the "embedded → instance" migration it is *not*, and the open items
  on the release-notes "script". The overview's DR and Identity subsections
  are slimmed to pointers.
- **Built out `docs/vxrail-addendum.md`** from a stub: the Dell-coordinated
  release stream and minimum source; the 9.x architecture change (SDDC Manager
  decoupled from VxRail Manager, the new hardware-lifecycle component, vLCM
  mandatory, single codebase); the VxRail Manager → VxRail Operations Manager
  conversion; unsupported deployment types; the Dell RPS engagement –
  Technical Consultation output, the 11-step order with the Customer / Dell
  RPS responsibility split, the credential list; and which general phases it
  replaces or wraps.
- **`reference/sources.md`:** added the interoperability matrix as a
  first-class tool; the Protection and Recovery "Convergence and Upgrade"
  guide; the identity import procedure; Broadcom KB 408127 / 313905 / 306446;
  the Dell KBs (000478885, 000021470) and the RPS Customer Preparation Guide;
  and notes on what the planner data does not model (SRM versions, VIDM,
  VxRail).
- **`web/`:** the two new docs added to the nav (grouped as "Guide"); the "On
  this page" nav now nests H3 sub-topics under the H2 flow.

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
