# VMware HCX upgrade (VCF Operations HCX 9.1)

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
expanding on its [Conditional phases table's HCX
row](13-vcf-upgrade-sequence.md#conditional-phases-optional-components).

Applies whenever **VMware HCX** is in use. **Position: after VCF
Automation, before the NSX / vCenter / host tier.** In Broadcom's 9.1
[upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html)
it is step 13, *"Upgrade to VCF Operations HCX 9.1"*, after VCF
Automation, Operations orchestrator, Operations for Networks and Log
Management, and directly before the NSX Global Manager (or NSX Manager
when not federated).

**VCF only, as far as Broadcom documents it.** The
[vSphere Foundation 9.1 upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1.html)
has no HCX step.

HCX has two layers, upgraded separately and in this order:

1. **HCX Manager** at every site in the site pair (source *and*
   destination).
2. **Service Mesh appliances** (Interconnect `HCX-WAN-IX`, network
   extension `HCX-NET-EXT`, plus OSAM sentinel appliances if used),
   triggered from the source site.

---

## Two paths, depending on the running version

Broadcom's 9.1
[lifecycle page for HCX](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components/update-vcf-operations-hcx.html)
splits it:

| Running HCX version | How HCX Manager is upgraded |
| --- | --- |
| **9.0.x and earlier** (including 4.11.x) – the upgrade *to* 9.1 | Manually, per site, in HCX Appliance Management or HCX Manager – see [Upgrading HCX Manager to 9.1](#upgrading-hcx-manager-to-91) |
| **9.1 or later** – later patches and upgrades | Through **VCF Operations lifecycle management** – *"you must use VCF Operations and upgrade the component in the beginning of the domain upgrade plan sequence"*. See [After 9.1: HCX through VCF Operations](#after-91-hcx-through-vcf-operations) |

The Service Mesh upgrade is a **manual operation on both paths**.

---

## Version rules

- **Pairing breaks across the 9.0 line.** Broadcom's order table: *"After
  you upgrade your VMware HCX appliance to 9.1.x, upgrade all paired
  appliances to VCF Operations HCX 9.0 or later. Appliances with version
  9.0 and later are not compatible with earlier versions and pairing
  breaks."* [KB 427904](https://knowledge.broadcom.com/external/article/427904)
  adds that HCX may still *let* you create a site pair between 4.10.x /
  4.11.x and 9.x, but *"it is not supported. There is no guardrail in the
  software to prohibit this configuration."* **Plan every paired site
  into the same upgrade**, even if the sites go in separate windows.
- **The source build decides the path – check it before planning.** HCX
  follows the same **back-in-time rule** as the rest of VCF: a 4.11.x
  release that came out *after* a given 9.x release cannot upgrade to
  that 9.x release. The matrix gives the reason in its own words, for
  example: *"Upgrading VCF Operations HCX from source version 4.11.5 to
  target version 9.1.0.0 is not supported, as the source version's
  release date (2026-05-27) is after the target version's release date
  (2026-05-11), making it a newer release."* The
  [HCX 4.11.4 release notes](https://techdocs.broadcom.com/us/en/vmware-cis/hcx/vmware-hcx/4-11/hcx-4-11-release-notes/vmware-hcx-4114-release-notes.html)
  state the same for 4.11.4 → 9.0. Direct paths listed in the Broadcom
  Product Interoperability Matrix (**Upgrade Path** view, VCF Operations
  HCX), captured 2026-10-01:

  | Running | Direct to 9.0.x | Direct to 9.1.0.x | Direct to 9.1.1.0 |
  | --- | --- | --- | --- |
  | 4.10.x | – | – | – (go to 4.11.x first) |
  | 4.11.0 | 9.0.0 / 9.0.1 / 9.0.2 | – | – |
  | 4.11.1 | 9.0.1 / 9.0.2 | – | – |
  | 4.11.2 | 9.0.1 / 9.0.2 | ✓ | – |
  | 4.11.3 | 9.0.2 | ✓ | ✓ |
  | 4.11.4 | – (back-in-time) | ✓ | ✓ |
  | 4.11.5 | – (back-in-time) | – (back-in-time) | ✓ |
  | 9.0.x | – | ✓ | ✓ |
  | 9.1.0.x | – | ✓ (later patch) | ✓ |

  "–" means the matrix lists no direct path. A missing combination is
  not the same as an explicit "incompatible", but it is not a supported
  path either. In practice, for a **9.1.1 target**:
  - **4.11.3, 4.11.4 or 4.11.5:** upgrade directly.
  - **4.11.0 or 4.11.1:** two steps. Either go to 4.11.3 or later first,
    or go to 9.0.x first and then to 9.1.1.
  - **4.11.2:** no direct path to 9.1.1. Go to 9.1.0.x first, or to
    4.11.3 or later first.
  - **4.10.x:** upgrade to 4.11.x first.

  **Every hop also has to work for the paired site**, since pairing
  breaks across the 9.0 line. Re-check the matrix for the exact pair
  just before the window, because new 4.11.x releases move these lines.
- **HCX 4.11.2 and earlier are End of Service** (24 December 2025, per
  the 4.11.4 release notes).
- **Multi-site topologies:** *"If Site A is paired with Site B, and Site
  A is also paired with Site C, plan the upgrades for Site A, B and C for
  the maximum compatibility across all environments."*

---

## Before you start

From Broadcom's
[Planning for Upgrades](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx/planning-for-hcx-updates.html)
and the [HCX Manager upgrade](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx/upgrade-hcx-manager-for-local-sites.html)
prerequisites:

- **Download the bundle manually** from support.broadcom.com. It
  contains HCX Manager, the Service Mesh appliances, the OSAM appliances
  and the sentinel software. Uploading it to HCX Manager ahead of time
  shortens the window.
- **Healthy before you start:** site pairs show healthy connections;
  HCX Manager reports healthy connections to vCenter, NSX Manager (if
  applicable) and the Service Mesh appliances. Appliances in a degraded
  state must be fixed first, unless Broadcom Support says otherwise.
- **Upgrading from HCX 4.11: remove three services first.** *"You must
  remove the following services from the compute profile and service
  mesh for all paired HCX appliances: WAN Optimization, V2T Migration,
  Disaster Recovery."* Check whether any of them are in use, and agree
  with the workload owners before removing them.
- **Quiesce mobility:** all running migrations finished, no new
  migrations or network extensions configured during the window, no
  failovers scheduled.
- **Backup and snapshot.** Broadcom calls an HCX Manager backup a best
  practice, plus an optional vSphere snapshot of the source *and*
  destination HCX Manager. That snapshot pair is the only
  [rollback](#rollback) path. The upgrade workflow takes its own
  automatic snapshot only when HCX is deployed in the registered vCenter,
  and keeps it for just one day.

---

## Upgrading HCX Manager to 9.1

Repeat at **each** site in the pair. From the
[HCX Manager upgrade](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx/upgrade-hcx-manager-for-local-sites.html)
procedure:

1. Log in to HCX **Appliance Management** (`https://<hcx-manager-fqdn>:9443`).
2. **Administration → System Management → Upgrade → Begin Upgrade**.
3. Select the uploaded bundle (or upload it), **Continue**.
4. Review the details, **Confirm & Start Upgrade**.

(The same upgrade is also available in the HCX Manager UI under
**System Updates**.)

**HCX Manager reboots.** Existing network extensions keep working during
the reboot; new ones cannot be configured until it is back. Allow several
minutes for initialization, then check **System Updates** for the new
version. Upgrading HCX Manager does not disrupt the Interconnect Service
Mesh.

---

## Upgrading the Service Mesh appliances

**Only after every site-paired HCX Manager is on the same version**, and
all services have converged again. From
[Upgrade the HCX Service Mesh Appliances](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx/upgrade-the-hcx-service-mesh-appliances.html):

1. Log in to HCX Manager at the **source** site. Service Mesh upgrades
   are only started from the source; with several source sites paired to
   one destination, repeat this at each source site.
2. **Interconnect → Service Mesh → View Appliances**. A green flag in
   **Available Versions** marks appliances that can be upgraded.
3. Select the appliance, **Update Appliance**, check the Current and
   Available versions, **Update**. The peer appliance at the paired site
   upgrades at the same time; follow it in the **Tasks** tab.

Do them in this order, per Planning for Upgrades:

1. **Interconnect (`HCX-WAN-IX`)** first, then verify the tunnels are
   up.
2. **Network extension (`HCX-NET-EXT`)** next, then verify the tunnels
   again. **This interrupts traffic across the extended networks**: the
   tunnel *"re-converges in less than one minute"*, so keep it inside a
   maintenance window. (Broadcom also documents an in-service upgrade
   option for network extension appliances.)
3. **OSAM only:** the sentinel appliances get no upgrade flag. **Redeploy**
   the SGW appliance instead; that also upgrades the SDR appliances at
   both sites.

**Appliance passwords may change.** When upgrading from HCX 4.11.x or
earlier, HCX automatically changes any Interconnect appliance password
that does not meet the new rules (15–20 characters, mixed case, a digit,
one of `! @ # $ ^ *`, no dictionary words). Retrieve the new password
through HCX's *Retrieve an Interconnect Appliance Password* procedure,
and update any password vault.

The Service Mesh upgrade may run in a separate window from HCX Manager.

---

## Before moving on

- **System Updates** at every site shows the target version.
- Every Service Mesh appliance is on the same version as HCX Manager
  and in **Tunnel Up** state.
- Site pairs report healthy connections.
- Every paired site is on 9.0 or later. A peer still on 4.x is an
  unsupported pairing.
- Resume migrations and network-extension changes.

---

## Rollback

From [Roll Back an Upgrade Using Snapshots](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx/rolling-back-an-upgrade-using-snapshots.html).
This only works if snapshots exist for **both** the source and the
destination HCX Manager.

- **Roll back HCX Manager only.** *"Do not attempt to restore snapshots
  of any data-path appliances."*
- **Service Mesh not upgraded yet:** revert the HCX Manager snapshots,
  then **Interconnect → Service Mesh → Resync**.
- **Service Mesh already upgraded:** revert the HCX Manager snapshots,
  then **Interconnect → Service Mesh → View Appliances**, select all,
  **Redeploy**, and confirm each appliance is **Up** on the reverted
  version.
- Verify the rolled-back version under **System Updates**.

---

## After 9.1: HCX through VCF Operations

Once HCX is on 9.1, later patches and upgrades of HCX Manager run from
VCF Operations
([Upgrade VCF Operations HCX 9.1.x](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components/update-vcf-operations-hcx.html)),
**at the start of the domain upgrade plan**:

1. Log in to VCF Operations with the Administrator role,
   **Build → Lifecycle**, expand **VCF Instances** and select the domain.
2. On the **Upgrades** tab, under **VCF Operations HCX**, click
   **Precheck**. It checks ongoing HCX operations (migrations, network
   extensions, interconnect), whether a VM snapshot is available, backup
   server reachability, free storage on HCX Manager, peer and Service
   Mesh compatibility, and incompatible paired versions.
3. **Upgrade now**, or **Schedule** it for a set time.

This upgrades HCX Manager **for the selected domain only**. Broadcom
recommends upgrading all peer HCX Managers to stay compatible. The
Service Mesh appliances still follow the
[manual procedure above](#upgrading-the-service-mesh-appliances). The
domain's **Component Versions** tab tracks HCX next to SDDC Manager,
vCenter, NSX and ESX, so version drift shows up there. For the
surrounding fleet-patching flow, see
[Patching an existing VCF 9.1 fleet](20-patching-an-existing-vcf9-fleet.md).

---

## Sources

- [Upgrading to VMware Cloud Foundation 9.1.x](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html) – Position in the order (step 13), pairing-breaks footnote.
- [Upgrade VCF Operations HCX](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/updating-vmware-hcx.html) (9.1 chapter: About, Planning, HCX Manager, Service Mesh, Rollback) – Prerequisites, sequence, procedures, rollback.
- [Upgrade VCF Operations HCX 9.1.x (lifecycle management)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components/update-vcf-operations-hcx.html) – Manual vs. VCF Operations path, precheck contents.
- [Lifecycle Management of VCF Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html) – HCX in Component Versions tracking.
- [Broadcom Product Interoperability Matrix – Upgrade Path](https://interopmatrix.broadcom.com/Upgrade) (VCF Operations HCX, captured 2026-10-01) – Direct source → target paths, back-in-time footnotes.
- [VMware HCX 4.11.4 Release Notes](https://techdocs.broadcom.com/us/en/vmware-cis/hcx/vmware-hcx/4-11/hcx-4-11-release-notes/vmware-hcx-4114-release-notes.html) – 4.11.0 / 4.11.4 upgrade support, End of Service.
- [KB 427904](https://knowledge.broadcom.com/external/article/427904) – 4.10.x / 4.11.x ↔ 9.x site pairing unsupported, no guardrail.
