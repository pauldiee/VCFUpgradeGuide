# Patching an existing VCF 9.1 fleet (maintenance releases)

**This is about applying a maintenance release to a fleet already
running VCF 9.1** – e.g. 9.1.0.x → 9.1.1 – not the initial 5.2/8.x → 9.x
upgrade, which is its own much larger project covered in [Full VCF
upgrade sequence](13-vcf-upgrade-sequence.md). Patching is smaller in
scope but has its own strict component ordering, separate from that
9-phase spine.

Applies to VCF and VVF alike for the depot/binary mechanics; the
component patching order below is VCF-specific (SDDC Lifecycle, NSX,
Fleet-Management-driven components) – a standalone VVF fleet has fewer
of these components to sequence in the first place.

---

## Two kinds of patch in 9.1: maintenance releases vs. Express Patches

9.1 introduced **Express Patches (EPs)** as a faster delivery mechanism
alongside full maintenance releases, and they follow different rules:

- **Maintenance release** (e.g. 9.1.0 → 9.1.1) – the scenario this doc
  covers. Strict component dependency order, covered below.
- **Express Patch** – targeted security/product fixes shipped as soon as
  they're ready rather than bundled into a scheduled release, named
  `9.1.0.01XX` (e.g. `9.1.0.0100`, `9.1.0.0200`, `9.1.0.0300`). Per
  Broadcom's own [Installing Express Patches with VMware Cloud
  Foundation 9.1](https://blogs.vmware.com/cloud-foundation/2026/06/29/installing-express-patches-with-vmware-cloud-foundation-9-1/),
  these ship at roughly a **monthly cadence** going forward, driven by
  how fast security fixes for frontier-AI-era threats need to reach the
  field. **Express Patches can be applied in any order** – each is
  independent and cumulative, so there's no need to apply earlier EPs
  first. The one ordering rule that still applies: **Fleet Lifecycle
  patches first within VCF Management Components**, same as a
  maintenance release, before moving on to core components (SDDC
  Manager, vSphere, NSX). Official steps: **Build → Lifecycle → VCF
  Management → Upgrade**, set the target version, **Run Prechecks**,
  **Upgrade** – then for core components, **Build → Lifecycle
  Management → VCF Instance → Upgrades → Plan Component Upgrade**.

The rest of this doc is about the maintenance-release case, which does
have a strict order.

### This "maintenance release" label undersells 9.1.1 specifically

Worth reading before treating 9.1.0 → 9.1.1 as routine: per [VCF 9.1.1 –
Not a Maintenance Release](https://mysticmarvin.com/blog/vcf-9-1-1-not-a-maintenance-release/),
9.1.1 bundles changes with real operational weight behind the routine
version number:

- **Public cloud management (AWS/Azure/GCP) in VCF Automation is
  disabled by default** – existing public cloud resources get marked
  **Stale** with operations blocked, and new blueprints referencing them
  show **Invalid**, immediately on upgrade (see also [KB
  448993](#known-gotchas-for-a-910x--911-patch) below for
  re-enabling it).
- **A Secure Boot certificate migration** that's framed as a feature but
  is, in practice, guest-OS remediation work: it needs **VMware Tools
  13.1.5+** and the **July 2026 Windows Cumulative Update**, and
  Windows VMs need a reboot to pick it up. Start inventorying the
  Windows estate's Tools versions before the upgrade window, not during
  it.
- **ESX 9.1.1.0 is not live-patchable**, despite messaging elsewhere
  about zero-downtime operations – plan host remediation with a normal
  maintenance-mode cycle, not an in-place live patch.
- **Distributed firewall configurations can cause upgrade failures
  needing post-installation remediation**, and **Host Profiles with
  vSAN configuration can fail batch remediation** – check both before
  relying on unattended remediation across a cluster.

---

## Step 1: Get the binaries in place

Nothing below can start until the target version's binaries are staged
in the software depot – **online** (Fleet Management connects straight
to Broadcom) or **offline** (an internal web server, populated ahead of
time). Only one depot connection can be ACTIVE at a time.

**Building the offline depot web server itself is a one-time,
foundational task** – standing up the box, the TLS cert (SAN, not just
CN), the auth split (`PROD/COMP` and `PROD/metadata` behind basic auth,
`PROD/vsan/hcl` and `umds-patch-store` open), and the initial activation
code registration. That's covered in full, field-verified detail in the
companion repo's [Binary Depot – Offline Depot & the VCF Download
Tool](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/) –
build it there if it doesn't already exist, then come back here for the
patching-specific part below.

**What's specific to patching an already-deployed fleet** (as opposed to
the initial install) is different enough to call out on its own:

### Filling the depot for a fleet upgrade – the loop

The install-time depot fill and a Day-N patch fill draw on **different
binary sets**, and VCF Operations' UI doesn't spell out how to get the
patch set – it hands you a spec file and a one-line hint. The loop:

1. **Sync the lifecycle metadata first.** The Upgrade page shows *Last
   lifecycle metadata sync time* with a **Sync** link – if it reads
   `N/A`, sync it and confirm a real timestamp before going further;
   binary availability is evaluated against that metadata.
2. **CHECK BINARY AVAILABILITY** – tells you what the fleet needs and
   what the depot is missing. This is the authoritative answer, not
   anything the CLI reports on its own.
3. **EXPORT DOWNLOAD SPECIFICATION** if you want the exact subset for
   this hop – produces a `manage-binaries.json` file and the
   instruction "use it with the VCF Download Tool to obtain these
   binaries." **It never names the flag** – it's
   `--download-spec-file`.
4. **Download** (below), into the depot store the fleet is actually
   registered against – it's easy to accidentally fill a staging
   directory nobody reads.
5. **Re-run CHECK BINARY AVAILABILITY.** Still reporting gaps after a
   successful download? Suspect the metadata sync or the depot path,
   not the binaries themselves.

**Three ways to actually pull the binaries**, in order of precision:

**A – the spec file** (least guesswork):

```bash
./vcf-download-tool binaries download \
  --download-spec-file /root/manage-binaries.json \
  --depot-download-activation-code-file /root/reg.txt \
  --depot-store /depotdata \
  --proxy-server <fqdn:port>
```

**B – a filtered catalog pull**, no spec file, but **the size trade is
not small**: a bare release line returns *every* patch line at once –
`9.1.0.0`, `.0100`, `.0200`, `.0300`, `.0400` – so a single point
upgrade can drag in four vCenter builds at ~28.7 GiB each, comfortably
over 100 GiB for one hop if left unfiltered:

```bash
./vcf-download-tool binaries download --sku VCF --vcf-version 9.1.0 \
  --type UPGRADE --depot-store /depotdata \
  --depot-download-activation-code-file /root/reg.txt \
  --proxy-server <fqdn:port>
```

**C – by binary ID** (the middle ground – no spec file, no superfluous
lines either): list first with `binaries list`, take the IDs for the
release wanted, feed them back with `--id=<id1>,<id2>,<id3>`.

Key filters (`--vcf-version` accepts ranges like `9.1.0..9.1.1`;
`--component` takes `VCENTER`, `SDDC_MANAGER_VCF`, `NSX_T_MANAGER`,
`ESX_HOST`, `VROPS`, `VRLI`, `VRNI`, `VSP`, and others; `--type` is
`INSTALL` or `UPGRADE` only – there's no `PATCH` type, though `UPGRADE`
rows display as `PATCH`). Run long pulls detached (`screen`/`nohup`) and
watch `<toolroot>/log/vdt.log` – the tool has its own free-space
precheck and refuses rather than filling the disk.

### The gotcha that looks nothing like a depot problem

**A fresh download lands root-owned; nginx (or whichever web server)
can't read it, and answers 403 – but the fleet never surfaces a 403.**
Instead, a VCF Operations upgrade precheck fails at subtask **Stage
Precheck Binaries** with a generic `ops.task.stage.failed` – that
task's only job is fetching bits, so a failure there is a
binary-delivery problem, not an environment-readiness one, even though
nothing about the error says "permissions." Re-apply ownership after
**every** download, not just the initial build:

```bash
chown -R nginx:nginx /var/www/offline_depot
chmod -R a+rX /var/www/offline_depot
```

(Capital `X` sets execute on directories only, so directories stay
traversable and files stay non-executable.) The durable fix – a systemd
path unit that re-applies this automatically on every write to the
store, so it stops depending on someone remembering – is in the
companion repo's [depot doc, §6](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/#gotcha-a-fresh-download-lands-root-owned--nginx-403s-and-the-precheck-fails).

### A disconnected depot doesn't auto-fetch Day-N binaries either

Optional components added after initial bring-up (Log Management,
Real-time Metrics, VCF Operations for Networks) or a new VCF
Instance/domain need their own manual binary upload – not covered by
whatever was staged for the original install or a routine patch cycle.

### Reclaiming space

`binaries cleanup` takes the same filter groups as `download`
(`--vcf-version`, `--id`, or `--download-spec-file`, mutually
exclusive). **Always use the exact four-part version** when pruning one
line – a short version string matches broadly on `cleanup` too, and
there's no `--dry-run`; preview with `binaries list` using the same
filters first:

```bash
./vcf-download-tool binaries cleanup --depot-store=/depotdata \
  --vcf-version=9.1.0.0100 --type=UPGRADE
```

Safest to remove, in order of confidence: superseded patch lines you
won't roll back to, then `INSTALL` bundles for components already
deployed – but keep the ESX install bundle if a future host
commissioning or cluster add is still possible.

---

**A depot patch blocks every other component patch while it's in
progress** – per Broadcom's [Lifecycle Management of VCF
Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html),
*"patching other components is blocked because the patch binaries are
unavailable."* Don't schedule a depot update alongside anything else,
and **download every component's binaries before starting** the order
in Step 2 – running out partway through stalls the whole sequence.

---

## Backup before patching, and what rollback actually means

**Some components back themselves up automatically as part of the
patch; others don't, and confusing the two is the mistake to avoid.**

- **Identity Broker, Log Management, and Software Depot get an
  automatic pre-patch backup**, written to a **fleet-level SFTP
  target** configured at **Build → Lifecycle → VCF Management → Backup
  & Restore**. This isn't optional or skippable – it's a precheck gate
  the patch runs through, and it has two documented failure modes worth
  checking *before* a patch window, not during one:
  - **The backup server's FQDN must be all-lowercase.** Per Broadcom KB
    453300, an FQDN configured with any uppercase characters fails the
    SSH known-hosts check with `ssh: handshake failed: knownhosts: key
    is unknown` – reconfigure the backup location with an all-lowercase
    FQDN and retry.
  - **The SFTP target needs free space before the patch, not found out
    during it.** Per Broadcom KB 441165, a `vidb` component backup can
    time out with the generic error `VCFMS-BACKUP-COMPONENT-006` when
    the backup server is out of space – the error itself gives no hint
    that disk space is the cause. Clear space on the backup/SFTP server
    ahead of time.
- **VCF Automation is backed up file-based to the same kind of
  fleet-level SFTP target**, in a predictable
  `vcf/backups/<cluster-name>/<version>/<component-name>/<timestamp>/`
  layout – but this is a separate, standing backup configuration to
  verify is current, not something the patch process necessarily
  triggers fresh for you the way it does for the three components
  above. **Back up VCF Automation and Identity Broker together, on the
  same schedule** – VCF Automation's data (orgs, catalog) is
  meaningless without Identity Broker's authentication data, so a
  time-misaligned pair of backups can restore an instance that holds
  everything and lets no one log in.
- **Take a snapshot of the appliance before patching it regardless** –
  the platform's own automatic component backups don't cover every
  component in the order (SDDC Lifecycle, Salt RaaS/Master, Real-Time
  Metrics, Telemetry have no documented automatic pre-patch backup), so
  a snapshot is the actual safety net for those. Delete it once the
  patch is confirmed successful – a lingering snapshot degrades
  performance, and a snapshot is a short-lived safety net for the patch
  window, not a substitute for the real backup story above.

**There is no clean, one-click rollback for a failed VCF Management
Services component patch.** Recovery is either reverting the pre-patch
snapshot or restoring from the file-based backup – not an automatic
"undo," and not always straightforward: the [Upgrade All failure
account](#step-2-respect-the-mandatory-dependency-order) above is a real
example where "rolling back" a stuck component meant manually deleting
a Helm Bundle and resetting the target version by hand, not clicking a
button. The same "no single undo, recovery is per-component" reality
that [Full VCF upgrade sequence: Windows, ordering and
rollback](13-vcf-upgrade-sequence.md#windows-ordering-and-rollback)
documents for the initial major upgrade applies here too.

---

## Step 2: Respect the mandatory dependency order

Quoted verbatim from Broadcom's [Lifecycle Management of VCF
Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html)
TechDocs – these are hard constraints for a 9.1.0.x → 9.1.1 patch, not
suggestions:

- *"You begin applying the 9.1.1 maintenance release in your 9.1.0.x
  environment by patching the VCF management services fleet lifecycle
  component to 9.1.1 before any other VCF component."* Fleet Lifecycle
  always goes first.
- *"VCF Operations must not be patched in parallel with other
  components."* Serialize it – don't batch it alongside anything else,
  and don't start other lifecycle operations while it's running.
- *"Before you patch ESX hosts from 9.1.0.x to 9.1.1.0, you must first
  patch the VCF Operations instance and the license servers connected
  to it."* Cloud Proxy and License Server patch automatically as part
  of the VCF Operations patch – no separate step for either.
- *"Before you patch an identity broker instance from 9.1.0.x to
  9.1.1, you must first patch the respective VCF management services
  runtime that hosts the identity broker instance."*
- *"Before you patch Salt RaaS from 9.1.0.x to 9.1.1, you must first
  patch the respective VCF management services runtime that hosts the
  Salt RaaS instance."* Same rule as Identity Broker: the runtime
  hosting a service patches before that service.
- *"Before you patch the migration service engine component from
  9.1.0.x to 9.1.1, you must first patch VCF Automation."*

### The full 9.1.1 order in practice

A practitioner's documented, component-by-component 9.1.0.x → 9.1.1
patching run – [Upgrading VCF Management Components to 9.1.1 All in One
(Cosmin.us)](https://cosmin.us/upgrading-vcf-management-components-to-9-1-1-all-in-one/)
– consistent with the constraints above and specific to 9.1.1 (not the
9.0.x line) – **not independently field-verified in this repo, but the
closest thing to a full worked example currently available**. Reordered
here from that source to put VCF Services Runtime second (Cosmin.us had
VCF Operations second) per the fixed-order confirmation below:

1. **Fleet Lifecycle** – required first, no exceptions
2. **VCF Services Runtime** – required second, before Identity Broker or
   Salt RaaS on that same instance
3. **VCF Operations** – as its own standalone appliance update, before
   ESX host patching and never in parallel with other components
4. **SDDC Lifecycle** – before scaling Services Runtime from Small to
   Small (High Availability), if that's planned
5. **VCF Automation** – before the Migration Service Engine
6. **Migration Service Engine** (VCD_MIGRATOR)
7. **Identity Broker** – only after its Runtime is already on 9.1.1
8. **Salt RaaS** – only after its Runtime is already on 9.1.1
9. **Salt Master** – after Runtime
10. **Log Management** – before Operations for Networks
11. **Operations for Networks** – sequentially after Log Management, not
    in parallel with it (see gotchas below)
12. **Real-Time Metrics Store**
13. **Real-Time Metrics**
14. **Telemetry** – last

**Only the first two steps are a truly fixed requirement – the rest is
one valid sequence, not the only one.** Per a second independent
account, [Patching Order: VCF Management Components
9.1.1.0](https://arunnukula.com/blog/patching-order-vcf-management-components-9-1-1-0):
*"Fleet Lifecycle"* must go first because it *"orchestrates the
patching of the rest of the components, so nothing else moves until
this one is on 9.1.1.0,"* and *"VCF Services Runtime"* goes second
because it *"hosts the rest of the management components, so it has to
be patched before them."* Past those two, Fleet Lifecycle manages the
remaining dependencies automatically, and the account describes the
rest as having **no fixed order** beyond the specific pairwise
constraints already listed above (Identity Broker/Salt RaaS after their
runtime, VCF Automation before Migration Service Engine, VCF Operations
never in parallel). The 14-step list above is a safe sequence that
satisfies every constraint, not evidence that steps 3–14 must run in
that exact order.

**The VCF Automation → Migration Service Engine rule has a concrete
failure mode, not just a documentation warning.** Per the same account:
patch Migration Service Engine before VCF Automation, and it *"runs for
six hours and then fails on `vmsp_upgrade`"* – a slow, expensive way to
relearn the ordering rule rather than a quick, obvious error.

**Do not use an "Upgrade All" button if one is offered – it starts
components in parallel, ignoring the dependency order above.** Broadcom
separately documents a lesser version of this (a component finishing
but staying stuck on "Ready for upgrade" even though builds already
match), but the real-world failure mode is worse than a cosmetic status
glitch. Per [Upgrade All: how one button left a VCF 9.1.1 lab
deadlocked for two weeks](https://mb-labs.de/2026/09/18/upgrade-all-how-one-button-left-my-vcf-9-1-1-lab-deadlocked-for-two-weeks/):

- **Upgrade All** kicked off **VCF Automation and the Migration Service
  Engine at the same time**, letting the Migration Service Engine start
  *before* VCF Automation – directly violating the "VCF Automation
  before Migration Service Engine" rule above. The Migration Service
  Engine then tried upgrading its PostgreSQL from v14 to v17, which an
  admission webhook on the still-old platform rejected (it only
  permitted v13–v15), and that kicked off an endless Flux reconciliation
  loop.
- **The UI reported everything as "Healthy" the whole time.** The
  environment looked fine and stayed in apparent daily use for **13
  days** while two independent deadlocks ran silently underneath: three
  `ConfigurationHandlers` competing for a slot the platform only allows
  one of, and the `vcd-migrator` Helm release **cycling through 19,905
  revisions** (~1,200/day) in an endless upgrade → fail → rollback →
  retry loop. The failure only surfaced when deploying ArgoCD produced a
  signature-verification error trying to reach the internal image depot.
- **The fix required deleting the offending 9.1.1 Helm Bundle** (keeping
  the working 9.1.0.0200 one) and resetting the target version back to
  it – within two minutes of that, the reconciliation loop stopped and
  the version locked. Full recovery took several more days after the
  13-day silent deadlock was even discovered.

**Patch one component at a time and wait for each task to show
Completed before starting the next** – "the UI says Healthy" is not
sufficient confirmation that a patch actually finished cleanly.

---

## Step 3: The UI walkthrough, per component

1. **Build → Lifecycle → VCF Management → Upgrade.**
2. Confirm the target version is set to the correct **9.1.1.\*** build.
3. Filter to and select a **single component row** – not multiple at
   once, per the concurrency warning above.
4. **Run Prechecks** – open **Precheck details** and remediate anything
   flagged. A warning here is the patch telling you what it's about to
   trip on; don't proceed past a red precheck.
5. Confirm the row shows **Ready for upgrade**.
6. Click **Upgrade**, open **Upgrade details**, and wait for
   **Completed** – including the final inventory sync, don't consider it
   done the moment the progress bar stops moving.
7. **Build → Lifecycle → VCF Management → Components** – verify the
   component shows **Running** and the expected target build before
   moving to the next component in the order above.

**Domain-level patching** (NSX, vCenter, ESX per workload domain) uses a
slightly different flow: navigate to the VCF domain, **Plan Upgrade**,
select the target version, confirm the change summary, then run through
the same precheck → remediate → upgrade cycle per domain.

---

## Known gotchas for a 9.1.0.x → 9.1.1 patch

- **Log Management and Operations for Networks running in parallel can
  cause issues** – per Broadcom [KB 388305, "Parallel Deployment of VCF
  Operations Networks and VCF Operations Logs from Fleet Management
  fails while Pushing
  Capabilities"](https://knowledge.broadcom.com/external/article/388305/parallel-deployment-of-vcf-operations-ne.html).
  This is exactly why the order above puts Log Management strictly
  before Operations for Networks, not just conveniently near it.
- **VCF Automation 9.1.1 deprecates AWS/Azure/GCP support by default**
  (Broadcom KB 448993 – no direct URL confirmed, search the Broadcom
  Support Portal for the number) – confirm this doesn't affect an
  in-use integration before patching.
- **Custom VCF Automation profiles carried over from 9.0.x/9.1.0.x must
  be cleaned up before the upgrade** (Broadcom KB 451147 – no direct
  URL confirmed, search the Broadcom Support Portal for the number), or
  the patch can fail against them.
- **Operations for Networks XL deployments may need an additional 1TB
  disk** added before patching – per Broadcom [KB 400822, "VCF
  Operations for Networks reports Appliance disk not configured
  according to disk
  guidance"](https://knowledge.broadcom.com/external/article/400822/aria-operations-for-networks-reports-app.html),
  an X-Large deployment needs a manually-added extra 1TB disk to meet
  the XL brick size's 2TB requirement. Check sizing ahead of time, not
  after the patch stalls on disk space.
- **If planning to scale VCF Services Runtime from Small to Small (High
  Availability)**, patch SDDC Lifecycle to 9.1.1 first – doing it the
  other way round is unsupported per the order above.

---

## Rough timing, per component

From the same 9.1.0.x → 9.1.1 practitioner run referenced above – treat
as a planning reference, not a commitment (see the general caveat about
per-component time estimates in [Full VCF upgrade sequence: Windows,
ordering and rollback](13-vcf-upgrade-sequence.md#windows-ordering-and-rollback)):

| Component | Rough duration |
| --- | --- |
| Fleet Lifecycle | ~15-20 min |
| VCF Services Runtime | ~5 hr 45 min (full workflow) |
| SDDC Lifecycle | ~15 min prechecks, ~49 min upgrade |
| Log Management | ~1 hr 11 min |
| Operations for Networks | ~2 hr 9 min |
| Real-Time Metrics Store | ~44 min |
| Real-Time Metrics | ~47 min |
| Telemetry | ~44 min |

---

## Sources

- [Binary Depot – Offline Depot & the VCF Download Tool (VCF9-DeploymentPlanning)](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/) – the companion repo's full, field-verified offline-depot build-out and the Day-N "filling the depot for a fleet upgrade" procedure Step 1 draws on above
- [Lifecycle Management of VCF Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html) – the mandatory dependency-order quotes in Step 2
- [Configure a Software Depot Connection Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/connect-sddc-manager-to-a-software-depot-for-downloading-bundles.html)
- [Set Up an Offline Depot](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/set-up-an-offline-depot-web-server-for-vmware-cloud-foundation.html)
- [Download Binaries to an Offline Depot by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/download-bundles-to-an-offline-depot.html)
- [Download Binaries to Software Depot in Disconnected Mode by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/offline-download-of-vmware-cloud-foundation-5-2-upgrade-bundles.html)
- [VCF 9.1 - VCF Download Tool (VCFDT) Cheatsheet](https://williamlam.com/2026/05/vcf-9-1-vcf-download-tool-vcfdt-cheatsheet.html) – concrete VCFDT command examples
- [VCF 9.1 - New HTTP Offline Depot Support for VCF Installer & Fleet Depot Service](https://williamlam.com/2026/05/vcf-9-1-new-http-offline-depot-support-for-vcf-installer-fleet-depot-service.html)
- [Installing Express Patches with VMware Cloud Foundation 9.1 (official VMware Cloud Foundation blog)](https://blogs.vmware.com/cloud-foundation/2026/06/29/installing-express-patches-with-vmware-cloud-foundation-9-1/) – the official Express Patch procedure, cadence, and ordering rule
- [VCF 9.1 - Understanding VCF Express Patches](https://williamlam.com/2026/07/vcf-9-1-understanding-vcf-express-patches.html) – supplementary community write-up of the same mechanism
- [Upgrading VCF Management Components to 9.1.1 All in One (Cosmin.us)](https://cosmin.us/upgrading-vcf-management-components-to-9-1-1-all-in-one/) – the full 14-step worked order, UI walkthrough, gotchas (KB 388305, 448993, 451147, 400822), and timing table – a practitioner account, not a Broadcom TechDocs page
- [Upgrade All: how one button left a VCF 9.1.1 lab deadlocked for two weeks](https://mb-labs.de/2026/09/18/upgrade-all-how-one-button-left-my-vcf-9-1-1-lab-deadlocked-for-two-weeks/) – the real-world Upgrade All / parallel-patching failure mode
- [VCF 9.1.1 – Not a Maintenance Release](https://mysticmarvin.com/blog/vcf-9-1-1-not-a-maintenance-release/) – the Secure Boot cert migration, ESX live-patching, distributed firewall, and Host Profile/vSAN gotchas
- [Patching Order: VCF Management Components 9.1.1.0](https://arunnukula.com/blog/patching-order-vcf-management-components-9-1-1-0) – a second independent account confirming only Fleet Lifecycle and VCF Services Runtime are strictly fixed-first, plus the concrete 6-hour `vmsp_upgrade` failure symptom
- [VCF management component upgrade fails due to backup precheck failure (Broadcom KB 453300)](https://knowledge.broadcom.com/external/article/453300/vcf-management-component-upgrade-fails-d.html) – the automatic pre-patch backup mechanism and the lowercase-FQDN requirement
- [VCF 9.1 upgrade fails with Error - Backup for component vidb timed out (Broadcom KB 441165)](https://knowledge.broadcom.com/external/article/441165/vcf-91-upgrade-fails-with-error-backup.html) – the disk-space-on-backup-server failure mode behind `VCFMS-BACKUP-COMPONENT-006`
- [Backup, DR and Upgrade of the VCF Automation Instance (VCF Automation 9 Series, Part 29)](https://drpranayjha.com/vcf-automation-backup-dr-upgrade/) – VCF Automation's file-based backup, the Identity Broker time-alignment dependency, and why a snapshot isn't a backup
