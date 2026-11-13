# Side-by-side migration: build new, then move the workloads

Not every environment gets to VCF or VVF 9 by an in-place upgrade. Often
the better route is to build a **new 9.x environment next to the old
one**, carry the configuration over, and then migrate the VMs, with or
without HCX. This page is the entry point for that route. It helps you
choose the scenario, walks you through the phases in order, and gives
each phase a check that must pass before you start the next one.

This is the first page of a set. The other pages go into depth per
phase and are listed under [The rest of this set](#the-rest-of-this-set).
Until they're published, this page tells you per phase what to do and
which Broadcom source to follow.

Facts on this page come from Broadcom TechDocs, Broadcom KB articles and
public blogs, read word for word on 2026-11-13. Each one is linked where
it's used.

---

## Contents

- [Is this the right route?](#is-this-the-right-route)
- [What a VM does not take with it](#what-a-vm-does-not-take-with-it)
- [Phase 0: answer five questions](#phase-0-answer-five-questions)
- [The phases](#the-phases)
- [Toolkits](#toolkits)
- [The rest of this set](#the-rest-of-this-set)
- [Sources](#sources)

---

## Is this the right route?

| | In-place upgrade | Side-by-side migration |
| --- | --- | --- |
| What happens | The existing vCenter, hosts and NSX are upgraded where they stand | A new 9.x environment is built next to the old one and the VMs move across |
| Hardware | Stays, so it must be supported on 9.x | New or freed-up hosts for the target |
| The old design | Comes along, including its compromises | You can change it: network model, clusters, naming, identity |
| Upgrade path | Must exist from the exact source build ([check it](01-overview.md#confirm-a-supported-upgrade-path)) | Not needed: the new environment is installed fresh |
| Rollback | Restore or redeploy | The source keeps running until the last wave has moved |
| Effort | Concentrated in the upgrade windows | Spread over the migration waves, plus the configuration work up front |

Two related routes are covered elsewhere in this guide:

- Bringing an **existing** vCenter under VCF without moving VMs is
  Converge or Import, see
  [Converge and Import](22-converge-and-import-existing-infrastructure.md).
- **Upgrading** an HCX installation that's already in use is in
  [HCX upgrade](23-hcx-upgrade.md). This page is about using HCX (or
  plain vMotion) to move VMs into a new environment.

---

## What a VM does not take with it

This is why the configuration goes across **before** the first VM does.
Broadcom's KB on cross vCenter migration
([KB 344959](https://knowledge.broadcom.com/external/article/344959))
lists what is *not* migrated with a VM:

> *"vCenter definitions that do not exist in the destination vCenter
> (regardless of SSO), such as: vSphere Tags, Custom Attributes,
> Permissions"*

and further:

> *"vCenter Server Folder: This does not move, it is a VC Object. VMs are
> manually placed into a Folder, so it does not get moved. A new Folder
> needs to be specified in the destination VC."*

> *"VM Storage Policies per VMDK: This may or may not persist as the
> policy may or may not exist on the target VC"*

Things that *do* travel with the VM, per the same KB: snapshots, notes,
reservations, advanced settings, per-VM EVC, and per-VM DRS and HA
overrides. The KB's environment list stops at vCenter 8.x; it hasn't been
re-issued for 9.x.

In short: create roles, tags, custom attributes, storage policies and
folders on the target with the **same names** before the VM arrives.
Two things you restore afterwards, in phase 5:

- **Folder placement**, per the KB above.
- **Tag assignments.** Jim Millard found that *"the tags on the VM do not
  get migrated with it even if the corresponding tags & categories are
  present in the target vCenter"*, so export them before the VM moves,
  *"or that information is lost forever"*
  ([Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html),
  Jim Millard).

---

## Phase 0: answer five questions

Answer these before anything is built. Together they decide your route,
and changing your mind halfway is expensive. Write the answers down; the
later phases refer back to them.

### 1. Do you use HCX?

| | With HCX | Without HCX |
| --- | --- | --- |
| How VMs move | HCX Mobility Groups: Bulk Migration, vMotion, Replication Assisted vMotion (RAV), cold migration | Advanced Cross vCenter vMotion: **Import VMs** in the vSphere Client of the target |
| Keeping IP addresses | HCX Network Extension stretches the layer 2 network to the target | The same VLANs must be available on both sides, or the VMs get new addresses |
| Rollback | Bulk Migration leaves the source VM in place, powered off | Migrate back with a new migration |
| Extra components | HCX Manager on both sides plus the Service Mesh appliances | None |

What the sources say:

- **Licensing.** When the target is licensed VCF, the source doesn't
  need its own HCX license:
  *"Local licensing is not required at the source site when the
  destination is a licensed VCF environment"*
  ([KB 440126](https://knowledge.broadcom.com/external/article/440126)).
  The source HCX Connector can show an "Evaluation Mode" banner; per the
  same KB that's expected and clears through site pairing and the Service
  Mesh. Broadcom's VVF upgrade order has no HCX step (see
  [HCX upgrade](23-hcx-upgrade.md)); if your target is VVF, confirm your
  HCX entitlement with Broadcom before you plan around it.
- **Network extension.** *"Extending Layer 2 networks allows workloads
  migrated to VMware Cloud Foundation (VCF) 9.1 to retain their original
  IP and MAC addresses, eliminating application re-IP requirements during
  migration."* Supported sources: *"Distributed Virtual Port Group (VDS),
  NSX overlay, NSX VLAN, or NSX VPC (if the source is NSX 9)"*
  ([VCF blog, HCX 9.1 part 3](https://blogs.vmware.com/cloud-foundation/2026/09/25/vcf-9-operations-hcx-network-extension-migration-part-3/)).
- **Your network decides the migration type.** The same blog: live
  migrations need *"at least 250 Mbps bandwidth and a strict maximum of
  0.1% packet loss"* (150 Mbps with the WAN Optimization appliance);
  Bulk Migration tolerates *"lower bandwidth (50 Mbps) and higher packet
  loss (1.0%)"*. For rollback: Bulk Migration is *"safely preserving the
  original VM in a powered off and disconnected state on the legacy
  environment"*.
- **Versions.** HCX 9.x doesn't pair with 4.x in a supported way. See the
  version rules in [HCX upgrade](23-hcx-upgrade.md#version-rules) before
  you deploy HCX on the old side.

### 2. Do the VMs keep their IP addresses?

- **Yes, with HCX:** network extension (question 1).
- **Yes, without HCX:** the VLANs of the source must also be present on
  the target hosts' uplinks, and the default gateway stays where it is
  until the cutover. That's a change on the physical network, so plan it
  with the network team.
- **No:** every VM gets a new address on the target. Plan DNS, firewall
  rules and application configuration per wave.

### 3. Is NSX in use on the source?

- **No:** the networks are VDS port groups (or standard switch port
  groups). They go across in phase 3 with VDSPortGroupManager.
- **Yes:** segments and segment profiles go across with
  nsx-segment-migration. If you use the **distributed firewall** (DFW),
  its configuration has to go across too: IP sets, services and service
  groups, security groups, policies and rules, and the NSX tags on the
  VMs that groups are based on. Jeroen Buren's NSX DFW migration toolkit
  does this from an NSX 4 to an NSX 9 manager (see [Toolkits](#toolkits)).
  Two things he points out: objects that date from NSX-V carry IDs like
  *"securitygroup-223 or ipset-286"* instead of their names, which his
  toolkit can rename before import, and *"The export script currently
  excludes Gateway Firewall policies, focusing only on DFW"*
  ([part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/)).
  For the NSX tags on the VMs themselves, HCX also has a **Migrate NSX
  Tags** option per Mobility Group. That's NSX tags, not vSphere tags.

### 4. Which VDS versions are on both sides?

A vMotion between distributed switches of **different versions** fails
the pre-check:

> *"vMotion operations between vDS instances that are different versions
> is not supported."*
> ([KB 318582](https://knowledge.broadcom.com/external/article/318582))

The KB gives three ways out: upgrade the lower switch to match, migrate
the VM powered off, or set `config.vmprov.enableHybridMode` to `true` on
**both** vCenters. Read the KB's own warning before you choose the third:
*"If the below workaround is applied to a hot-migration of a VM between
two distributed switches that have different versions, the VM may lose
network connectivity."* The KB has a table of which source and target
versions the workaround covers. For a **7.0.3 source** it contradicts
itself: the table shows 7.0.3 to 7.0.3 and newer as working, while the
note below it says *"the workaround does not work if the source vDS is
version 7.0.3"*. Test with a non-critical VM before you rely on it.

William Lam describes two supported ways from vSphere 7.0 to 9.0: spare
or swing hosts on the target with a VDS at the **source's** version, or
the KB 318582 workaround
([Cross vCenter vMotion workloads from vSphere 7.0 to vSphere 9.0](https://williamlam.com/2026/02/cross-vcenter-vmotion-workloads-from-vsphere-7-0-to-vsphere-9-0.html),
William Lam). The minimum VDS version on vSphere 9 is 7.0, per the same
post.

Note what the source switch is: a migration from a **distributed** switch
to a **standard** switch is not supported
([KB 344959](https://knowledge.broadcom.com/external/article/344959)).

### 5. Where do the users and groups come from on the target?

Advanced Cross vCenter vMotion *"does not depend on vCenter linking and
you can migrate virtual machines across vCenter systems in different
vCenter Single Sign-On domains"*
([vSphere 9.1, Import or Clone a Virtual Machine with Advanced Cross vCenter vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)).
So the target can be a new SSO domain. But permissions only come back
if the **same users and groups** resolve on the target: connect the
target to the same directory before phase 2. For a VCF target with VCF
Identity Broker, see
[Identity Broker migration](03-identity-broker-migration.md).

---

## The phases

![Side-by-side migration in seven phases. 0, decide the route: the five questions, with baseline exports of the source; check: route chosen and written down. 1, build the target: new VCF or VVF 9 environment, HCX on both sides if chosen; check: target healthy, licensed, reachable. 2, carry over vCenter configuration: roles, tags, storage policies, folders and folder permissions, with VIRoleManager, the tags and custom attributes toolkit in development, StoragePolicyManager and VIFolderManager in test; check: everything exists on the target with the same names. 3, carry over the networks and the firewall: VDS port groups, NSX segments and NSX distributed firewall policies, with VDSPortGroupManager, nsx-segment-migration and Jeroen Buren's NSX DFW toolkit; check: every source network has a mapped target and the DFW comparison is clean. 4, prove the path: ports 8000, 902 and 443, HCX diagnostics, one test VM there and back; check: test VM runs with network, policy, tags and folder. 5, migrate in waves: HCX Mobility Groups or Import VMs, then VIFolderManager to restore folders and the NSX tags on the VMs; check: each wave verified by the application owner. 6, cut over and clean up: gateways to the target, remove network extensions, retire the source; check: nothing left running on the source.](images/side-by-side-migration/phases.png)

Each phase below has three parts: what it's for, what you do, and the
check that closes it. Don't start a phase before the previous check
passes. The old environment stays in production the whole time, so
there's no reason to rush a phase.

### Phase 0: decide the route

- **Do:** answer the [five questions](#phase-0-answer-five-questions).
  Then take a **baseline export** of the source with the toolkits below
  (roles, storage policies, folders, port groups, segments) and of the
  tag assignments, with PowerCLI until the tags and custom attributes
  toolkit is there. Even when
  you rebuild part of it by hand, that export is your reference and your
  record of what the source looked like.
- **Check:** the route is written down: HCX or not, IP addresses kept or
  not, which VDS versions, which directory on the target.

### Phase 1: build the target

- **Do:** deploy the new VCF or VVF 9 environment. Design, sizing and
  the Planning and Preparation Workbook are covered in the
  [VCF 9 deployment planning guide](https://vcf-planning.hollebollevsan.nl/).
  Give the target hosts a VDS whose version fits your answer to
  question 4. If you use HCX, deploy it on both sides, pair the sites and
  build the Service Mesh.
- **Check:** the target is healthy and licensed, its vCenter is
  connected to the directory from question 5, and the source vCenter can
  reach the target vCenter.

### Phase 2: carry over the vCenter configuration

Step by step, with the commands and a check per step:
[Carrying over the vCenter configuration](30-carry-over-vcenter-configuration.md).
In short, the order matters, because each step leans on the one before
it:

1. **Roles** first (VIRoleManager). Folder permissions refer to roles
   by name.
2. **Tag categories and tags.** Tag-based storage policy rules refer to
   them, and the tag assignments you re-apply in phase 5 need them
   ([KB 344959](https://knowledge.broadcom.com/external/article/344959)).
   The toolkit for this (tags and custom attributes together) is still
   being developed; until then, recreate them in the vSphere Client or
   with PowerCLI.
3. **Custom attributes.** Same KB, same reason, and the same toolkit in
   development; until then, recreate the attribute names by hand.
4. **Storage policies** (StoragePolicyManager). Tag-based rules are
   matched by category and tag name, so step 2 must be done first.
5. **Folders and folder permissions** (VIFolderManager), folders only,
   without moving objects yet. Permissions need the roles from step 1
   and the users and groups from question 5.

- **Check:** every role, tag category, tag, custom attribute, storage
  policy and folder from the baseline export exists on the target, with
  the same name.

### Phase 3: carry over the networks and the firewall

Step by step, with the commands and a check per step:
[Carrying over the networks and the firewall](31-carry-over-networks-and-firewall.md).
In short:

- **Do:**
  - Recreate every network the VMs use. VDS port groups go across with
    VDSPortGroupManager; NSX segments and segment profiles with
    nsx-segment-migration. Make a mapping table: source network, target
    network, VLAN or segment, gateway, and whether it's extended by HCX.
  - If the source uses the NSX distributed firewall, move its policy
    objects now, **before** the first VM arrives, so a VM is protected
    from the moment it lands. With the NSX DFW migration toolkit: export,
    sanitize, review the CSV files, then import with `-WhatIf` first. The
    import follows the dependency order the author describes: *"IP Sets
    (no dependencies)"*, services, service groups, security groups, then
    *"Policies and Rules (depend on Groups and Services)"*
    ([part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/)).
    The VM tags come later, in phase 5.
- **Check:** every source network a VM uses has a target in the mapping
  table, and the target network is present on every target host that
  will run those VMs. For the DFW: the toolkit's comparison script
  (`Compare-NSX-Migration.ps1`) reports nothing *"Missing on
  destination"* ([part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/)).

### Phase 4: prove the path

- **Do:**
  - Open the ports. Advanced Cross vCenter vMotion needs *"Port 8000 on
    the ESX host for vMotion"*, *"Port 902 on the ESX host for NFC"* and
    *"Port 443 between the two vCenter instances"*
    ([vSphere 9.1 TechDocs](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)).
    The full list per product is on
    [ports.broadcom.com](https://ports.broadcom.com/).
  - With HCX: run **Run Diagnostics** on the Service Mesh and
    **Transport Analytics**, and *"Do not proceed to migration if any
    probes fail"*
    ([VCF blog, HCX 9.1 part 3](https://blogs.vmware.com/cloud-foundation/2026/09/25/vcf-9-operations-hcx-network-extension-migration-part-3/)).
  - Without HCX: check the version requirements. *"Verify that the source
    vCenter instances from which you import or clone virtual machines are
    version 6.7 or later"*, the target vCenter is *"version 7.0 Update 1c
    or later"* and the destination hosts *"version 6.7 or later"*
    ([vSphere 9.1 TechDocs](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)).
  - Migrate **one test VM** to the target and back again.
- **Check:** the test VM runs on the target with working network, the
  right storage policy, its tags, and (after a VIFolderManager import)
  in the right folder. And it can go back.

### Phase 5: migrate in waves

- **Do:** group the VMs into waves per application, not per host, so an
  application moves as a whole and its owner can test it in one go.
  - With HCX: one Mobility Group per wave. Be careful with
    *Upgrade Virtual Hardware* and *Disable HCX Per-VM EVC*: the VCF blog
    warns they *"can cause lock-in, preventing you from migrating the
    workload back to the legacy environment"*.
  - Without HCX: in the target vSphere Client, right-click the cluster or
    host and choose **Import VMs**.
  - Right **before** each wave, export the tag assignments of its VMs
    (`Get-TagAssignment`); right **after** it, assign the same tags on the
    target (`New-TagAssignment`). The tags and custom attributes toolkit
    will do this once it's
    available.
  - After each wave, run VIFolderManager's import again with
    `-MoveObjects`: VMs that have arrived go back into their folders, VMs
    that haven't are listed and skipped, so the same export works for
    every wave. Use `-DryRun` first.
  - With the NSX DFW: apply the NSX tags to the VMs of the wave, so they
    fall into the right security groups. The toolkit only tags VMs that
    have arrived: it *"verifies that the VM's external ID (the vCenter
    UUID) exists in the destination NSX fabric inventory. If it doesn't,
    the VM is skipped with a warning."*
    ([part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/)).
    Or use HCX's **Migrate NSX Tags** option on the Mobility Group.
- **Check:** after each wave, the application owner confirms the
  application works, and the VMs have their network, storage policy,
  tags (vSphere and NSX) and folder. Only then start the next wave.

### Phase 6: cut over and clean up

- **Do:** when a network's last VM has moved, move its gateway to the
  target and remove the HCX network extension for it. When nothing is
  left, remove the HCX pairing and retire the source environment.
- **Check:** nothing is still running on the source, nothing still
  points at it (backup jobs, monitoring, DNS, firewall rules), and the
  last baseline export is archived.

The detailed steps for this phase come in the cutover page of this set.

---

## Toolkits

PowerShell toolkits for the configuration work in phases 0, 2, 3 and 5.
They export to files you can read and keep, and import into the target
vCenter or NSX Manager.

**Who made them.** VIRoleManager, StoragePolicyManager, VIFolderManager,
VDSPortGroupManager, nsx-segment-migration and the tags and custom
attributes toolkit are written by Paul van Dieen, the author of this guide
([hollebollevsan.nl](https://www.hollebollevsan.nl)). The NSX DFW migration
toolkit is written by Jeroen Buren
([configmgr.nl](https://configmgr.nl)).

> **Use at your own risk.** These are community tools, not Broadcom
> products, and they come without support or warranty. Before you use one
> on a real environment, read its README, test it in a lab or against a
> non-production vCenter or NSX Manager first, check every export file
> before you import it, use the dry run where the toolkit has one, and
> check the result yourself afterwards. You are responsible for what they
> change in your environment. Found a problem? Open an issue in the
> toolkit's GitHub repository.

| Toolkit | Moves | Status |
| --- | --- | --- |
| [VIRoleManager](https://github.com/pauldiee/VIRoleManager) | vCenter roles and their privileges | Tested against vSphere 9 |
| Tags and custom attributes toolkit | Tag categories and tags, custom attributes, and their assignments and values on objects | **In development**, not yet available |
| [StoragePolicyManager](https://github.com/pauldiee/StoragePolicyManager) | VM storage policies (SPBM), incl. tag-based rules | Tested against vSphere 9 |
| [VIFolderManager](https://github.com/pauldiee/VIFolderManager) | Folder trees (VM, host, datastore, network), which objects sit where, and permissions on folders | **Still in test.** Lab-tested on VCF 9.1.1 and 9.0.2. Run with `-DryRun` first |
| [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) | VDS port groups | Tested against vSphere 9 |
| [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration) | NSX segments, segment profiles and their bindings | NSX 4.x and 9.x |
| [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit), by Jeroen Buren | NSX distributed firewall: IP sets, services and service groups, security groups, policies and rules, VM tags. Renames NSX-V-era IDs to their names, rolls an import back, and compares source and target | Written for an NSX 4 to NSX 9 migration; no Gateway Firewall. See his posts: [part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/), [part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/), [part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/) |

The vCenter toolkits have been tested with vSphere 9 vCenters on both
sides. Exporting from an **older source vCenter** (7.x or 8.x) hasn't been
tested yet. Check the export file before you import it, and import with a
dry run where the toolkit has one.

---

## The rest of this set

Published: [Carrying over the vCenter configuration](30-carry-over-vcenter-configuration.md)
(phase 2) and [Carrying over the networks and the firewall](31-carry-over-networks-and-firewall.md)
(phase 3).

These pages are planned and will be linked here when they're published:

- **Migrating with HCX:** site pairing, Service Mesh, network extension,
  choosing the migration type, Mobility Groups.
- **Migrating without HCX:** Advanced Cross vCenter vMotion, VDS version
  handling, cold migration.
- **Cutover and clean-up:** gateways, removing extensions, retiring the
  source.

---

## Sources

Read word for word on 2026-11-13.

- Broadcom TechDocs, vSphere 9.1:
  [Import or Clone a Virtual Machine with Advanced Cross vCenter vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)
- [KB 344959](https://knowledge.broadcom.com/external/article/344959):
  Cross vCenter Migration and Clone requirements in VMware vSphere 6.x and
  later
- [KB 318582](https://knowledge.broadcom.com/external/article/318582):
  Migrating a virtual machine between two different vDS versions
- [KB 440126](https://knowledge.broadcom.com/external/article/440126):
  HCX Licensing Requirements for Migrating to VCF Environments
- VMware Cloud Foundation blog, 2026-09-25:
  [VCF Operations HCX 9.1, part 3: network extension and migration](https://blogs.vmware.com/cloud-foundation/2026/09/25/vcf-9-operations-hcx-network-extension-migration-part-3/)
- Jeroen Buren, configmgr.nl, 2026-03:
  [Migrating NSX Distributed Firewall Policies the Right Way: A PowerShell Toolkit](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/),
  [part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/),
  [part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/)
- Jim Millard, 2026-05:
  [Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html)
- William Lam, 2026-02:
  [Cross vCenter vMotion workloads from vSphere 7.0 to vSphere 9.0](https://williamlam.com/2026/02/cross-vcenter-vmotion-workloads-from-vsphere-7-0-to-vsphere-9-0.html)
