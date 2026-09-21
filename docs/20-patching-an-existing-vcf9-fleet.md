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
  `9.1.0.01XX` (e.g. `9.1.0.0100`, `9.1.0.0200`, `9.1.0.0300`).
  **Express Patches can be applied in any order** – each is independent
  and cumulative, so there's no need to apply earlier EPs first before a
  later one. The one exception: *"if an EP contains Fleet Lifecycle
  fixes, you should consider applying that first since that is what
  drives the actual patch and upgrade for the VCF Fleet components."*
  Apply via **Build → Lifecycle → VCF Management → Upgrade** → **Sync**
  to refresh available patches → **Change Target Version → Customize**
  to pick a specific EP.

The rest of this doc is about the maintenance-release case, which does
have a strict order.

---

## Step 1: Get the binaries in place

Nothing below can start until the target version's binaries are staged
in the software depot – **online** (Fleet Management connects straight
to Broadcom) or **offline** (an internal web server, populated ahead of
time). Only one depot connection can be ACTIVE at a time.

- **Download token** works for general VVF/VCF binaries; **activation
  code is mandatory for ESX binaries specifically** and is the
  direction Broadcom is standardizing on for everything else too.
- The **VCF Download Tool (VCFDT)** does the actual downloading for an
  offline depot – separate commands for install binaries (`--type
  INSTALL`), upgrade/patch binaries (`--type UPGRADE
  --patches-only --component-version=<target>`), and ESX binaries
  (`esx download`, activation code only).
- A disconnected depot doesn't auto-fetch **Day-N** binaries either –
  optional components (Log Management, Real-time Metrics, VCF
  Operations for Networks) or a new VCF Instance/domain need their own
  manual upload.
- **A depot patch blocks every other component patch while it's in
  progress** – per Broadcom, *"patching other components is blocked
  because the patch binaries are unavailable."* Don't schedule a depot
  update alongside anything else.

**Download every component's binaries before starting**, not
incrementally as you reach each one – running out partway through the
order below stalls the whole sequence.

---

## Step 2: Respect the mandatory dependency order

Quoted verbatim from Broadcom's Lifecycle Management of VCF Components
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
patching run, consistent with the constraints above and specific to
9.1.1 (not the 9.0.x line) – **not independently field-verified in this
repo, but the closest thing to a full worked example currently
available**:

1. **Fleet Lifecycle** – required first, no exceptions
2. **VCF Operations** – as its own standalone appliance update
3. **VCF Services Runtime** – before Identity Broker or Salt RaaS on
   that same instance
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

**Do not use an "Upgrade (ALL)" button if one is offered.** Broadcom
documents a 9.1 lifecycle issue where running components concurrently
can interfere with plan records – a component can finish successfully
but stay stuck showing "Ready for upgrade" even though both sides
already match on build. Patch sequentially and wait for each task to
show **Completed** before starting the next.

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
  cause issues** – per Broadcom KB 388305, "Parallel Deployment of VCF
  Operations Networks and VCF Operations Logs from Fleet Management
  fails while Pushing Capabilities." This is exactly why the order above
  puts Log Management strictly before Operations for Networks, not just
  conveniently near it.
- **VCF Automation 9.1.1 deprecates AWS/Azure/GCP support by default**
  (KB 448993) – confirm this doesn't affect an in-use integration before
  patching.
- **Custom VCF Automation profiles carried over from 9.0.x/9.1.0.x must
  be cleaned up before the upgrade** (KB 451147), or the patch can fail
  against them.
- **Operations for Networks XL deployments may need an additional 1TB
  disk** added before patching – per Broadcom KB 400822, an X-Large
  deployment needs a manually-added extra 1TB disk to meet the XL brick
  size's 2TB requirement. Check sizing ahead of time, not after the
  patch stalls on disk space.
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

- [Lifecycle Management of VCF Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html) – the mandatory dependency-order quotes in Step 2
- [Configure a Software Depot Connection Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/connect-sddc-manager-to-a-software-depot-for-downloading-bundles.html)
- [Set Up an Offline Depot](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/set-up-an-offline-depot-web-server-for-vmware-cloud-foundation.html)
- [Download Binaries to an Offline Depot by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/download-bundles-to-an-offline-depot.html)
- [Download Binaries to Software Depot in Disconnected Mode by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/offline-download-of-vmware-cloud-foundation-5-2-upgrade-bundles.html)
- [VCF 9.1 - VCF Download Tool (VCFDT) Cheatsheet](https://williamlam.com/2026/05/vcf-9-1-vcf-download-tool-vcfdt-cheatsheet.html) – concrete VCFDT command examples
- [VCF 9.1 - New HTTP Offline Depot Support for VCF Installer & Fleet Depot Service](https://williamlam.com/2026/05/vcf-9-1-new-http-offline-depot-support-for-vcf-installer-fleet-depot-service.html)
- [VCF 9.1 - Understanding VCF Express Patches](https://williamlam.com/2026/07/vcf-9-1-understanding-vcf-express-patches.html) – the Express Patch mechanism, naming, and application rules
- [Upgrading VCF Management Components to 9.1.1 All in One (Cosmin.us)](https://cosmin.us/upgrading-vcf-management-components-to-9-1-1-all-in-one/) – the full 14-step worked order, UI walkthrough, gotchas (KB 452169, 448993, 451147, 454602), and timing table – a practitioner account, not a Broadcom TechDocs page
