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
- [What doesn't move live, and what stays out](#what-doesnt-move-live-and-what-stays-out)
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

## What doesn't move live, and what stays out

Make this list in phase 0, per VM, from the inventory. Every VM ends up in
one of three groups: it moves live in a wave, it moves powered off in a
window, or it doesn't move at all.

**Out of scope: rebuilt on the target, not migrated.**

- **The infrastructure itself.** HCX says it directly: *"VMware software
  appliances (including, but not limited to vCenter and NSX Manager)
  cannot be migrated with HCX"*
  ([Understanding vMotion and Cold Migration](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/migrating-virtual-machines-with-vmware-hcx/understanding-vmware-hcx-vmotion-and-cold-migration.html)).
  The target has its own vCenter, NSX Manager and Edges from phase 1. The
  same goes for VMs that a product deploys for itself on the source
  (Supervisor and its services, NSX Edges, system VMs of the cluster),
  and for the appliances that point at the source vCenter, such as backup
  proxies: deploy new ones against the target.
- **Kubernetes nodes with persistent volumes.** Cross vCenter migration
  *"is explicitly NOT supported for virtual machines consuming Persistent
  Volumes (PVs) provisioned via the CNS-CSI driver"*; Broadcom's route is
  to build new clusters on the target and move the workloads with Velero
  backup and restore
  ([KB 433258](https://knowledge.broadcom.com/external/article/433258)).
  Plan Kubernetes as its own migration, on the target Supervisor.
- **VMs protected by vSphere Replication.** *"Cross vCenter migration is
  not supported for virtual machines protected by vSphere Replication, and
  replication does not continue to operate after such a migration"*. Stop
  or remove the replication first, migrate, and set up protection again on
  the target
  ([KB 421671](https://knowledge.broadcom.com/external/article/421671)).
  Plan when each VM is unprotected.

**Moves only powered off, in a window.**

- **Shared disks: WSFC with shared disks, Oracle RAC (multi-writer).**
  HCX lists *"Virtual machines cannot be migrated while they are using a
  shared SCSI bus, flagged for multi-writer, enabled for fault tolerance,
  or configured for shared VMDK disk sharing"*, for vMotion and for Bulk
  migration
  ([Understanding Bulk Migration](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/migrating-virtual-machines-with-vmware-hcx/understanding-vmware-hcx-bulk-migration.html)).
  The cause is vSphere's, so it applies without HCX too: *"vSphere does
  not support live migration for VMs with virtual SCSI bus sharing"*. The
  way: *"Shut down the source VM and any other cluster nodes"* that share
  the disks, use cold migration, and update the other nodes with the new
  disk locations before powering them on
  ([KB 442091](https://knowledge.broadcom.com/external/article/442091)).
  The whole cluster is down for that window.
- **Other HCX limits** from the same pages: physical-mode RDMs (*"cannot
  be migrated"* with Bulk; virtual-mode RDMs *"are converted to VMDKs at
  the destination"*), mounted ISO images, DirectPath I/O devices, virtual
  NVMe controllers, encrypted VMs, an attached serial port (*"You can use
  Bulk Migration"* for those). Without HCX, see the special cases in
  [docs/32](32-migrating-without-hcx.md#special-cases).

**Check.** Every VM in the inventory has a group: a wave, a powered-off
window, or out of scope with a reason and an owner.

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
  with the network team, unless the L2 stretch between the sites is
  already the standard design (a data center interconnect or an EVPN
  fabric): then the VLANs reach the target hosts already, and the gateway
  may never have to move. For **NSX overlay** segments that doesn't work:
  their subnet lives on a source Tier-1 and is advertised by the source
  NSX. Decide per overlay subnet: all its VMs move in one window together
  with the cutover, or an NSX Edge bridge joins the old and new segment
  during the migration, or the subnet goes with HCX after all
  ([Cutting over and cleaning up, Networks on NSX overlay](35-cutover-and-clean-up.md#networks-on-nsx-overlay)).
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
- **Yes, with services on the gateways:** NAT, a load balancer, DHCP, a
  DNS forwarder, an IPsec or L2 VPN or the gateway firewall on a source
  Tier-1 or Tier-0 don't go with the segments or the DFW. List them now,
  per subnet: they decide which subnets move together, and two of them are
  decisions with a cost. A workload load balancer on the target is Avi
  Load Balancer, because *"General purpose load balancing features are no
  longer part of the VCF entitlement"* from VCF 9.0
  ([KB 401492](https://knowledge.broadcom.com/external/article/401492)),
  and the gateway firewall needs a vDefend licence on the target. Details
  in [docs/31, step 5](31-carry-over-networks-and-firewall.md#step-5-services-on-the-nsx-gateways).

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

![Side-by-side migration in seven phases. 0, decide the route: the five questions, with baseline exports of the source; check: route chosen and written down. 1, build the target: new VCF or VVF 9 environment, HCX on both sides if chosen; check: target healthy, licensed, reachable. 2, carry over vCenter configuration: roles, tags, storage policies, folders and folder permissions, with VIRoleManager, VITagManager, StoragePolicyManager and VIFolderManager; check: everything exists on the target with the same names. 3, carry over the networks and the firewall: VDS port groups, NSX segments and NSX distributed firewall policies, with VDSPortGroupManager, nsx-segment-migration and Jeroen Buren's NSX DFW toolkit; check: every source network has a mapped target and the DFW comparison is clean. 4, prove the path: ports 8000, 902 and 443, HCX diagnostics, one test VM there and back; check: test VM runs with network, policy, tags and folder. 5, migrate in waves: HCX Mobility Groups or Import VMs, then VIFolderManager to restore folders, VITagManager for the vSphere tags and attribute values, and the NSX tags on the VMs; check: each wave verified by the application owner. 6, cut over and clean up: gateways to the target, remove network extensions, retire the source; check: nothing left running on the source.](images/side-by-side-migration/phases.png)

Each phase below has three parts: what it's for, what you do, and the
check that closes it. Don't start a phase before the previous check
passes. The old environment stays in production the whole time, so
there's no reason to rush a phase.

### Phase 0: decide the route

- **Do:** answer the [five questions](#phase-0-answer-five-questions).
  Then take a **baseline export** of the source with the toolkits below
  (roles, storage policies, folders, port groups, segments) and of the
  tag assignments and attribute values (VITagManager). Even when
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
   VITagManager carries them over (lab-tested; dry run first).
3. **Custom attributes.** Same KB, same reason; VITagManager takes the
   attribute names along in the same run.
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
  - If the source NSX gateways run services (NAT, load balancer, DHCP,
    DNS forwarder, VPN, gateway firewall), give each one a place on the
    target and build it ready, switched off where it owns an IP address,
    so it can be switched over in its subnet's cutover window.
- **Check:** every source network a VM uses has a target in the mapping
  table, and the target network is present on every target host that
  will run those VMs. For the DFW: the toolkit's comparison script
  (`Compare-NSX-Migration.ps1`) reports nothing *"Missing on
  destination"* ([part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/)).

### Phase 4: prove the path

Step by step, with the test per flow, the test VM there and back per
route and the evidence sheet: [Proving the path](34-prove-the-path.md).
In short:

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

Step by step: [Migrating with HCX](33-migrating-with-hcx.md) or
[Migrating without HCX](32-migrating-without-hcx.md). In short:

- **Do:** group the VMs into waves per application, not per host, so an
  application moves as a whole and its owner can test it in one go.
  - With HCX: one Mobility Group per wave. Be careful with
    *Upgrade Virtual Hardware* and *Disable HCX Per-VM EVC*: the VCF blog
    warns they *"can cause lock-in, preventing you from migrating the
    workload back to the legacy environment"*.
  - Without HCX: in the target vSphere Client, right-click the cluster or
    host and choose **Import VMs**.
  - Right **before** each wave, export the tag assignments and custom
    attribute values of its VMs with VITagManager (`-Content Assignments
    -VMListPath <wave-file>`); right **after** it, import them on the
    target with the same wave file, dry run first
    ([docs/30, step 2](30-carry-over-vcenter-configuration.md#step-2-tag-categories-and-tags)).
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
    Or use HCX's **Replicate Security Tags** option on the Mobility Group.
  - An application that runs on both sides for a while is protected by
    two DFWs, and a tag-based group only sees the VMs in its own NSX.
    Add the other side's IP addresses to its groups for as long as it's
    split, and take them out after its last wave
    ([docs/31, 4.9](31-carry-over-networks-and-firewall.md#49-vm-tags-per-wave-phase-5)).
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

Step by step: [Cutting over and cleaning up](35-cutover-and-clean-up.md).

---

## Toolkits

PowerShell toolkits for the configuration work in phases 0, 2, 3 and 5.
They export to files you can read and keep, and import into the target
vCenter or NSX Manager.

**Why the toolkits, and not the vSphere Client or a few PowerCLI lines.**
You can rebuild all of this by hand. The toolkits exist because a
side-by-side migration has traps that a quick copy misses, and because
you want proof of what you moved:

- **A record of the source.** Every export is a file you can read, keep
  and compare. It's your baseline in phase 0, and the record of what the
  old environment looked like after it's gone.
- **See before you change.** Where a toolkit has a dry run (`-DryRun`, or
  `-WhatIf` for the NSX segments), it lists what it would create, move or
  set, and changes nothing.
- **Safe to run again.** What already exists on the target is skipped or
  reused, so after a partial run or a fix you just run it again. The
  vCenter toolkits don't delete anything on an import.
- **Version differences reported, not hidden.** Privileges that a newer
  vCenter no longer has are listed and skipped (VIRoleManager: four of
  them from 8.0 U3 to 9.1.1); capabilities and tags that a storage policy
  needs but the target lacks are reported (StoragePolicyManager); uplink
  names that differ on a VCF-built switch are mapped (VDSPortGroupManager
  `-UplinkMap`).
- **What vCenter manages itself stays out.** System roles, the folders
  that vCenter, the Supervisor and NSX create (`vCLS`, `Namespaces`,
  `NSX Managed Folders`, `Virtual Private Clouds`), and the custom
  attributes that vCenter and other products keep for themselves are
  skipped.
- **Per wave, not just once.** Tag assignments and folder placement don't
  travel with a VM. VITagManager and VIFolderManager restore them after
  each wave; VMs that haven't arrived yet are listed and skipped, so the
  same export serves every wave.
- **Tested on this route.** The vCenter toolkits were run in a lab from a
  vCenter 8.0 U3 source and from VCF 9.0.2 into VCF 9.1.1 (2026-11-16),
  and what that showed is written down on the pages that use them.

**Getting them.** Each toolkit is a public GitHub repository, linked in
the table below. Put them on the workstation or jump host you run the
migration from:

- **With git:** `git clone https://github.com/pauldiee/<toolkit>.git`, for
  example `git clone https://github.com/pauldiee/VITagManager.git`.
  `git pull` in the folder fetches a newer version later.
- **Without git:** on the repository page, **Code** > **Download ZIP**,
  and extract it. Windows marks files downloaded from the internet, and
  under the `RemoteSigned` execution policy PowerShell won't run such
  unsigned scripts; unblock the folder once with
  `Get-ChildItem -Recurse | Unblock-File`
  ([about_Execution_Policies](https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_execution_policies)).
- **Jump host without internet:** download on another machine and copy
  the folders across, together with PowerShell 7 and VCF.PowerCLI
  ([planning guide, Jump Host PowerShell](https://vcf-planning.hollebollevsan.nl/docs/42-jump-host-powershell/)).

Start each toolkit from its own folder in `pwsh`. Its README lists the
parameters; the vCenter toolkits print their version when they start. Use one
working folder for all exports
([docs/30, Before you start](30-carry-over-vcenter-configuration.md#before-you-start)).

**Who made them.** VIRoleManager, VITagManager, StoragePolicyManager,
VIFolderManager, VDSPortGroupManager and nsx-segment-migration are
written by Paul van Dieen, the author of this guide
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
| [VIRoleManager](https://github.com/pauldiee/VIRoleManager) | vCenter roles and their privileges | Tested against vSphere 9, and from vCenter 8.0 U3 into 9.1.1 (lab) |
| [VITagManager](https://github.com/pauldiee/VITagManager) | Tag categories and tags, custom attributes, and per wave the tag assignments and attribute values on the VMs | Lab-tested from vCenter 8.0 U3 and VCF 9.0.2 into 9.1.1. Run with `-DryRun` first |
| [StoragePolicyManager](https://github.com/pauldiee/StoragePolicyManager) | VM storage policies (SPBM), incl. tag-based rules | Tested against vSphere 9, and from vCenter 8.0 U3 into 9.1.1 (lab) |
| [VIFolderManager](https://github.com/pauldiee/VIFolderManager) | Folder trees (VM, host, datastore, network), which objects sit where, and permissions on folders | Lab-tested on VCF 9.1.1 and 9.0.2, and from vCenter 8.0 U3 into 9.1.1. Run with `-DryRun` first |
| [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) | VDS port groups, also onto a switch with other uplink names (`-UplinkMap`, 1.2.0+) | Lab-tested on vCenter 9.1.1 and 9.0.2 |
| [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration) | NSX segments, segment profiles and their bindings | NSX 4.x and 9.x |
| [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit), by Jeroen Buren | NSX distributed firewall: IP sets, services and service groups, security groups, policies and rules, VM tags. Renames NSX-V-era IDs to their names, rolls an import back, and compares source and target | Written for an NSX 4 to NSX 9 migration; no Gateway Firewall. See his posts: [part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/), [part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/), [part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/) |

The vCenter toolkits have been tested with vSphere 9 vCenters on both
sides, and from a **vCenter 8.0 U3 source** into 9.1.1 (lab, 2026-11-16).
A **7.x source** hasn't been tested. Check the export file before you
import it, and import with a dry run where the toolkit has one.

---

## The rest of this set

Published: [Carrying over the vCenter configuration](30-carry-over-vcenter-configuration.md)
(phase 2), [Carrying over the networks and the firewall](31-carry-over-networks-and-firewall.md)
(phase 3), [Proving the path](34-prove-the-path.md) (phase 4),
[Migrating with HCX](33-migrating-with-hcx.md) and
[Migrating without HCX](32-migrating-without-hcx.md) (phase 5), and
[Cutting over and cleaning up](35-cutover-and-clean-up.md) (phase 6).

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
- [KB 401492](https://knowledge.broadcom.com/external/article/401492),
  VMware NSX Load Balancer Entitlement Changes (read 2026-11-16)
- Read on 2026-11-16, for *What doesn't move live*:
  HCX user guide for VCF 9.1,
  [Understanding vMotion and Cold Migration](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/migrating-virtual-machines-with-vmware-hcx/understanding-vmware-hcx-vmotion-and-cold-migration.html)
  and
  [Understanding Bulk Migration](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/migrating-virtual-machines-with-vmware-hcx/understanding-vmware-hcx-bulk-migration.html);
  [KB 433258](https://knowledge.broadcom.com/external/article/433258)
  (CNS-CSI persistent volumes),
  [KB 421671](https://knowledge.broadcom.com/external/article/421671)
  (vSphere Replication),
  [KB 442091](https://knowledge.broadcom.com/external/article/442091)
  (SCSI bus sharing)
