# Standalone VVF upgrade

A companion to the [Overview](01-overview.md), expanding the **standalone
VVF** track: VMware vSphere Foundation with **no VCF Management Services**
layer – compute, storage, networking and admin run through native vSphere
management interfaces, patched with standard vSphere lifecycle mechanisms
instead of SDDC-Manager-driven phases. If SDDC Manager / Fleet Management
*is* driving the upgrade, see the
[Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) instead.

---

## Fleet-managed VVF vs. standalone VVF

This whole doc assumes **no VCF Management Services / Fleet Management**
layer – SDDC Manager, VCF Operations Fleet Management, and the License
Server all sit on that layer, and it is **mandatory for full VCF** but
**optional for VMware vSphere Foundation (VVF)** (verified against Broadcom
TechDocs, ["Deploying VMware vSphere Foundation 9.1 Without VCF Management
Services"](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/deploy-vmware-vsphere-foundation-using-the-deployment-wizard/deploying-vmware-vsphere-foundation-9-1-without-vcf-management-services.html),
2026-09-08):

- **Fleet-managed VVF** (deployed/upgraded through the VCF Installer, VCF
  Management Services present) – use the
  [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) instead; it
  applies unmodified.
- **Standalone VVF** (no VCF Management Services layer) – "deploying and
  running vSphere Foundation 9.1 without VCF management services is a
  supported deployment model." Giving up VCF Management Services also gives
  up **log management, binary management (the software depot component),
  and integrated lifecycle management of VCF Operations** – if any of those
  are required, VCF Management Services has to be deployed after all (see
  [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md)).

Confirm which model an engagement is actually on **before** running the
planner or committing to a phase count – it changes whether Phases 2 and 3
of the full-VCF sequence (SDDC Manager, VCF Management Services + License
Server) exist at all for that engagement.

---

## Confirm a supported path and pin a target build

Same general approach as the [Overview](01-overview.md#confirm-a-supported-upgrade-path):
check the Broadcom Product Interoperability Matrix and resolve a target
build to a concrete number, not a loose "9.1.1". One VVF-specific wrinkle –
**vCenter's own back-in-time restriction applies identically here**: see
[vCenter manual GUI upgrade](07-vcenter-manual-upgrade.md) for the exact
build-level detail and the standalone-path procedure.

Prerequisites for this scenario: vCenter 8 U3+, ESX 8 U3+, optionally vSAN 8
U3+ and Aria Operations 8.18.x.

---

## Standalone VVF manual upgrade – exact steps

Broadcom's dedicated scenario for this path – ["Upgrading vSphere 8 and
Optionally vSAN and Aria Operations 8 to
9.1"](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1/upgrade-to-91-from-vsphere-8-and-aria-8-environments(1).html)
(applies **only** when there is no SDDC Manager, NSX, or other Aria
components – plain vSphere, optionally vSAN and Aria Operations) – runs 6
phases, no SDDC Manager involved at any point:

1. **Aria Operations / VCF Operations.** Upgrade Aria Operations 8.18.x in
   place, **or** deploy VCF Operations 9.1 fresh if there is no existing Aria
   Operations to upgrade from.
2. **License Server.** Add a License Server manually to VCF Operations –
   **required even in this manual scenario**: *"VCF Operations and the
   license server components are required to license all 9.1.x
   environments."* This is the one piece of the VCF Management Services layer
   you cannot skip, even on the fully standalone path.
3. **vCenter.** Upgrade the vCenter instance – choose **in-place** or
   **reduced-downtime upgrade (RDU)** the same as on the fleet-managed path
   (see [RDU detail](13-vcf-upgrade-sequence.md#phase-6--vcenter-upgrade));
   driven from vCenter's own VAMI / installer, not Fleet Management. Full
   manual GUI walkthrough, including the vCenter-specific back-in-time
   compatibility check: [vCenter manual GUI upgrade](07-vcenter-manual-upgrade.md).
4. **ESX hosts.** Upgrade the ESX hosts (vLCM images) – same host-by-host
   rolling approach as the full-VCF sequence's
   [Phase 7](13-vcf-upgrade-sequence.md#phase-7--esx--host-cluster-upgrade),
   just triggered from vCenter directly. Any cluster still on vLCM
   baselines needs converting first – there's no SDDC Manager here, so use
   the vSphere Client path in
   [VUM to vLCM images migration](15-vum-to-vlcm-migration.md#vvf--plain-vsphere-track-vsphere-client).
5. **vSAN on-disk format.** Upgrade the vSAN on-disk format version, if vSAN
   is in use.
6. **vSAN File Service.** Upgrade File Service agents, if enabled – same
   procedure as
   [vSAN File Service in detail](13-vcf-upgrade-sequence.md#vsan-file-service-in-detail).

Landing here is explicitly a **stable intermediate state** – you can extend
to full VVF or VCF later (deploying VCF Management Services as a Day-N
operation) rather than needing to decide everything up front.

---

## Extending to full VCF needs a VDS migration first

**Extending standalone/VSS-based VVF to full VCF needs a VDS migration
first – it is not handled by any VCF workflow.** VVF itself has no
distributed-switch requirement (a VVF cluster can run on the Virtual
Standard Switch indefinitely, same as plain vSphere always could). Full VCF
does, for two independent reasons that both land on the same prerequisite:

- **NSX only integrates with vSphere Distributed Switch (VDS) on ESXi.**
  Per Broadcom TechDocs, ["Managing NSX on a vSphere Distributed
  Switch"](https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/4-2/administration-guide/host-switches/managing-nsx-on-a-vsphere-distributed-switch.html):
  *"In NSX 4.0, you can only use a VDS switch to prepare ESXi host nodes as
  transport nodes"* – N-VDS *"is not supported"* for that purpose (N-VDS
  remains valid only for NSX Edge VMs, not ESXi hosts). NSX 4.0+ ships in
  VCF 9, and NSX is mandatory in full VCF, at minimum for the management
  domain.
- **SDDC Manager / VCF Operations Fleet Management's own workload-domain
  automation only creates and manages clusters on VDS** – there is no VSS
  option anywhere in that create/add-cluster flow, independent of the NSX
  requirement above.

If an engagement is on standalone VVF with VSS today and the fleet is
heading toward full VCF (not just adding VCF Management Services), confirm
the VSS→VDS migration is scoped as its own prerequisite step **before**
committing to a phase count – it is a manual, per-cluster migration on the
vSphere side, not something the VCF Installer or NSX deployment does for
you. Full walkthrough: [VSS to VDS migration](08-vss-to-vds-migration.md).

---

## Pre-upgrade precheck

Broadcom's `nonvcf-vsan` / `nonvcf-vcenter` / `nonvcf-esxi` / `nonvcf-nsxt`
VCFcheck modes run the same checks the fleet-managed path runs from SDDC
Manager (see [Run the pre-upgrade precheck](13-vcf-upgrade-sequence.md#run-the-pre-upgrade-precheck)),
but directly against vCenter instead – they prompt **interactively** for
credentials, per cluster, asking whether all ESXi hosts in a cluster share
the same root password before falling back to per-host prompts.

---

## Post-upgrade validation

A trimmed version of the [full-VCF checklist](13-vcf-upgrade-sequence.md#post-upgrade-validation) –
most of that list assumes components (SDDC Manager, NSX, Identity Broker,
VCF Automation) that don't exist on this path:

- **Component builds** – vCenter, ESX, and Aria/VCF Operations on their
  expected builds.
- **VMware Tools** – upgrade guests to **13.1**.
- **vSAN on-disk format** – upgrade the on-disk format version, if vSAN is
  in use.
- **vSAN File Service** – upgrade if in use, after the on-disk format
  upgrade.
- **Licensing** – vCenter and ESX licenses assigned from the License Server;
  no connectivity errors between vCenter and the License Server.
- **Aria/VCF Operations** – reachable and healthy, metrics still flowing.

Same PowerCLI spot-check as the full-VCF checklist covers builds, VMware
Tools, and vSAN on-disk format in one pass – see
[Full VCF upgrade sequence → Post-upgrade validation](13-vcf-upgrade-sequence.md#post-upgrade-validation).

---

## Cleanup

- **Pre-upgrade snapshots** – delete once the upgrade is confirmed
  successful; leaving them attached causes performance degradation.
- **Legacy Aria Operations appliances** – retire once the transition to VCF
  Operations 9.1 is confirmed, if applicable.
