# Patching an existing VCF 9.x fleet (maintenance releases)

**This is about applying a maintenance/patch release to a fleet already
running VCF 9.x** – e.g. 9.1.0.x → 9.1.1 – not the initial 5.2/8.x → 9.x
upgrade, which is its own much larger project covered in [Full VCF
upgrade sequence](13-vcf-upgrade-sequence.md). Patching is smaller in
scope but has its own strict component ordering, separate from that
9-phase spine.

Applies to VCF and VVF alike for the depot/binary mechanics; the
component patching order below is VCF-specific (SDDC Manager, NSX,
Fleet-Management-driven components) – a standalone VVF fleet has fewer
of these components to sequence in the first place.

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

Full detail, exact VCFDT command syntax, and sources: this used to be a
separate doc and is folded in here since it's step 1 of the same
process, not a separate concern – see the [Sources](#sources) section
below for the same citations.

---

## Step 2: Respect the mandatory dependency order

Quoted verbatim from Broadcom's Lifecycle Management of VCF Components
TechDocs – these are hard constraints, not suggestions:

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

**Net order these constraints produce:** Fleet Lifecycle → VCF
Operations (+ its License Server/Cloud Proxy, bundled automatically) →
the VCF Management Services Runtime hosting each Identity
Broker/Salt RaaS instance → those services themselves → ESX hosts. VCF
Automation ahead of its own migration service engine.

### A full worked example, end to end

The rules above cover the VCF Management Services layer specifically,
but a real maintenance cycle touches more than that. One practitioner's
documented 9.0.1 → 9.0.2 patching run, in order, consistent with the
constraints above (**not independently field-verified in this repo –
re-confirm against the current build before treating this as
authoritative for 9.1.x specifically**):

1. Fleet Management
2. VCF Operations for Logs
3. VCF Operations
4. VCF Operations for Networks
5. VCF Automation
6. SDDC Manager
7. NSX (management domain first, then each workload domain)
8. vCenter
9. Host firmware
10. ESX
11. vSAN File Services

---

## Step 3: The actual UI walkthrough

Per Broadcom's documented pattern (**Fleet Management → Lifecycle →
VCF Management**), applying a patch to most components follows the same
shape:

1. **Binary Management → Patch Binaries** (or **Upgrade Binaries**),
   select the component, **Download** – this pulls from whichever depot
   is connected, per Step 1.
2. In the component's **Components** tab, select the target appliance,
   click **Upgrade** (or **Update Now** for SDDC Manager specifically).
3. **Trigger Inventory Sync** before proceeding, if prompted – then
   **Proceed**.
4. **Run Prechecks** – open the precheck details and remediate anything
   flagged. A warning here is the patch telling you what it's about to
   trip on; don't proceed past a red precheck.
5. Once the row shows **Ready for upgrade**, start the patch (**Start
   Upgrade** / **Upgrade**).
6. Monitor via the **Tasks** view (**Lifecycle → VCF Management →
   Tasks**) or the component's own **Upgrade details** panel – wait for
   **Completed**, then confirm under **Components → Summary** that the
   appliance shows **Running** on the expected build.

**Domain-level patching** (NSX, vCenter, ESX per workload domain) uses a
slightly different flow: navigate to the VCF domain, **Plan Upgrade**,
select the target version, confirm the change summary, then run through
the same precheck → remediate → upgrade cycle per domain.

---

## Known gotchas

- **90-day password expiry breaks unattended patch runs.** Several
  appliance accounts expire on the default policy, and an expired
  account fails the patch with an unhelpful error rather than a clear
  "password expired" message. Extend expiry (e.g. `passwd -x 9999 root`
  over SSH on the affected appliance) and reconcile credentials in
  **Fleet Management → Passwords** before starting a patch run, not
  after one fails.
- **VCF Operations for Networks can fill its `/` partition** with old
  upgrade bundles. Check with `df -h` before patching; if full, clear
  old bundles from `/usr/share/nginx/upgradebundle/<old-version>`.
- **Expired NSX Edge node credentials fail the NSX patch.** Update
  root/admin/audit passwords on the Edge nodes directly, then remediate
  them in **Fleet Management → Passwords** so VCF Operations' record
  matches.
- **vCenter's reduced-downtime upgrade (RDU) needs a recent
  configuration backup and a spare IP.** Confirm a backup was taken
  within the last 24 hours (check in VAMI, `https://<vcenter>:5480`)
  and that a spare static IP on the same VLAN is available before
  starting – the RDU path fails partway through without either.

---

## Rough timing, per component

From the same practitioner run (9.0.1 → 9.0.2 scope; treat as a rough
planning reference, not a commitment – see the general caveat about
per-component time estimates in [Full VCF upgrade sequence: Windows,
ordering and rollback](13-vcf-upgrade-sequence.md#windows-ordering-and-rollback)):

| Component | Rough duration |
| --- | --- |
| Fleet Management | 20-30 min |
| VCF Operations for Logs | ~10 min |
| VCF Operations | ~1 hr |
| VCF Operations for Networks | ~90 min |
| VCF Automation | ~2 hr |
| vCenter | ~1 hr |

---

## Sources

- [Lifecycle Management of VCF Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html) – the mandatory dependency-order quotes in Step 2
- [Configure a Software Depot Connection Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/connect-sddc-manager-to-a-software-depot-for-downloading-bundles.html)
- [Set Up an Offline Depot](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/set-up-an-offline-depot-web-server-for-vmware-cloud-foundation.html)
- [Download Binaries to an Offline Depot by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/download-bundles-to-an-offline-depot.html)
- [Download Binaries to Software Depot in Disconnected Mode by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/offline-download-of-vmware-cloud-foundation-5-2-upgrade-bundles.html)
- [VCF 9.1 - VCF Download Tool (VCFDT) Cheatsheet](https://williamlam.com/2026/05/vcf-9-1-vcf-download-tool-vcfdt-cheatsheet.html) – concrete VCFDT command examples
- [VCF 9.1 - New HTTP Offline Depot Support for VCF Installer & Fleet Depot Service](https://williamlam.com/2026/05/vcf-9-1-new-http-offline-depot-support-for-vcf-installer-fleet-depot-service.html)
- [VCF 9.0.x Ultimate Patching Guide (Leaha's Blog)](https://blog.leaha.co.uk/2026/01/26/vcf-9-0-x-ultimate-patching-guide/) – the full worked-example order, UI walkthrough, gotchas, and timing table – a practitioner account, not a Broadcom TechDocs page, and written for 9.0.x specifically
