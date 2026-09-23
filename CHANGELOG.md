# Changelog

## v1.6.5 – 2026-09-23
- **Add a field-observed lsdoctor symptom: STS connection string pointing
  to the vCenter's own IP.** New `docs/17` field-observed subsection plus
  a `docs/04` pointer – observed on a standalone (non-ELM) vCenter,
  correlated with a missing PTR record rather than the KB's default
  ELM-decommission framing. Not service-impacting at rest, but the
  documented failure mode (services failing to restart) is exactly what
  an upgrade triggers, so it's a pre-upgrade fix-it item, not a defer.

## v1.6.4 – 2026-09-23
- **Document the vCenter appliance default-shell SCP failure.** The
  appliance's default login shell (`appliancesh`) fails SCP/WinSCP until
  switched to `bash` – confirmed still true on vCenter 9.0, not just
  7.x/8.x. Added as a shared note in `docs/17` (both the VDT and lsdoctor
  copy steps), a pointer from `docs/06`'s lsdoctor copy step, and a new
  gotcha in `docs/04`.

## v1.6.3 – 2026-09-23
- **Add VCFDT's `--latest` one-liner shortcut to `docs/20`.** A fourth
  option (D) alongside the existing spec-file/filtered-catalog/binary-ID
  pulls, sourced from William Lam's VCFDT 9.1.1 one-liners: EP-patches-only
  for an already-deployed fleet, full install-with-EPs for a fresh
  deployment. Flagged as not independently field-verified in this repo.

## v1.6.2 – 2026-09-22
- **Add a version interop quick-reference table to `docs/22`.** One
  table across Converge and Import: target VCF build, min vCenter/ESX,
  NSX requirement, and known gate – including the 9.1.0.x back-in-time
  block vs. its 9.1.1.0+ resolution (KB 448135) and the NSX 9.1 /
  vCenter 8.0 U3a+ incompatibility. Framed explicitly as a starting
  point, not a replacement for re-running the Upgrade Path tool against
  the exact source build.

## v1.6.1 – 2026-09-22
- **Strengthen `docs/22`'s root-cause claim from "matches" to
  "confirmed."** The williamlam.com article's vCenter 8.0 U3c → NSX
  4.2.4.1 example wasn't just a version-number coincidence with this
  repo's own field-notes case – confirmed as the actual mechanism behind
  it.

## v1.6.0 – 2026-09-22
- **Add `docs/22-converge-and-import-existing-infrastructure.md`, a new
  reference doc distinguishing Converge (VCF Installer, brownfield
  vSphere into a new VCF/VVF instance) from Import (VCF Operations, an
  existing vCenter into a new workload domain on an already-running VCF
  fleet – VCF only).** Covers version bars and prerequisite checklists
  for both, field-observed import blockers not in the official checklist
  (DRS Fully Automated, VDS 8.0+/2 uplinks, ELM deactivated, static
  VMkernel IPs), and the shared root cause behind the NSX auto-selection
  back-in-time trap already documented in `docs/04`/`docs/13` (KB
  429205, KB 430524, KB 430825), with the three ways to avoid or recover
  from it. Trimmed the duplicated converge version-bar detail out of
  `docs/05`, pointing at the new doc instead. Cross-linked in both
  directions with `docs/04` and `docs/13`. Added to `nav.ts`,
  `README.md`, `CLAUDE.md`. Closes #29.

## v1.5.6 – 2026-09-22
- **Fix track misplacement: move the fleet-wide NSX back-in-time
  cross-link from `docs/07` to `docs/13`.** `docs/07` is VVF/standalone
  vSphere only (no Fleet Management), but the finding it pointed to
  (SDDC Manager's Plan Component Upgrade, management domain, workload
  domain import) is full-VCF-only – none of that exists outside VCF
  Management Services. Added instead to `docs/13` Phase 2 (SDDC Manager
  upgrade), where Plan Component Upgrade is actually driven.

## v1.5.5 – 2026-09-22
- **Add a field note to `docs/04`: the NSX back-in-time restriction (KB
  448135, NSX 4.2.4 and later vs. VCF 9.1.0.x) blocks upgrade plan
  validation fleet-wide, not just for the domain running the
  incompatible NSX version.** A workload domain imported into a VCF
  9.1.0 fleet with NSX 4.2.4.1 already in place caused a
  **management-domain-only** Plan Component Upgrade to fail validation
  without touching the imported domain at all. Cross-linked from
  `docs/07`'s back-in-time section (the vCenter-side version of the same
  restriction). Closes #28.

## v1.5.4 – 2026-09-22
- **Correct `docs/21`: VCF Inspector does not open in the system
  browser.** It launches as its own standalone application window with
  a web-style UI (the light/dark toggle, the "browser local storage"
  wording) rather than opening as a page in Chrome/Edge/Firefox –
  corrected after the tool's actual behavior didn't match the earlier
  description.

## v1.5.3 – 2026-09-22
- **Fix screenshots rendering at cramped reading-column width across all
  docs, not just `docs/21`.** CommonMark wraps a bare `![]()` in a `<p>`,
  and the prose stylesheet's `74ch` text-measure cap (meant for
  paragraphs) was inherited by that wrapper, squeezing every embedded
  image down to ~660px regardless of its real size or the available
  column width. Added `.prose p:has(> img:only-child) { max-width: none }`
  plus a bordered/rounded `.prose img` treatment matching the existing
  table/code-block styling, so screenshots now use the full content
  column. Verified with a local preview build.

## v1.5.2 – 2026-09-22
- **Add a full field-observed walkthrough of the Management Services
  Inspector to `docs/21`** (lab environment, v1.300): the Services tab
  (IP pool sizing/expansion path corroborating `docs/20`'s Build →
  Lifecycle → VCF Management navigation, Virtual IPs/Node IP tables, the
  8 deployed-service cards, and a **VCF Management Services Backup
  check that directly gates patching** – cross-linked to `docs/20`'s
  backup section), the Advanced Troubleshooting tab's per-service Log
  Analyzer error/warning pattern counts, and the Actions tab's six
  live remediation actions (DNS restart, credential renewal, database
  compaction, etc.) gated behind an explicit authorization toggle.
  Flagged a recurring multi-chip UI pattern (contradictory-looking
  status badges shown together) and an NTP anomaly (nodes badged "Not
  Synced" despite ~0.0ms offset). Embedded three screenshots (landing
  page, Advanced Troubleshooting, Actions tab) under
  `docs/images/vcf-inspector/` – the only three confirmed free of
  IP/hostname data; the data-heavy Services tab panels stay as prose/
  tables instead. Noted an open, untested question: whether the same
  connect form also works against a VCF Automation control-plane node,
  since Automation runs its own separate deployment and wasn't among
  the 8 fleet-wide services this lab showed.

## v1.5.1 – 2026-09-22
- **Expand `docs/21-vcf-inspector-fling.md` with field-observed (v1.300,
  lab run) UI detail** for all three modes: the version-toggle field on
  the readiness checker (source must be 5.2.x or 9.0.x, not 9.1), the
  Bootstrap-VM auto-discovery on the deployment monitor, and the
  SSH-to-runtime-control-plane-VM connection (with optional SSH key)
  on the Management Services Inspector. Flagged a real discrepancy: the
  landing page claims credentials are "never stored to disk," but the
  Management Services Inspector's own footer says they're "stored in
  browser local storage only" – contradicts the blanket claim, and
  matters before pointing the tool at a production control plane.

## v1.5.0 – 2026-09-22
- **Add `docs/21-vcf-inspector-fling.md`, a new reference doc for the VCF
  Inspector Fling.** A standalone, no-install VMware Fling covering
  fleet-level pre-upgrade validation, deployment monitoring with
  automatic stuck-task detection, and health diagnostics – **VCF only**
  (it targets a VCF control-plane node, which doesn't exist in VVF or
  standalone vSphere). Cross-linked from `docs/20`'s Upgrade All failure
  account, since stuck-task detection is exactly what that 13-day silent
  deadlock needed. Added to `nav.ts`, `README.md`, and `CLAUDE.md`.

## v1.4.4 – 2026-09-22
- **Add product/UI specificity to `docs/20` Step 3's walkthrough.**
  Named the product (VCF Operations, replacing the standalone SDDC
  Manager UI for lifecycle ops in 9.x), clarified the **Build** pillar
  sits alongside **Manage**, and distinguished the VCF Management
  Components table (`Build → Lifecycle → VCF Management`) from the
  domain-level components table (`Build → Lifecycle Management → VCF
  Instance`) that the doc already referenced elsewhere for Express
  Patches.

## v1.4.3 – 2026-09-22
- **Move VCF Automation and Migration Service Engine to the end of
  `docs/20`'s 14-step patching order.** Neither has a documented reason
  to run early (only "Automation before Migration Service Engine" is a
  hard constraint), and the pair carries the most known risk in the list
  – cloud-integration deprecation, required profile cleanup, the 6-hour
  `vmsp_upgrade` failure mode, and the Upgrade All 13-day deadlock – so
  validate the lower-risk components first.

## v1.4.2 – 2026-09-22
- **Add the VCF unified versioning model diagram to `docs/20`'s Express
  Patches section**, hotlinked from williamlam.com, showing how major,
  minor, maintenance, and Express Patch releases differ in stack
  synchronization and installation method.

## v1.4.1 – 2026-09-22
- **Fix `docs/20`'s 14-step patching order to match its own "first two
  steps are fixed" claim.** The numbered list (sourced from Cosmin.us)
  had VCF Operations second and VCF Services Runtime third, contradicting
  the arunnukula.com-confirmed rule added in v1.4.0 that Fleet Lifecycle
  and VCF Services Runtime are the two truly fixed-first components.
  Swapped Services Runtime to position 2 and VCF Operations to position
  3, and noted the reorder against the original source.

## v1.4.0 – 2026-09-21
- **Add a "Backup before patching, and what rollback actually means"
  section to `docs/20`, and refine the patching order with a second
  independent source.**
  - New backup/rollback section: Identity Broker, Log Management, and
    Software Depot get an **automatic** pre-patch backup to a
    fleet-level SFTP target (Build → Lifecycle → VCF Management →
    Backup & Restore) – with two documented failure modes checked ahead
    of time (an uppercase FQDN fails the SSH known-hosts check, KB
    453300; a full backup server times out with the generic
    `VCFMS-BACKUP-COMPONENT-006` error, KB 441165). VCF Automation's
    file-based backup is separate and must be time-aligned with
    Identity Broker's, or a restore locks everyone out. Components with
    no documented automatic backup (SDDC Lifecycle, Salt, Real-Time
    Metrics, Telemetry) rely on a pre-patch snapshot instead. No clean
    one-click rollback exists for a failed component patch either way.
  - Per a second independent account, only **Fleet Lifecycle** and
    **VCF Services Runtime** are strictly fixed-first – the rest of the
    14-step order is *a* valid sequence, not *the only* one, with Fleet
    Lifecycle managing remaining dependencies automatically beyond
    known pairwise constraints. Added the concrete failure symptom for
    patching Migration Service Engine out of order: a 6-hour run that
    fails on `vmsp_upgrade`.

## v1.3.9 – 2026-09-21
- **Replace the vague "don't use Upgrade All" gotcha in `docs/20` with
  a real, detailed failure account**, and add several new 9.1.1-specific
  gotchas from two more sources:
  - **Upgrade All / parallel patching**: per a real lab account, Upgrade
    All started VCF Automation and the Migration Service Engine
    together, letting the Migration Service Engine jump ahead and
    attempt a PostgreSQL v14→v17 upgrade an old admission webhook
    rejected – triggering a silent Flux/Helm reconciliation loop (the
    `vcd-migrator` release cycled through **19,905 revisions** over 13
    days) while the UI reported everything **Healthy** the whole time.
    Fix required deleting the offending Helm Bundle and resetting the
    target version.
  - **9.1.1 isn't "just" a maintenance release**: added gotchas for the
    Secure Boot certificate migration (VMware Tools 13.1.5+, July 2026
    Windows Cumulative Update, VM reboots), ESX 9.1.1.0 not being
    live-patchable, distributed firewall configs causing post-install
    remediation, and Host Profiles with vSAN failing batch remediation.
  - **Express Patches section now cites the official VMware Cloud
    Foundation blog** instead of only a community write-up – confirms
    a monthly cadence and the official UI steps, with the community
    post kept as supplementary.

## v1.3.8 – 2026-09-21
- **Expand `docs/20`'s Step 1 with the field-verified depot procedure
  from the companion repo.** `VCF9-DeploymentPlanning/docs/09-binary-depot.md`
  already has a much deeper, field-verified treatment of this than the
  web-research-sourced version here – cross-referenced per this repo's
  "cross-reference, don't duplicate" convention rather than re-deriving
  it. Points to that doc for the one-time offline-depot build-out
  (web server, TLS cert SANs, the auth split), and pulls the **Day-N
  "filling the depot for a fleet upgrade" procedure in full** since
  that's exactly this doc's scope: the sync → check → export → download
  → re-check loop, the undocumented `--download-spec-file` flag, three
  ways to pull binaries (spec file / filtered catalog / by ID) with the
  100+ GiB size-trade warning for an unfiltered pull, the root-owned
  file → 403 → misleading "Stage Precheck Binaries" failure gotcha, and
  `binaries cleanup` for reclaiming space. Both cross-repo links
  verified live (page + anchor) before shipping.

## v1.3.7 – 2026-09-21
- **Inline the sources throughout `docs/20`** instead of leaving them
  only in the bottom Sources list – each claim (Express Patch rules,
  depot mechanics, the mandatory dependency quotes, the worked-order
  attribution, each gotcha's KB) now links directly to its source at
  the point it's used. Also fixed a stale KB-number mismatch in the
  Sources list entry (had leftover incorrect numbers from before the
  v1.3.6 KB-verification pass). Two gotcha KBs (448993, 451147) are
  cited by number only, flagged as no direct URL confirmed, rather than
  guessing a link that might not resolve.

## v1.3.6 – 2026-09-21
- **Re-target `docs/20` at VCF 9.1 specifically, dropping the 9.0.x
  material.** The worked-example order, timing table, and gotchas were
  sourced from a 9.0.1 → 9.0.2 practitioner run – replaced with a
  9.1.0.x → 9.1.1-specific 14-step order, timing, and gotchas (KB
  388305, 448993, 451147, 400822 – the last two swapped in after the
  originally-cited KB numbers for two gotchas couldn't be independently
  verified, while these were). Added a new "Two kinds of patch in 9.1"
  section explaining **Express Patches** (`9.1.0.01XX`, any order except
  a Fleet-Lifecycle-containing EP goes first, cumulative) as distinct
  from maintenance releases, since that mechanism didn't exist in 9.0.
  Updated the title, `README.md`, `web/src/nav.ts`, and `CLAUDE.md` to
  say 9.1 rather than 9.x.

## v1.3.5 – 2026-09-21
- **Renamed and expanded `docs/20` into the full "how to patch a
  current VCF 9.x fleet" guide** (`docs/20-patching-an-existing-vcf9-fleet.md`,
  was `docs/20-depot-and-binary-management.md`). The depot/binary content
  from the previous version is folded in as Step 1 rather than being the
  whole doc. Added: the mandatory dependency chain from `docs/04`
  (trimmed there to a short pointer, same cross-reference pattern as
  `docs/17`); a full worked-example patching order for a real 9.0.1 →
  9.0.2 run (Fleet Management → Operations for Logs → Operations →
  Operations for Networks → Automation → SDDC Manager → NSX → vCenter →
  host firmware → ESX → vSAN File Services), explicitly flagged as a
  practitioner account rather than Broadcom TechDocs; the actual UI
  click-path (Binary Management → Download → Trigger Inventory Sync →
  Run Prechecks → remediate → Upgrade → monitor via Tasks); four known
  gotchas (90-day password expiry, VCF Operations for Networks disk
  space, expired NSX Edge credentials, vCenter RDU backup/spare-IP
  prerequisites); and a rough per-component timing table. Updated
  `README.md`, `web/src/nav.ts`, and `CLAUDE.md` to the new filename.

## v1.3.4 – 2026-09-21
- **Document the day-2 patching order for VCF Management Services
  components, and add `docs/20-depot-and-binary-management.md`.** Two
  related additions, both about a fleet already running VCF 9.x (not the
  initial 5.2/8.x → 9.x upgrade):
  - `docs/04-field-notes.md`'s "VCF Management Services Runtime" section
    gets a new entry with the full dependency chain for a maintenance
    patch (e.g. 9.1.0.x → 9.1.1), quoted verbatim from Broadcom's
    Lifecycle Management of VCF Components TechDocs: Fleet Lifecycle
    patches before anything else; VCF Operations never patches in
    parallel with other components; ESX hosts need VCF Operations and
    its License Servers patched first (Cloud Proxy/License Server patch
    automatically alongside VCF Operations); each VCF Management
    Services Runtime patches before the Identity Broker or Salt RaaS
    instance it hosts; VCF Automation patches before its migration
    service engine; a depot patch blocks every other component patch
    while in progress.
  - New guide `docs/20-depot-and-binary-management.md`: online vs.
    offline depot modes (only one connection ACTIVE at a time), download
    tokens vs. activation codes (activation code is mandatory for ESX
    binaries specifically), VCF Download Tool (VCFDT) command examples
    for install/upgrade/ESX binary downloads, and the Day-N manual
    binary upload requirement for a disconnected depot (Log Management,
    Real-time Metrics, VCF Operations for Networks, new domains). Added
    to `README.md`, `web/src/nav.ts`, and `CLAUDE.md`.

## v1.3.3 – 2026-09-21
- **Document licensing an air-gapped/isolated vCenter in `docs/05`.**
  New subsection under "Deploy License Server": vCenter 9.x can't fall
  back to a standalone license key when it has no path to any VCF
  Operations instance (symptom: "No licenses found," no manual key
  field, stuck in Evaluation mode). Per Broadcom KB 404155, centralized
  license management across disconnected sites isn't supported – each
  isolated segment needs its own VCF Operations instance *and* its own
  License Server (confirmed against Broadcom's License Server Overview:
  no single-vCenter exception exists), each carrying entitlement across
  the air gap via the same Business Services Console file exchange as
  the disconnected-mode steps above. Also clarifies that this doesn't
  mean standing up a new fleet – a standalone, unattached VCF Operations
  instance is a normal pattern, not an SDDC-Manager-orchestrated fleet.

## v1.3.2 – 2026-09-21
- **New guide: `docs/19-vvf-vs-vcf-feature-comparison.md`.** Summarized
  from Broadcom's official Sep 2026 "VCF 9.1.1 and VVF 9.1.1 Feature
  Comparison & Upgrade Paths" whitepaper (a ~200-row table) rather than
  scattered facts across other docs: what's entirely VCF-only (NSX, VCF
  Automation, VCF Operations for Networks, Private AI Services, Fleet
  Management/Lifecycle via VCF Operations, several VCF Operations
  sub-features), what's present in both with a caveat (Host Profiles/Auto
  Deploy not Fleet-Management-integrated in VCF, VVF's Storage/Network
  Service limited to VM Service/VKS), and what's a paid add-on regardless
  of tier (Avi, vDefend, SRM, Live Recovery Cloud, ACC). Flags an
  actionable deadline: Broadcom's legacy built-in VCF load balancer is
  usable only until **May 30, 2027** before requiring Avi licenses (KB
  439411). Added to `README.md`, `web/src/nav.ts`, and `CLAUDE.md`.

## v1.3.1 – 2026-09-21
- **Add the missing "how do I actually populate the repository" step to
  `docs/18-vmware-tools-productlocker.md`.** The doc covered pointing
  `/productLocker` at a shared path but not how to get VMware Tools
  content into that path in the first place. New "Populating and
  updating the shared repository" section: create-folder-and-chmod steps,
  the exact `vmtools/`/`floppies/` file list and `cp -r` commands from KB
  313876, and the update procedure (empty the folder, re-run the same
  steps, no re-pointing needed). Flagged as sourced from documentation
  rather than lab-verified, unlike the pointer-setting methods above it.

## v1.3.0 – 2026-09-21
- **Show the bare `domainjoin-cli leave` form directly in `docs/06`'s
  code block**, labeled alongside the credentialed form, instead of only
  describing it in the prose below.

## v1.2.9 – 2026-09-21
- **Mark `docs/06`'s bare-`leave` behavior as field-verified.** The
  claim that `domainjoin-cli leave` with zero arguments disjoins locally
  without contacting AD was sourced only from the man page; now noted as
  observed happening exactly this way on a live vCenter.

## v1.2.8 – 2026-09-21
- **Fix `docs/06`'s `domainjoin-cli leave` CLI example.** The shown
  command included a domain-name argument that doesn't belong to
  `leave`'s syntax (that's a `join`-only parameter) – per the actual man
  page, `leave` only optionally takes `[username [password]]`, no domain
  argument at all. Corrected the command and added an explicit note that
  running `leave` completely bare (no arguments) disjoins the appliance
  locally **without contacting AD at all**, distinct from the
  already-documented "credentials omitted" behavior.

## v1.2.7 – 2026-09-21
- **Convert `docs/17`'s three "Field-observed symptom" lead-ins to real
  `####` headers**, nested under "Always run the read-only check first"
  so they show up in the on-page nav, matching the header-hierarchy fix
  already applied to `docs/05`. `docs/16` and `docs/18` were checked and
  already used real headers throughout. No content changes.

## v1.2.6 – 2026-09-21
- **Document a Machine ID mismatch symptom in `docs/17`.** Field-observed:
  lsdoctor's read-only check can report a `MachineGuid` desync between the
  VMAFD service and the Likewise registry (and separately, `vpxd.cfg`).
  Per Broadcom KB 312479 this is not just diagnostic noise – it can block
  a 7.0.x → 8.0.x vCenter upgrade outright (`Exception occurred in
  postInstallHook` at Stage 2), and it's the same check VDT's own Machine
  ID Check validates. Added the full fix (offline snapshot first,
  `vmafd-cli get-machine-id`, `lwregshell` add/set, service restart) with
  exact commands quoted from the KB.

## v1.2.5 – 2026-09-21
- **Document decommissioned SRM/VLSR cleanup in `docs/17`.** A common,
  confirmable source of lsdoctor's generic "3rd party/Orphaned service
  registrations" warning: an old SRM/VLSR appliance that was
  decommissioned improperly or went unreachable before it could
  unregister itself. Added the field-observed symptom, other ways it
  shows up (VAMI SSL error, a specific vSphere Client connection-refused
  error, stale Client Plug-Ins entries), and the full three-step cleanup
  (vCenter MOB extension unregister, `lstool.py` CLI service-registration
  removal, VMDIR/LDAP solution-user removal as a last resort) per
  Broadcom KB 337576. Cross-linked from `docs/02-disaster-recovery.md`'s
  Convergence section, since this is exactly the kind of leftover an
  SRM/VLSR convergence workstream can surface.

## v1.2.4 – 2026-09-21
- **New guide: `docs/18-vmware-tools-productlocker.md`.** ProductLocker
  is the per-host symlink controlling where ESXi looks for the VMware
  Tools repository – left on its local default at scale, versions drift
  host-to-host. Covers both PowerCLI methods (Advanced Settings, needs a
  reboot; the MOB API via `ExtensionData`, doesn't) and why it needs
  re-verifying after every ESXi upgrade rather than treated as a one-time
  setup step (a confirmed-and-fixed ESXi 7.0 path-truncation bug, plus the
  general fact that a per-host advanced setting has no guaranteed survival
  across a reimage/reprovision). Lab-verified against the holodeck lab:
  confirmed no reboot is needed for the MOB API method, but found and
  documented two corrections to what secondary sources claim about it –
  the target folder must already exist first (a nonexistent path fails
  the task outright, it does not silently succeed), and a vSAN datastore
  target comes back as an internal canonicalized path rather than the
  friendly path that was set. Cross-linked from `docs/13` and `docs/14`'s
  post-upgrade validation (VMware Tools row) and `docs/15`'s vLCM
  migration "Before moving on" checklist. Added to `README.md`,
  `web/src/nav.ts`, and `CLAUDE.md`.

## v1.2.3 – 2026-09-21
- **Wording cleanup in `docs/04-field-notes.md`'s "Open items to
  confirm" section and matching historical CHANGELOG entries** (v0.5.2,
  v0.5.3, v0.5.4, v0.5.6).

## v1.2.2 – 2026-09-21
- **Follow-up cleanup pass on `docs/13`, `docs/14`,
  `docs/04-field-notes.md`, `docs/vxrail-addendum.md`, and `docs/17`.**
  `docs/13`'s pre-upgrade precheck section now describes only the SDDC
  Manager precheck and VDT; `docs/14`'s equivalent section points at VDT;
  `docs/04-field-notes.md` and `docs/vxrail-addendum.md` list only Dell's
  own pre-check tools; `docs/17`'s intro no longer contrasts VDT/lsdoctor
  against anything else. Matching wording cleaned up in the historical
  CHANGELOG entries too (v0.5.1, v0.5.4, v0.5.5, v1.1.1, v1.1.6, and
  today's own v1.2.1 entry).

## v1.2.1 – 2026-09-21
- **New guide: `docs/17-vdt-and-lsdoctor-diagnostics.md`.** Both are
  self-service diagnostic tools – consolidated rather than split, since
  VDT (general appliance health
  sweep: DNS/NTP/disk/certs/AD-LookupService/services/VCHA) and lsdoctor
  (deeper Lookup Service/SSO/vmdir repair) are meant to be used in
  sequence. Pulled the existing VDT walkthroughs out of `docs/07` and
  `docs/13` into this one reference (both now link to it instead of
  duplicating the steps). Added the full lsdoctor flag table plus, per a
  fresh Broadcom KB pull: **every lsdoctor repair mode requires a
  `service-control` restart afterward** (not an appliance reboot, but a
  vCenter/PSC management-plane outage), with the exact restart scope
  quoted per flag (`-t` and `-p` are site-/LB-wide, not single-node) –
  something to plan a maintenance window around, not assume is
  consequence-free. Also documented a field-observed "Node In Multiple
  Sites" failure and its tool-provided fix. Cross-linked from
  `docs/04-field-notes.md` and `docs/06-iwa-ldaps-migration.md`; added to
  `README.md`, `web/src/nav.ts`, and `CLAUDE.md`.

## v1.2.0 – 2026-09-21
- **Expand `docs/16-vcenter-proxy-configuration.md`.** It shipped thin;
  added: the `wget`-vs-`curl` distinction behind why proxy handling used
  to be inconsistent (KB 373713), a complete worked `config.json` example
  for the 9.x method (all three protocol objects plus a mixed
  domain/CIDR `no_proxy` list), a `python3 -m json.tool` validation step
  to catch a broken edit before assuming it took effect, and a
  "Verifying the proxy is actually reachable" section with KB 373713's
  `curl`/`wget` test commands – explicitly scoped as testing the proxy
  server's own reachability, not confirmation that vCenter's app-level
  config is being read.

## v1.1.9 – 2026-09-21
- **New guide: `docs/16-vcenter-proxy-configuration.md`.** Configuring the
  vCenter appliance's own outbound proxy turned out to have two
  incompatible methods depending on major version – 7.0.x/8.0.x uses
  `/etc/sysconfig/proxy` (VAMI GUI or manual file edit, KB 370265); 9.x
  uses a different JSON file, `/var/lib/vmware-envoy-system-proxy/config.json`,
  and explicitly warns against touching the old file (KB 402684). The 9.x
  VAMI UI's proxy validation is also broken and rejects CIDR exclusions,
  making the JSON file the only reliable path there. Added to
  `README.md`, `web/src/nav.ts` (Reference band, all three tracks), and
  `CLAUDE.md`'s file layout table; cross-linked from a new gotcha bullet
  in `docs/04-field-notes.md`'s "NSX and vCenter" section.

## v1.1.8 – 2026-09-21
- **Lab-verify the `Get-VDSwitch` spot-check line in `docs/13`.** Ran
  against the holodeck lab (PowerCLI 13.5.1, vCenter 9.1.1) – returned
  clean `Name`/`Version`/`NumUplinkPorts`/`NumPorts` output per switch,
  `Version` confirmed as a plain string. Upgraded the callout from
  Untested to Lab-verified.

## v1.1.7 – 2026-09-21
- **Wording fix in `docs/vxrail-addendum.md`'s hardware-lifecycle table.**
  The row naming VxRail Manager's replacement now matches the rest of the
  doc, which already correctly uses **VxRail Operations Manager (VOM)**.

## v1.1.6 – 2026-09-21
- **Wording cleanup across `docs/13`, `docs/14`, `docs/vxrail-addendum.md`,
  and `docs/04-field-notes.md`.** `docs/13`'s pre-upgrade precheck section
  now covers the SDDC Manager precheck and VDT only. The `docs/13` timing
  table is attributed to general field experience and planning guidance
  rather than any single source. **VDT** keeps its full name, commands,
  and citation (KB 344917) throughout, unaffected by this pass. Matching
  historical CHANGELOG entries (v0.5.1, v0.5.4, v0.5.5, v1.1.1) updated
  for consistency.

## v1.1.5 – 2026-09-21
- **Convert `docs/05`'s upgrade-step lead-ins to real markdown headers.**
  The numbered steps in Walkthrough A and Walkthrough B (Pre-upgrade,
  Apply the upgrade, Deploy the Primary node, etc.) were bold text, not
  headings, so they were invisible to the page's on-this-page navigation.
  Converted them to `###` headers (APUAT stays nested as `####` under
  "1. Pre-upgrade") so the on-page nav reflects what's actually in the
  doc. No content changes.

## v1.1.4 – 2026-09-21
- **Expand the APUAT procedure in `docs/05` and add the field-verified
  offline-cluster gotcha.** The Pre-Upgrade Readiness Assessment Tool step
  was a single line; broken out into its own "Pre-Upgrade Readiness
  Assessment Tool (APUAT)" subsection with the full PAK download/install
  steps, report retrieval, and what the System Validation Checks and
  Removed/Disconnected Metrics tabs mean. Field-verified: running APUAT
  against an **offline** cluster silently produces an empty
  Removed/Disconnected Metrics tab (reads as "nothing affected" rather
  than an error) – it must be run against the online cluster. Added as a
  callout in `docs/05` and a new entry in `docs/04-field-notes.md`.

## v1.1.3 – 2026-09-21
- **Strengthen `docs/05`'s cluster-network-topology citation with a
  genuinely VCF 9-branded source.** Checked whether a VCF 9 copy of the
  Aria Operations cluster-networking-requirements page exists –
  it doesn't; VCF Operations is Aria Operations rebranded at the code
  level and this is one of the places VCF 9's docs still point back at
  the source product's own tree. Added KB 397782 ("VCF Operations 9.0
  Sizing Guidelines," already in this doc's Sources) as a corroborating
  VCF-9-specific source: matches the < 5ms latency figure and adds a
  separate < 10ms (peaks to 15ms) datastore-latency figure plus a
  per-cluster-size bandwidth table instead of a flat floor.

## v1.1.2 – 2026-09-21
- **Add a network-topology check to `docs/05`'s fresh-vs-in-place
  decision.** Analytics cluster nodes are only supported on a single
  Layer 2 network/subnet (Broadcom TechDocs: *"A stretched Layer 2 or
  routed Layer 3 network is not supported"*, plus a 5ms RTT / 1gbps
  bandwidth floor between nodes) – applies identically to VCF Operations,
  not just 8.18. An already-non-compliant existing cluster is a strong
  signal toward fresh install, since in-place carries the layout forward
  as-is. Added as its own subsection plus a new comparison-table row.

## v1.1.1 – 2026-09-20
- **Add validation-tool steps: VDT and lsdoctor.** Both are Broadcom-
  maintained, KB-distributed diagnostic scripts, added where they fit the
  existing flow rather than as a bolted-on reference list:
  - **VDT (VCF Diagnostic Tool for vSphere)** – new "Validate with VDT
    before you start" section in `docs/07` (no SDDC Manager fleet precheck
    exists on that path, so this is the closest equivalent: DNS, NTP, disk
    space, certs, AD/Lookup Service, VCHA), and a pointer alongside
    the precheck section in `docs/13` (self-service, run it yourself
    ahead of time).
  - **lsdoctor** – new "Validate SSO/Lookup Service health with lsdoctor"
    step in `docs/06`, right after adding the AD-over-LDAPS identity
    source and before the permissions re-verification, using its
    read-only `-l` check. Its more invasive repair modes need the same
    same-instant-across-the-SSO-domain snapshot the doc's own backup
    section already covers. Also added a general pointer under
    `docs/04`'s "Identity Broker / VCF SSO" field notes.

## v1.1.0 – 2026-09-20
- **Give `docs/07` a proper "Backup, before touching anything" section**
  instead of a single thin bullet. Checked against Broadcom's own
  prerequisites page first: this upgrade type only requires a snapshot,
  not the file-based/VAMI backup `docs/06` treats as mandatory – a real
  structural difference (this upgrade deploys a brand-new appliance and
  leaves the old one intact, so the old appliance itself is the primary
  fallback; `docs/06`'s in-place SSO change has nothing else to fall back
  to). Added TechDocs' own failure-recovery statement ("delete the newly
  deployed vCenter appliance, and restore the vCenter appliance from
  backup") and cross-linked it to the "After cutover" rollback section.

## v1.0.9 – 2026-09-20
- **Document powering the old appliance back on as a rollback path in
  `docs/07`, with the destructive gotcha attached.** It only exists
  because the two-stage installer deploys a brand-new appliance and
  leaves the old one powered off but not deleted – not available for an
  in-place, single-appliance mechanism. Broadcom KB 313288 documents that
  powering the old appliance back on while still network-connected
  **deletes the new one** (the opposite of a rollback), but that KB only
  explicitly covers RDU, not this doc's plain GUI/CLI path – flagged as
  plausible-but-unconfirmed for the plain path rather than asserted,
  since this doc's own intro already calls it "the same underlying
  two-stage migration mechanism."

## v1.0.8 – 2026-09-20
- **Fix a real inaccuracy: VAMI does not drive vCenter version upgrades,
  major or RDU.** `docs/07-vcenter-manual-upgrade.md` used to say vCenter
  "is upgraded the traditional way, from its own installer, VAMI, or the
  CLI" – wrong, and traced back to a real mix-up (a colleague asked whether
  major upgrades are now possible from VAMI; researched it and they
  aren't). Added a "Not VAMI – a common mix-up" section: major upgrades
  are GUI-installer or CLI-installer only (per Broadcom TechDocs' listing),
  RDU is driven from the **vSphere Client's Update Planner** (not VAMI –
  Broadcom KB 313288 explicitly warns against running RDU and VAMI at the
  same time, which only makes sense if they're separate mechanisms), and
  9.1's new "vCenter quick patch" (VAMI-driven) is scoped to security
  patches, not version upgrades. Fixed the same loose "VAMI / installer"
  phrasing in `docs/14-standalone-vvf-upgrade.md`'s vCenter step.

## v1.0.7 – 2026-09-19
- **Lab-verify `docs/15`'s PowerShell script section, fix a bug in
  Broadcom's own README.** Downloaded the real
  `VcfBaselineClusterTransition.ps1` release and ran it against the
  holodeck lab's SDDC Manager. `-Connect`, `-ShowBaselineResources`, and
  `-ShowImagesInVcenter` all worked and returned correct results. Found
  and fixed:
  - The upstream README's own compliance-check example uses
    `-WorkloadDomain`, a parameter the script doesn't actually define –
    only `-WorkloadDomainName` exists (confirmed by reading the script's
    `Param()` block). Fixed the copied example.
  - `Install-Module -Name VCF.PowerCLI` fails with an Authenticode
    publisher mismatch against an existing `VMware.PowerCLI` install (the
    VMware→Broadcom code-signing rebrand) – documented the
    `-SkipPublisherCheck` fix.
  - `VCF.PowerCLI` actively conflicts with a co-installed
    `VMware.PowerCLI` (the module this repo's other snippets use) – noted
    as a real gotcha if both are ever needed in the same session.
  - `-CreateHostRemediationOptionsFile` is fully interactive with no
    unattended path at all, despite being an ordinary-looking CLI flag –
    confirmed it hangs on stdin and explicitly refuses `-Silence`.
  Added a non-interactive `-Connect -JsonInput` example (confirmed
  working) as an alternative to the interactive prompt.

## v1.0.6 – 2026-09-19
- **New guide: `docs/15-vum-to-vlcm-migration.md`.** vLCM baselines aren't
  supported on VCF 9.0+, and this prerequisite was previously just a bare
  line in `docs/13`'s prerequisites table and the VxRail addendum's vLCM
  row, with no procedure of its own – promoted per the "promote a topic to
  its own `docs/NN-*.md`" rule (GitHub issue #1). Covers both mechanisms:
  the `VcfBaselineClusterTransition.ps1` PowerShell script (VCF, SDDC
  Manager-driven, sourced from the script's GitHub repo README) and the
  native vSphere Client wizard (standalone VVF, no SDDC Manager), plus two
  real gotchas – a documented extraction failure on hosts with ISO-upgrade
  history (Broadcom KB 407728) and NSX-enabled-cluster-specific caveats
  (credited to ITQ's own published write-up). Cross-linked from
  `docs/13`, `docs/14`, and `vxrail-addendum.md`; added to
  `web/src/nav.ts`, `README.md`, and this file's file-layout table.
  Verified the Astro build stays clean with the new nav entry before
  pushing.

## v1.0.5 – 2026-09-19
- **Make GitHub Issues the primary issue tracker, to match `origin`.**
  GitLab now only serves as a secondary push target and the internal Pages
  mirror – it's no longer where issues get filed. Updated CLAUDE.md's
  GitHub issues discipline and Git remotes sections accordingly.

## v1.0.4 – 2026-09-19
- **Pin the exact Broadcom Support Portal path for the vSAN File Service
  download, and flag it's six files, not one OVA.** Search **Cloud
  Foundation** → select the release → **VMware vSAN** product page →
  **Drivers & Tools** tab → **VMware vSAN File Services Appliance** section
  – confirmed via screenshot against a real download for 9.1.1.0. The
  section lists the `.ovf` plus `.mf`/`.cert` signature files and three
  separate `.vmdk` disks (cloud-components, log, system); all six need to
  land in the same folder before pointing the wizard's file picker at the
  `.ovf`, or deployment fails partway through.

## v1.0.3 – 2026-09-19
- **Call out the manual OVA download for vSAN File Service upgrades.** The
  "vSAN File Service in detail" section described the Automatic/Manual
  choice in the upgrade wizard but didn't flag that Manual mode is just a
  file picker – it doesn't fetch or point at the OVA, so it has to be
  downloaded from the Broadcom Support Portal ahead of time, and Automatic
  needs depot/internet reachability that a restricted environment may not
  have. A real, if not complicated, trip-up.

## v1.0.2 – 2026-09-19
- **Add a vDS version check to the post-upgrade PowerCLI spot-check.** The
  checklist already listed "vSphere Distributed Switch – upgrade vDS
  versions" as an item, but the script didn't check it. Added a
  `Get-VDSwitch` line, marked **Untested** – not yet run against a live
  vCenter, unlike the rest of that script's lines.

## v1.0.1 – 2026-09-19
- **Fix "this lab" → "my lab" in the two lab-verified PowerCLI callouts.**
  The docs are authored in Paul's voice; referring to his own holodeck lab
  as "this lab" read as if someone else were narrating it.

## v1.0.0 – 2026-09-19
- **Make `origin` point to GitHub instead of GitLab.** Plain `git push`/
  `git pull` now default to the public GitHub repo. Renamed remotes
  (`origin` → `gitlab`, `github` → `origin`), re-pointed `main`'s upstream
  to `origin/main`, and updated the `pushall` alias to `git push origin &&
  git push gitlab`. GitLab stays primary for ITQ-internal **issue
  tracking** only – that didn't change, just the push target. Updated
  CLAUDE.md's Git remotes table and the GitHub issues discipline section's
  cross-reference to match.

## v0.9.9 – 2026-09-19
- **Lab-verify the two PowerCLI scripts added in v0.9.7, fix what broke.**
  Ran both against the holodeck lab (PowerCLI 13.3.0, vCenter/ESXi 9.1.1),
  including building throwaway VSS port groups to actually exercise
  `08-vss-to-vds-migration.md`'s inventory logic (the lab's real cluster is
  VDS-only). Found and fixed two real bugs, not lab quirks:
  - `Get-VMHostNetworkAdapter -VMKernel` throws outright on ESXi 9.1.1
    (`Requested value 'vnetworking' was not found.`) – a new-in-9.1
    VMkernel service type this PowerCLI version's enum doesn't recognize,
    breaking the cmdlet for every adapter on the host. Replaced with a
    direct `HostSystem.Config` read in `08-vss-to-vds-migration.md`.
  - `Get-VsanClusterConfiguration` has no `DiskFormatVersion` property in
    this PowerCLI version at all. Replaced with `Get-VsanDiskGroup` (which
    does carry it, per host/disk group) in
    `13-vcf-upgrade-sequence.md`'s post-upgrade validation spot-check.
  Both scripts' callouts updated from "Untested" to "Lab-verified
  2026-09-19", with call-outs on what still isn't covered (VSS-backed
  VMkernel `PortGroup` resolution, and populated NIC-teaming uplinks –
  the lab's throwaway switch had no physical uplink to test against).

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
- **`docs/01-overview.md`, `docs/04-field-notes.md` – close out two
  remaining open items** (issue #17). **01-overview.md**: documented
  **VCF Operations Orchestrator** (formerly Aria Automation Orchestrator)
  in Phase 4 – upgrades alongside Automation, manual on a 5.2.x source,
  driven by VCF Operations on a 9.0.x source; a component not previously
  documented in this repo. **04-field-notes.md**: logged the "optimized"
  combined vCenter +
  NSX Manager upgrade window (prep vCenter, upgrade NSX, then switchover)
  as an open question – the mechanics relative to the RDU switchover
  weren't confirmed, so the doc explicitly defaults to the sequential
  Phase 5 → Phase 6 order until clarified.

## v0.5.5 – 2026-09-11
- **`docs/01-overview.md` – pre-upgrade precheck detail, small wording
  fix** (issue #17). Expanded the pre-upgrade precheck section with
  detail on per-domain and per-component check behavior (run separately
  so ESXi checks can proceed in parallel on a large environment) and
  per-cluster interactive credential-prompt behaviour for the VVF path.
  Corrected the 9.0.x source path label from "fleet transition" to
  Broadcom's actual term, **fleet-lifecycle transition**.

## v0.5.4 – 2026-09-11
- **`docs/01-overview.md`, `docs/04-field-notes.md` – open-item
  follow-ups** (issue #17). **01-overview.md**: added a **Bundle staging**
  prerequisites row – bundles downloaded/staged/integrity-checked, and free
  disk space confirmed on SDDC Manager (a common, avoidable staging
  failure). **04-field-notes.md**: logged two unconfirmed items as open
  questions rather than guessing at their meaning – **VCFverify (VoV only)**
  (listed as a Dell VxRail pre-check tool, but neither "VoV" nor what it
  checks is confirmed) and **NSX Intel** (likely NSX Intelligence, not
  confirmed, no documented upgrade interaction yet).

## v0.5.3 – 2026-09-11
- **`docs/01-overview.md`, `docs/03-identity-broker-migration.md`,
  `docs/04-field-notes.md` – further updates** (issue #17), covering
  the 9.0.x fleet-transition path, hard blockers, and time estimates.
  **01-overview.md**: added a hard-blocker callout that **Avi Load Balancer
  32.1.1 is the minimum for VCF 9.1** (NSX / vCenter upgrades block below
  it); added a hard-blocker note that the first VCF Instance needs a Cloud
  Proxy or the upgrade cannot complete, including the no-Aria-present case;
  added a per-component **time-estimate table** (SDDC Manager, NSX-T,
  vCenter, ESXi, Aria Suite LCM, post-upgrade checks) gathered from field
  experience and general Broadcom planning guidance; added a lead-in to
  **Post-upgrade validation** covering a re-run of the fleet precheck, a
  vSAN Skyline Health re-check, and evidence packaging for handover,
  mirroring the pre-upgrade gate.
  **03-identity-broker-migration.md**: new section for the **9.0.x
  fleet-transition path** – an existing Identity Broker 9.0.x on an NSX
  overlay network fails the VCF Operations upgrade outright unless first
  moved to the VCF management network (condition, procedure, and
  maintenance-window impact). **04-field-notes.md**: new **VCF Automation**
  section correcting an unconfirmed claim – Broadcom KB 403314 only covers
  migrating Idem-based Avi load-balancer resources, it is not a blanket
  "must be on Aria Automation 8.18.1 Patch 3" upgrade prerequisite.

## v0.5.2 – 2026-09-11
- **`docs/01-overview.md`, `docs/04-field-notes.md`, `docs/vxrail-addendum.md`
  – further precheck-gate follow-ups** (issue #17). **01-overview.md**:
  expanded the single-line rollback
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
  content** (issue #17). Sourced from a customer TC process review.
  **Run the pre-upgrade precheck**: documented Broadcom's supplementary
  precheck gate alongside the SDDC Manager precheck.
  **Prerequisites table**: added **CPU & TPM 2.0** and **NTP** rows;
  extended **vSAN HCL** to cover Broadcom plugin support; added a **vSAN
  health** row for the Skyline Health workflow. **Windows, ordering and
  rollback**: added per-component time estimates gathered from field
  experience and general Broadcom planning guidance; strengthened the
  rollback bullet to require a *written* per-phase backout position, not
  just verbal agreement.
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
