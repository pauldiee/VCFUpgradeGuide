# VSS to VDS migration, before extending VVF to VCF

A companion to the [Standalone VVF upgrade](14-standalone-vvf-upgrade.md),
expanding on its [VSS→VDS
note](14-standalone-vvf-upgrade.md#extending-to-full-vcf-needs-a-vds-migration-first):
standalone VMware vSphere Foundation (VVF) has no distributed-switch
requirement and can run on the Virtual Standard Switch (VSS) indefinitely,
but **full VCF does** – NSX only prepares ESXi hosts as transport nodes on
a vSphere Distributed Switch (VDS), and SDDC Manager / VCF Operations Fleet
Management's own workload-domain automation has no VSS option at all. A
VSS-based fleet extending from standalone VVF to full VCF needs this done
first, as its own prerequisite step – no VCF workflow does it for you.

Applies whenever a cluster's networking is still on VSS and the fleet is
heading toward full VCF (NSX, SDDC Manager, or VCF Operations Fleet
Management taking over domain lifecycle). Not needed for a fleet staying on
standalone VVF.

---

## Before touching anything

- **Inventory the current VSS configuration per host**: port groups, VLAN
  IDs, security policy (promiscuous mode, forged transmits, MAC address
  changes), traffic shaping, NIC teaming/failover order, and MTU. The
  distributed port groups created below need to reproduce this exactly –
  a silent mismatch (wrong VLAN, wrong security policy) is the most common
  way this migration causes an outage.
- **Confirm spare uplink capacity.** The migration wizard moves one
  physical NIC at a time per host by design, so a host needs at least one
  NIC available to hand to the new VDS while the others still carry
  production traffic on the VSS – a host with all NICs already claimed by
  the VSS needs a cabling/NIC-teaming change first.
- **Pick a VDS version.** Broadcom TechDocs' [Create a vSphere Distributed
  Switch](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/create-a-vsphere-distributed-switch.html)
  page ties the "Select version" wizard page to the vCenter version in use
  – pick the highest version the *current* vCenter supports, not
  necessarily the eventual VCF target, since the switch can be upgraded
  later (see [Phase 7's vDS version-upgrade
  note](13-vcf-upgrade-sequence.md#phase-7--esx--host-cluster-upgrade) for that
  follow-on step once vCenter itself is on the VCF target build).
- **Do this per cluster, not fleet-wide in one pass.** Nothing about the
  procedure below is fleet-wide; treat each cluster as its own
  maintenance-window activity.

### Inventory script (PowerCLI)

There is no vCenter backup/export API for standard switches (unlike
`Export-VDPortGroup` on a VDS) – pull the config with PowerCLI instead, per
cluster:

```powershell
$cluster = Get-Cluster -Name "<cluster-name>"
$date = Get-Date -Format "yyyyMMdd-HHmm"

$rows = foreach ($vmhost in ($cluster | Get-VMHost)) {
  foreach ($vss in ($vmhost | Get-VirtualSwitch -Standard)) {
    foreach ($pg in ($vss | Get-VirtualPortGroup)) {
      $sec = $pg | Get-SecurityPolicy
      $teaming = $pg | Get-NicTeamingPolicy
      [PSCustomObject]@{
        VMHost              = $vmhost.Name
        Switch              = $vss.Name
        NumPorts            = $vss.NumPorts
        MTU                 = $vss.Mtu
        PortGroup           = $pg.Name
        VLanId              = $pg.VLanId
        AllowPromiscuous    = $sec.AllowPromiscuous
        ForgedTransmits     = $sec.ForgedTransmits
        MacChanges          = $sec.MacChanges
        LoadBalancingPolicy = $teaming.LoadBalancingPolicy
        NetworkFailover     = $teaming.NetworkFailoverDetectionPolicy
        NotifySwitches      = $teaming.NotifySwitches
        FailbackEnabled     = $teaming.FailbackEnabled
        ActiveNic           = ($teaming.ActiveNic -join ";")
        StandbyNic          = ($teaming.StandbyNic -join ";")
        UnusedNic           = ($teaming.UnusedNic -join ";")
      }
    }
  }
}
$rows | Export-Csv -Path ".\VSS-Inventory-$date.csv" -NoTypeInformation -UseCulture

# VMkernel adapters separately - portgroup, IP, and which TCP/IP stack/service they carry
$cluster | Get-VMHost | Get-VMHostNetworkAdapter -VMKernel |
  Select-Object VMHost, Name, PortGroupName, IP, SubnetMask, Mtu,
    VMotionEnabled, ManagementTrafficEnabled, VsanTrafficEnabled |
  Export-Csv -Path ".\VSS-VMKernel-Inventory-$date.csv" -NoTypeInformation -UseCulture
```

Traffic shaping isn't covered by `Get-VirtualPortGroup`/`Get-SecurityPolicy` –
check it per port group with
`(Get-VirtualPortGroup -Name "<pg-name>").ExtensionData.Spec.Policy.ShapingPolicy`
if any port groups use it (uncommon on a VSS, but confirm rather than assume).

---

## 1. Create the distributed switch

vSphere Client → right-click the datacenter → **Distributed Switch → New
Distributed Switch**. Per Broadcom TechDocs' [Create a vSphere Distributed
Switch](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/create-a-vsphere-distributed-switch.html):

1. **Name and location page** – enter a name, or accept the generated one.
2. **Select version page** – pick the VDS version (per the note above).
3. **Configure settings page** – set the **Number of uplinks** to match
   (or exceed) the host's available physical NICs, set **Network I/O
   Control**, and optionally check **Create a default port group** (skip
   this if the port groups will be created individually to match the VSS
   inventory exactly – see below).
4. **Ready to complete page** – review and **Finish**.

Create the distributed port groups next, one per VSS port group identified
during inventory, matching VLAN ID and security policy exactly. Don't rely
on the wizard's default port group for anything beyond a throwaway test.

---

## 2. Add hosts and migrate networking

Use the **Add and Manage Hosts** wizard against the new distributed switch
– it migrates physical NICs, VMkernel adapters, and VM networking for
multiple hosts in a single guided operation, rather than the
single-host-at-a-time flow. Per Broadcom TechDocs' [Migrate VMkernel
Adapters to a vSphere Distributed
Switch](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/manage-networking-on-multiple-hosts-on-a-vsphere-distributed-switch/migrate-vmkernel-adapters-to-a-vsphere-distributed-switch.html):

1. vSphere Client → **Networking**, navigate to the distributed switch →
   right-click → **Add and Manage Hosts**.
2. **Select task page** → **Manage host networking** → **Next**.
3. **Select hosts page** → select the hosts to migrate → **Next**.
4. **Manage physical adapters page** → assign an uplink to one spare
   physical NIC per host (from the inventory/spare-capacity check above) →
   **Next**. *"If a host does not have an assigned physical network
   adapter, then a warning appears"* – don't proceed past that warning
   without resolving it.
5. **Manage VMkernel adapters page** → select **Adapters on all hosts** →
   **Assign Port Group** → map each VMkernel adapter to its matching
   distributed port group → **Next**.
6. **Migrate VM networking page** → check **Migrate virtual machine
   networking** → assign each VM/VM network adapter to its matching
   distributed port group → **Next**.
7. **Ready to Complete page** → review → **Finish**.

This leaves each migrated host with one uplink on the VDS and the rest
still on the VSS. Repeat **Add and Manage Hosts** against the same hosts to
migrate the remaining physical NICs once the first pass is verified (next
section) – moving every uplink in one pass removes the VSS's ability to
carry traffic as a fallback mid-migration.

For a single host instead of a wizard-driven multi-host batch – useful for
a one-off recheck or a host that failed the batch – Broadcom TechDocs'
[Migrate Network Adapters on a Host to a vSphere Distributed
Switch](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/manage-networking-on-individual-hosts-on-a-vds/migrate-network-adapters-on-a-host-to-a-vsphere-distributed-switch.html)
covers the same steps from the host's **Configure → Networking → Virtual
Switches** tab instead.

---

## 3. Verify before removing the standard switch

- Confirm each migrated VMkernel adapter (management, vMotion, storage) is
  reachable – `vmkping` from the host, or the equivalent connectivity check
  for the adapter's traffic type.
- Confirm migrated VMs still have network connectivity and the correct VLAN
  (a wrong port group mapping in step 2.6 shows up here, not earlier).
- Confirm uplink status on the distributed switch (vSphere Client →
  distributed switch → **Configure → Topology**) – every migrated host
  should show its assigned uplinks as connected, not just added.
- Leave the VSS in place, with its remaining uplink(s) and now-empty port
  groups, until this is confirmed clean across every host in the cluster –
  it's the fastest rollback path if something doesn't resolve (see
  Rollback below).

---

## 4. Decommission the standard switch

Once every host in the cluster is fully migrated and verified: remove the
remaining uplink(s) from the VSS (they can be reassigned or left
unclaimed), then delete the standard switch itself from each host
(**Configure → Networking → Virtual Switches** → select the VSS → remove).

---

## Rollback

The VSS is the rollback path, and it stays valid **only until it's
decommissioned in step 4** – don't remove it until verification (step 3)
is fully clean.

To reverse a partial or fully completed migration, per Broadcom KB 306406
([Migrate VMs and VMkernel Adapters from vDS to
vSS](https://knowledge.broadcom.com/external/article/306406/migrate-vms-and-vmkernal-adapters-from-d.html)):

1. Recreate the needed VM port groups on the VSS, matching VLAN/security
   settings from the VDS's distributed port groups.
2. Move one physical NIC from the VDS uplinks back to the VSS.
3. Migrate the management VMkernel adapter back first (host → ellipsis
   next to the VSS → **Migrate vmkernel adapters**), then any remaining
   VMkernel adapters.
4. Re-point each VM's network adapter back to the matching VSS port group.
5. Once every VM and VMkernel adapter is off the VDS, move the remaining
   uplink(s) back to the VSS.

This is the same shape of operation as the forward migration, just in
reverse and via the per-host wizard rather than the multi-host one – budget
the same per-host care around uplink/VMkernel/VM ordering.

---

## Sources

- [Create a vSphere Distributed Switch](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/create-a-vsphere-distributed-switch.html)
- [Migrate VMkernel Adapters to a vSphere Distributed Switch (multi-host)](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/manage-networking-on-multiple-hosts-on-a-vsphere-distributed-switch/migrate-vmkernel-adapters-to-a-vsphere-distributed-switch.html)
- [Migrate Network Adapters on a Host to a vSphere Distributed Switch (single-host)](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vsphere-networking/basic-networking-with-vnetwork-distributed-switches/manage-networking-on-individual-hosts-on-a-vds/migrate-network-adapters-on-a-host-to-a-vsphere-distributed-switch.html)
- ["Migrate VMs and VMkernal Adapters from Distributed Switch (vDS) to Standard Switch (vSS)" (KB 306406)](https://knowledge.broadcom.com/external/article/306406/migrate-vms-and-vmkernal-adapters-from-d.html)
- [Managing NSX on a vSphere Distributed Switch](https://techdocs.broadcom.com/us/en/vmware-cis/nsx/vmware-nsx/4-2/administration-guide/host-switches/managing-nsx-on-a-vsphere-distributed-switch.html) – the NSX-side requirement motivating this migration
