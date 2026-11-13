# Migrating without HCX

Phase 5 of a [side-by-side migration](29-side-by-side-migration.md), for
the route without HCX: the VMs move with **Advanced Cross vCenter
vMotion**, the vMotion between two vCenters that vSphere has built in.
This page helps you choose how to start each migration, size the waves,
and run every wave the same way: prepare, migrate, restore what doesn't
travel with the VM, check, sign off.

It assumes phases 2 to 4 are done: the configuration
([docs/30](30-carry-over-vcenter-configuration.md)) and the networks and
firewall ([docs/31](31-carry-over-networks-and-firewall.md)) exist on the
target, and one test VM has gone there and back (phase 4 in
[docs/29](29-side-by-side-migration.md#phase-4-prove-the-path)).

Facts on this page come from the vSphere 9.1 TechDocs, Broadcom KB
articles and the PowerCLI help, read word for word on 2026-11-13. Each is
linked where it's used.

---

## Contents

- [The wave, at a glance](#the-wave-at-a-glance)
- [Before the first wave](#before-the-first-wave)
- [Which way to start a migration](#which-way-to-start-a-migration)
- [Sizing a wave](#sizing-a-wave)
- [Running a wave](#running-a-wave)
- [Special cases](#special-cases)
- [Moving a VM back](#moving-a-vm-back)
- [Phase 5 is done when](#phase-5-is-done-when)
- [Sources](#sources)

---

## The wave, at a glance

![A migration wave without HCX in five steps. 1, before: export the tag assignments of the wave's VMs, check the VMs, agree the window with the application owner. 2, migrate: Import VMs on the target vCenter, Export on the source vCenter, or PowerCLI Move-VM for larger numbers; choose compute, storage and policy, folder and network per VM. 3, after: put the VMs in their folders, re-apply vSphere tags and NSX tags, check storage policies and custom attributes. 4, check: the application owner tests, network, policy, tags and folder are right. 5, sign off, then the next wave. If a check fails, move the VM back. Keep the VM's virtual hardware and VMware Tools as they are until the wave is signed off.](images/without-hcx/wave.png)

---

## Before the first wave

Go through this once, before wave 1:

- [ ] **Phases 2 to 4 are done**, and the test VM went there and back.
- [ ] **Ports.** Advanced Cross vCenter vMotion needs *"Port 8000 on the
      ESX host for vMotion"*, *"Port 902 on the ESX host for NFC"* and
      *"Port 443 between the two vCenter instances"*
      ([vSphere 9.1, Import or Clone](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)).
- [ ] **The same broadcast domain.** vCenter checks some things, but not
      everything: *"If the source and destination distributed switches are
      not in the same broadcast domain, virtual machines lose network
      connectivity after migration"*, and vCenter *"does not perform checks
      for and notify you about"* that
      ([Network Compatibility Checks](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/network-compatibility-checks-during-vm-migration.html)).
      When VMs keep their IP addresses, their VLANs must reach the target
      hosts (question 2 in [docs/29](29-side-by-side-migration.md#2-do-the-vms-keep-their-ip-addresses)).
- [ ] **VDS versions.** vCenter refuses a vMotion between distributed
      switches of different versions (same page, and
      [KB 318582](https://knowledge.broadcom.com/external/article/318582)).
      Your answer to question 4 in
      [docs/29](29-side-by-side-migration.md#4-which-vds-versions-are-on-both-sides)
      decides how you handle it: a migration switch at the source's version,
      the KB's workaround, or powered-off migration.
- [ ] **An account with the privileges** on both vCenters:
      *"Resource.Query vMotion"*, plus *"Resource.Migrate powered on
      virtual machine"* or *"Resource.Migrate powered off virtual
      machine"* (vSphere 9.1, Import or Clone).
- [ ] **Encrypted VMs** are listed separately; they need another way
      (see [Special cases](#special-cases)).
- [ ] **The tag assignment export** from phase 2 exists
      ([docs/30, step 2](30-carry-over-vcenter-configuration.md#step-2-tag-categories-and-tags)).

---

## Which way to start a migration

Three ways, all doing the same Advanced Cross vCenter vMotion:

| Way | Where | When | Version rule (TechDocs) |
| --- | --- | --- | --- |
| **Import VMs** | Target vCenter: right-click a host or cluster, **Import VMs** | The default: the target is always new enough | Target vCenter *"7.0 Update 1c or later"*; source vCenter *"6.7 or later"*; destination hosts *"6.7 or later"* |
| **Export** | Source vCenter: select VMs, **Migrate**, **Cross vCenter export** | When you prefer to work from the source | Source vCenter *"7.0 Update 1c or later"* to export, *"7.0 Update 3 or later"* to clone; target *"6.7 or later"* |
| **PowerCLI `Move-VM`** | A workstation connected to both vCenters | Larger numbers of VMs, repeatable waves, a script per wave | PowerCLI: *"You can move virtual machines between vCenter Server systems of vSphere version 6.0 and later"* |

Version rules from
[Import or Clone](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html)
and
[Export or Clone](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-to-an-external-vcenter-server-instance.html).
Both pages: Advanced Cross vCenter vMotion *"does not depend on vCenter
linking and you can migrate virtual machines across vCenter systems in
different vCenter Single Sign-On domains"*.

Both wizards offer **Keep VMs on the source vCenter** (*"performs a VM
clone operation"*): the VM is copied and the original stays. That's
useful for a test or for a VM that must be able to go back without a
second migration, but never run the copy and the original on the same
network at the same time.

---

## Sizing a wave

A wave is limited by the application owners' time, and by what vSphere
runs at once. vCenter queues what doesn't fit
([Limits on Simultaneous Migrations](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/limits-on-simultaneous-migrations.html)):

- A migration to another vCenter moves both the VM and its disks, which is
  *"vMotion without shared storage"*: it *"inherits the network, host, and
  datastore costs"* of vMotion and Storage vMotion.
- **Per host:** *"vMotion Without Shared Storage | 7.0, 8.0, 9.0, 9.1 | 2 |
  4"*: two at a time per host.
- **Per datastore:** a maximum cost of 128, and Storage vMotion costs 16
  on the source and on the destination datastore: eight at a time per
  datastore.
- **Per network:** a maximum cost of 8 on 10GigE (4 on 1GigE).

So spread a wave over several source hosts and target datastores; a wave
of 20 VMs that all sit on one host runs two at a time. More than that is
queued, not refused.

In the wizard, *"If you want to migrate more than one virtual machine, the
selected virtual machines must be in the same power state"*: split a wave
into a powered-on and a powered-off batch.

**Check.** Each wave lists its VMs per application, their source hosts and
target datastores, the window, and who signs it off.

---

## Running a wave

### 1. Before

1. **Export the tag assignments** of the wave's VMs, right before you
   start. Tag assignments don't travel with the VM (Jim Millard,
   [Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html)):

   ```powershell
   Get-TagAssignment -Server $src -Entity (Get-VM -Server $src -Name <wave-vm-names>) | Select-Object `
     @{N='VM';E={$_.Entity.Name}}, @{N='Category';E={$_.Tag.Category.Name}}, @{N='Tag';E={$_.Tag.Name}} |
     Export-Csv -Path <working-folder>\tags-wave-<n>.csv -NoTypeInformation
   ```

2. **Check the VMs**: not in a state that blocks vMotion (see
   [Virtual Machine Conditions and Limitations for vSphere vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/migration-with-vmotion/virtual-machine-conditions-and-limitation-for-vmotion.html)),
   disks in persistent mode or RDMs (*"Virtual machine disks must be in
   persistent mode or be raw device mappings (RDMs)"*,
   [Requirements and Limitations for vMotion Without Shared Storage](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/migration-with-vmotion/migration-with-vmotion-in-environments-without-shared-storage/requirements-and-limitations-for-vmotion-without-shared-storage.html)).
3. **Agree the window** with the application owner.

### 2. Migrate

**With the wizard (Import VMs on the target).** Right-click the target
cluster or host, **Import VMs**, then (vSphere 9.1, Import or Clone):

1. **Source vCenter:** a saved one, or its FQDN and credentials.
2. **VMs:** the wave's VMs (all in the same power state).
3. **Compute:** a cluster, or a host when the cluster has no DRS (*"If DRS
   is not enabled for a cluster, select a specific host"*).
4. **Storage:** disk format, the **storage policy** from your phase 2
   mapping, and the datastore.
5. **Folder:** the VM's folder from the folder export. Picking it here
   saves the folder step afterwards.
6. **Networks:** a target network per source network, or per network
   adapter with **Advanced**. Use the network mapping table from
   [docs/31](31-carry-over-networks-and-firewall.md#step-1-the-network-mapping-table).
7. **Finish.** *"If errors occur during the migration, the virtual machines
   revert to their original states and locations."*

**With PowerCLI (`Move-VM`), for larger waves.** Connected to both
vCenters, one VM at a time following the mapping tables, for example:

```powershell
$src = Connect-VIServer <source-vcenter>
$dst = Connect-VIServer <target-vcenter>

$vm      = Get-VM -Server $src -Name '<vm>'
$nics    = Get-NetworkAdapter -VM $vm
$pg      = Get-VDPortgroup -Server $dst -Name '<target-port-group>'
$ds      = Get-Datastore -Server $dst -Name '<target-datastore>'
$folder  = Get-Folder -Server $dst -Name '<target-folder>' -Type VM
$policy  = Get-SpbmStoragePolicy -Server $dst -Name '<target-policy>'
$cluster = Get-Cluster -Server $dst -Name '<target-cluster>'

Move-VM -VM $vm -Destination $cluster -Datastore $ds -NetworkAdapter $nics -PortGroup $pg `
  -InventoryLocation $folder -StoragePolicy $policy
```

`-PortGroup` takes *"one or equal to the number of the specified network
adapters"*; `-StoragePolicy` *"is attached to VMHome and all hard disks"*;
and *"When you move a virtual machine from one vCenter Server system to
another, only datastores are supported as storage destinations"* (PowerCLI
help, `Move-VM`). Add `-RunAsync` to start several and let vCenter queue
them; then follow the tasks until they're all done. Test the script on
the phase 4 test VM before the first wave.

### 3. After

For the VMs that arrived:

1. **Folders:** if you didn't pick them in the wizard, run VIFolderManager's
   import with `-MoveObjects` (dry run first); VMs that haven't arrived are
   listed and skipped
   ([docs/30, step 5](30-carry-over-vcenter-configuration.md#step-5-folders-and-permissions)).
2. **vSphere tags:** re-apply the assignments from the wave's export:

   ```powershell
   Import-Csv <working-folder>\tags-wave-<n>.csv | ForEach-Object {
     $vm  = Get-VM -Server $dst -Name $_.VM
     $tag = Get-Tag -Server $dst -Category $_.Category -Name $_.Tag
     New-TagAssignment -Server $dst -Entity $vm -Tag $tag
   }
   ```

3. **NSX tags**, when the target uses the distributed firewall
   ([docs/31, 4.9](31-carry-over-networks-and-firewall.md#49-vm-tags-per-wave-phase-5)).
4. **Storage policy and custom attributes:** check each VM against the
   policy mapping from phase 2; custom attribute values travel with the VM
   when the attribute exists on the target
   ([KB 344959](https://knowledge.broadcom.com/external/article/344959)).
5. **Leave the virtual hardware and VMware Tools alone** until the wave is
   signed off. An upgrade there is one more thing that stands in the way
   of moving the VM back.

### 4. Check and sign off

- The application owner tests the application.
- Each VM has its network, storage policy, tags (vSphere and NSX) and
  folder.
- Then sign off the wave, and start the next one.

---

## Special cases

**Encrypted VMs.** The wizard doesn't do them: *"Currently, you must use
the vSphere APIs to migrate or clone encrypted virtual machines across
vCenter instances"*. Both vCenters must share the key provider: *"the key
provider name must be the same on both the source and destination vCenter
instances"*, with the same key servers for a standard key provider or
*"the same KDK"* for vSphere Native Key Provider. Migrating also needs the
*Cryptographic operations > Migrate* privilege
([What Is Encrypted vSphere vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/encrypted-vsphere-vmotion.html)).
Set the key provider up on the target in phase 1, and test one encrypted
VM in phase 4.

**VDS versions differ.** See *Before the first wave*. Moving the VM while
it's powered off sidesteps the vMotion check (KB 318582 names *"power-off
the VM and then do the migration between the switches (cold migration)"*
as one of its ways out).

**Different CPU generations (EVC).** *"When you migrate a powered-on or
suspended virtual machine, the set of CPU features available on the target
host must include all of the features available to the virtual machine
when it was powered-on"*
([CPU Compatibility and EVC](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/cpu-compatibility-and-evc.html)).
Newer target hosts usually offer more, so the move works; the same rule
decides whether a VM can go back to older hosts (see
[Moving a VM back](#moving-a-vm-back)).

**RDMs.** *"When you move a virtual machine with RDMs and do not convert
those RDMs to VMDKs, the destination host must have access to the RDM
LUNs"* (Requirements and Limitations for vMotion Without Shared Storage).

**VMs that can't move live.** Move them powered off in the window, as a
separate batch (*"the selected virtual machines must be in the same power
state"*).

**MAC addresses.** *"its MAC addresses are transferred to the target
vCenter. The source vCenter adds the MAC addresses to a denylist so that
it does not assign them to newly created virtual machines"*
([MAC Address Management](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/mac-address-management-in-migration-between-vcenter-server-systems.html)).
The VM keeps its MAC address, so DHCP reservations and MAC-based rules
keep working.

---

## Moving a VM back

A VM goes back the same way it came: Import VMs on the source vCenter (or
Export on the target), with the source's network, datastore and folder.
Three things decide whether a live move back works:

- **CPU features.** The VM's CPU features are fixed when it powers on.
  As long as it hasn't been powered off and on again on the newer hosts,
  it still has the features of the old hosts and can move back live. After
  a power cycle on newer hosts it may need features the old hosts don't
  have, and then only a powered-off move works (CPU Compatibility and
  EVC, above).
- **VDS versions**, the same as on the way there.
- **What changed on the target**: virtual hardware or VMware Tools
  upgrades, which is why *After* says to leave them until sign-off.

When a wave used **Keep VMs on the source**, going back means powering off
the copy on the target and powering on the original.

---

## Phase 5 is done when

- [ ] Every VM in the migration scope is on the target, or written down
      as staying behind with a reason.
- [ ] Every wave is signed off by its application owner.
- [ ] Every VM has its folder, vSphere tags, NSX tags (where used),
      storage policy and custom attributes.
- [ ] Copies left on the source with *Keep VMs on the source* are
      removed, once the wave is signed off.
- [ ] The tag exports and wave lists are in the working folder.

Then go on with phase 6, cutover and clean-up, in
[docs/29](29-side-by-side-migration.md#phase-6-cut-over-and-clean-up).

---

## Sources

Read word for word on 2026-11-13.

- vSphere 9.1 TechDocs, *Migrating Virtual Machines*:
  [Import or Clone a Virtual Machine with Advanced Cross vCenter vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-from-an-external-vcenter-server-instance.html),
  [Export or Clone a Virtual Machine with Advanced Cross vCenter vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/migrate-a-virtual-machine-to-an-external-vcenter-server-instance.html),
  [What Are the Requirements for vMotion Between vCenter Instances](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/requirements-for-migration-across-vcenter-servers.html),
  [Network Compatibility Checks During vMotion Between vCenter Instances](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/network-compatibility-checks-during-vm-migration.html),
  [MAC Address Management During Migration Between vCenter Systems](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/vmotion-across-vcenter-server-systems/mac-address-management-in-migration-between-vcenter-server-systems.html),
  [vCenter Limits on Simultaneous Migrations](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/limits-on-simultaneous-migrations.html),
  [CPU Compatibility and vSphere Enhanced vMotion Compatibility](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/cpu-compatibility-and-evc.html),
  [What Is Encrypted vSphere vMotion](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/encrypted-vsphere-vmotion.html),
  [Requirements and Limitations for vMotion Without Shared Storage](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-and-host-management/migrating-virtual-machines/migration-with-vmotion/migration-with-vmotion-in-environments-without-shared-storage/requirements-and-limitations-for-vmotion-without-shared-storage.html)
- [KB 344959](https://knowledge.broadcom.com/external/article/344959):
  Cross vCenter Migration and Clone requirements
- [KB 318582](https://knowledge.broadcom.com/external/article/318582):
  Migrating a virtual machine between two different vDS versions
- Jim Millard, 2026-05:
  [Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html)
- PowerCLI help for `Move-VM` (VCF.PowerCLI 9.1.1)
