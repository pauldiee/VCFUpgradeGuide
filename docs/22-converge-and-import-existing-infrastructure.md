# Converge and Import: bringing existing infrastructure under VCF

Two distinct Broadcom mechanisms get lumped together in conversation but
are procedurally different, driven by different tools, and solve
different problems. Confirm which one actually applies before planning
around either:

| | **Converge** | **Import** |
| --- | --- | --- |
| Driven by | **VCF Installer** | **VCF Operations** (after the management domain already exists) |
| Starting point | Existing standalone vSphere infra, **no VCF at all yet** | An existing vCenter (with or without NSX), brought into an **already-running** VCF fleet |
| Result | A **new** VCF or VVF instance/fleet, built from that infrastructure | A **new workload domain** added to that fleet |
| Applies to | VCF or VVF (Broadcom's own doc title: *"Converging Existing Virtual Infrastructure to a VCF or a vSphere Foundation Platform"*) | **VCF only** – needs VCF Management Services / SDDC Manager to import into, which doesn't exist on standalone VVF |

If there's no VCF fleet yet and the goal is to build one from existing
kit, that's Converge. If a fleet already exists and the goal is to add
an existing vCenter to it as another workload domain, that's Import.

---

## Converge: existing vSphere becomes a new VCF or VVF platform

Per Broadcom's [Converging Existing Virtual Infrastructure to a VCF or a
vSphere Foundation
Platform](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-.html):
*"You can use your existing virtual infrastructure as building blocks for
your VCF or vSphere Foundation platforms."* Three phases: manual upgrade
of existing components to a qualifying 9.x-era build first, infrastructure
preparation, then automated deployment via **VCF Installer** – *"By using
the VCF Installer workflows, you can converge the components to a new VCF
Fleet or a new VCF Instance in an existing VCF fleet."*

**Version bar before VCF Installer's converge workflow will run against
an existing vCenter** (per [Operations
modernization](05-operations-modernization.md#when-vcf-installer-is-the-better-fit-instead)):

- **vCenter 9.0+** to converge directly to VCF 9.0.0.
- **vCenter 8.0 U3+** is acceptable for converging to 9.0.1/9.0.2 **only
  if** it already has an existing NSX registration at **4.2.1+** –
  otherwise the vCenter needs upgrading first.
- **ESX** carries an equivalent gate: 9.0+ for a 9.0.0 target; 8.0 U1+
  acceptable for 9.0.1/9.0.2 scenarios.

**VCF Installer does not upgrade vCenter for you as part of
convergence** – the manual upgrade happens first, then Installer
orchestrates NSX / SDDC Manager / workload-domain creation once the
vCenter already qualifies. See Broadcom's [Supported and Not Supported
Configurations to
Converge](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-/supported-and-not-supported-configurations.html)
and [Supported Components and Scenarios to
Converge](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-/supported-scenarios-to-converge-to-vcf.html)
for the full scenario matrix before committing to a converge plan.

---

## Import: an existing vCenter becomes a new workload domain (VCF only)

Per Broadcom's [Import an Existing vCenter to Create a Workload
Domain](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/building-your-private-cloud-infrastructure/working-with-workload-domains/import-an-existing-vcenter-to-create-a-workload-domain.html) –
driven from **VCF Operations**: **Operate → Overview → Inventory →
Detailed View → VCF Instances → "Add workload domain" dropdown → "Import
a vCenter."**

### Minimum versions

| Component | Minimum |
| --- | --- |
| VCF instance | 9.0+ |
| vCenter | 8.0 Update 3a+ |
| ESX | 8.0 Update 3+ |
| NSX Manager (optional – see below) | 4.2.1+ |

**NSX 9.1 specific warning, quoted verbatim:** *"NSX 9.1 does not support
vCenter 8.0 Update 3a or later. If your vCenter instance is without an
existing NSX registration and you plan to use a shared NSX 9.1 instance
or deploy a 9.1 NSX instance during the import procedure, first upgrade
your vCenter instance to version 9.1."*

### Prerequisites checklist

Official checklist items, quoted verbatim where noted:

- *"Verify that SSH is enabled on the existing vCenter instance."*
- *"Verify that all ESX hosts use FQDNs instead of short names in your
  vSphere inventory."*
- *"Verify that SDDC Manager has access to all NSX Manager nodes on port
  443."*
- *"Verify that your NSX certificate contains the FQDNs of all NSX nodes
  and the NSX cluster VIP in the SAN field."*
- If there's no existing NSX registration, have the matching NSX install
  bundle available for the vCenter's version.
- If joining an existing **shared** NSX instance, its version must be
  *"the same or later than the version of the management domain"* (if no
  other workload domains share it yet) or *"the same or later than the
  version of all domains that share the instance."*

**Field-observed additional blockers** (from a practitioner's [worked
vCenter 8.x import](https://cosmin.us/importing-a-vcenter-8x-as-a-workload-domain-into-vcf-9/),
not all spelled out in the official checklist above):

- **DRS must be Fully Automated** – *"Partially automated or manual DRS
  is not supported for import."*
- **vSphere Distributed Switch (VDS) 8.0+ with at least 2 uplinks** –
  standard switches alone aren't supported; migrate off VSS first if
  still in use (see [VSS to VDS
  migration](08-vss-to-vds-migration.md) for the general procedure,
  written for the VVF-extending-to-VCF case but the same mechanics).
- **Enhanced Linked Mode must be deactivated** before import – not
  negotiable.
- **Static IPs on every VMkernel interface**, except NSX Host TEPs (DHCP
  is fine there).

### The import wizard, and its one hard constraint

1. General Information – name the workload domain.
2. Specify vCenter – select the existing vCenter (and NSX Manager, if
   already registered), supply credentials.
3. Confirm certificate thumbprints (vCenter, NSX Manager, other
   components).
4. If there's no existing NSX registration: choose deploy-new or
   join-existing-shared-instance, specify appliance/cluster FQDNs.
5. Prechecks – resolve anything flagged; export a CSV report for large
   environments if needed.
6. Review & Finish.

**"All vSphere clusters in the existing vCenter are imported as part of
this process. You cannot select a subset of the clusters."** Plan the
workload domain boundary around the whole vCenter, not a subset of its
clusters.

**Field-observed gotchas:**

- **NSX binaries not found during validation** – per the same
  practitioner account, the fix is checking **Fleet Management → VCF
  5.2** (not the 9.0/9.1 section) for the matching NSX patch binaries
  and downloading them before re-running validation – an easy place to
  look in the wrong section.
- **ESXi root passwords don't always populate in the VCF credential
  store post-import** – per Broadcom KB 388859.

---

## The shared trap: auto-selected NSX version can be chronologically incompatible

**This affects both Converge and Import whenever NSX isn't already
present or registered** – when the workflow has to deploy NSX itself,
per [VCF 9.1 - Understanding VCF Converge & Import Scenarios for vCenter
Server Without
NSX](https://williamlam.com/2026/08/vcf-9-1-understanding-vcf-converge-import-scenarios-for-vcenter-server-without-nsx.html),
VCF automatically deploys *"the latest NSX version that is compatible
with the source vCenter Server version"* – compatible with the vCenter,
but **not cross-checked against the target VCF release's chronological
BOM baseline**. The article's own example matches the exact combination
covered in this repo's [field
notes](04-field-notes.md#nsx-and-vcenter): **vCenter 8.0 Update 3c
defaults to NSX 4.2.4.1** – compatible with that vCenter build, but
unable to upgrade further to reach VCF 9.1.0's NSX baseline. Same
mechanism as the [back-in-time
restriction](07-vcenter-manual-upgrade.md#before-you-start-confirm-the-source-is-actually-on-a-supported-path)
already documented for the vCenter side (KB 448135) – this is the NSX
side of the same trap, triggered automatically during Converge/Import
rather than during a later manual upgrade choice.

**Confirmed fleet-wide blast radius, not scoped to the affected
domain:** see [Field notes: NSX and
vCenter](04-field-notes.md#nsx-and-vcenter) and [Full VCF upgrade
sequence, Phase
2](13-vcf-upgrade-sequence.md#phase-2--sddc-manager-upgrade) for a case
where an imported workload domain's auto-selected NSX 4.2.4.1 blocked a
**management-domain-only** Plan Component Upgrade, even though that
upgrade never touched the imported domain – SDDC Manager validates the
target version against the whole fleet's component inventory before
saving any domain's plan.

**Three ways to avoid or recover from it:**

1. **Pre-deploy NSX manually first**, then register the vCenter as a
   Compute Manager within NSX before converging/importing – the workflow
   detects and uses the existing deployment instead of auto-selecting
   one.
2. **Override the auto-selected version** per Broadcom KB 429205,
   ["Overriding version of NSX Manager while converging or importing an
   existing vCenter instance with new NSX Manager
   deployment"](https://knowledge.broadcom.com/external/article/429205) –
   specify the desired NSX version via Domain Manager / Operations
   Manager property files instead of accepting the latest
   vCenter-compatible one.
3. **Undo and redeploy** per Broadcom KB 430524, ["Upgrading a
   Brownfield-imported domain fails during the upgrade pre-check phase
   due to an unsupported upgrade path for
   NSX"](https://knowledge.broadcom.com/external/article/430524/upgrading-a-brownfieldimported-domain-fa.html) –
   applies to **workload domains only, not the management domain**.

Older NSX releases (4.1.x) may need a **two-hop upgrade** to reach VCF
9.1.0 even after correcting the version-selection issue. This same
chronological pattern isn't unique to the 9.1 line either – Broadcom KB
430825 documents an equivalent NSX 4.2.3.3 back-in-time block on a VCF
5.2.2 → 9.0.1/9.0.2 upgrade, so treat "check the exact source build
against the exact target build" as a standing rule for any
Converge/Import/upgrade combination, not a 9.1-specific quirk.

---

## Sources

- [Converging Existing Virtual Infrastructure to a VCF or a vSphere Foundation Platform](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-.html)
- [Supported and Not Supported Configurations to Converge to VCF](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-/supported-and-not-supported-configurations.html)
- [Supported Components and Scenarios to Converge to VCF](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-/supported-scenarios-to-converge-to-vcf.html)
- [Import an Existing vCenter to Create a Workload Domain](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/building-your-private-cloud-infrastructure/working-with-workload-domains/import-an-existing-vcenter-to-create-a-workload-domain.html)
- [Importing a vCenter 8.x as a Workload Domain into VCF 9 (Cosmin.us)](https://cosmin.us/importing-a-vcenter-8x-as-a-workload-domain-into-vcf-9/) – practitioner walkthrough, prerequisites not in the official checklist, and the NSX-binaries-in-the-wrong-Fleet-Management-section gotcha
- [VCF 9.1 - Understanding VCF Converge & Import Scenarios for vCenter Server Without NSX (williamlam.com)](https://williamlam.com/2026/08/vcf-9-1-understanding-vcf-converge-import-scenarios-for-vcenter-server-without-nsx.html) – root cause of the auto-selected NSX back-in-time trap
- [Overriding version of NSX Manager while converging or importing an existing vCenter instance with new NSX Manager deployment (Broadcom KB 429205)](https://knowledge.broadcom.com/external/article/429205)
- [Upgrading a Brownfield-imported domain fails during the upgrade pre-check phase due to an unsupported upgrade path for NSX (Broadcom KB 430524)](https://knowledge.broadcom.com/external/article/430524/upgrading-a-brownfieldimported-domain-fa.html)
- [VCF Upgrade Failure: Cannot Upgrade VCF 5.2.2 to 9.0.1 or 9.0.2 Due to NSX Back-in-Time Error (NSX 4.2.3.3) (Broadcom KB 430825)](https://knowledge.broadcom.com/external/article/430825/vcf-upgrade-failure-cannot-upgrade-vcf-5.html)
- [NSX Back in Time: Resolving an Upgrade-Path Blocker When Importing vCenter 8 into VCF 9.1 (Angry Admin)](https://angrysysops.com/2026/07/23/nsx-back-in-time-resolving-an-upgrade-path-blocker-when-importing-vcenter-8-into-vcf-9-1/) – field-verified case with the exact error text, cross-linked from [field notes](04-field-notes.md#nsx-and-vcenter)
