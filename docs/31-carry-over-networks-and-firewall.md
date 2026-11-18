# Carrying over the networks and the firewall

Phase 3 of a [side-by-side migration](29-side-by-side-migration.md), in
depth. Every network a VM uses on the source needs a counterpart on the
target before that VM moves, and if the source uses the NSX distributed
firewall (DFW), its rules must be in place before the VM lands. This page
takes you through it: the mapping table first, then VDS port groups, NSX
segments and the DFW, each with the commands and a check.

It follows [Carrying over the vCenter configuration](30-carry-over-vcenter-configuration.md)
(phase 2). The workstation, credentials, working folder and the
use-at-your-own-risk notes from
[its "Before you start"](30-carry-over-vcenter-configuration.md#before-you-start)
apply here too.

Facts on this page come from Broadcom TechDocs and KB articles, public
blogs, and the toolkits' own documentation and code, checked on
2026-11-13. Each is linked where it's used.

---

## Contents

- [What goes where](#what-goes-where)
- [Before you start](#before-you-start)
- [Step 1: the network mapping table](#step-1-the-network-mapping-table)
- [Step 2: VDS port groups](#step-2-vds-port-groups)
- [Step 3: NSX segments and segment profiles](#step-3-nsx-segments-and-segment-profiles)
- [Step 4: the NSX distributed firewall](#step-4-the-nsx-distributed-firewall)
- [Step 5: services on the NSX gateways](#step-5-services-on-the-nsx-gateways)
- [Phase 3 is done when](#phase-3-is-done-when)
- [Sources](#sources)

---

## What goes where

![Carrying over the networks and the firewall. Step 1: a network mapping table, from the networks VMs actually use. Step 2: VDS port groups go from the source VDS to the target VDS with VDSPortGroupManager; clone the target switch's uplink names, and port group names must be unique per datacenter. Step 3: NSX segments and segment profiles go from the source NSX Manager to the target with nsx-segment-migration; pick the target transport zone, and overlay segments need a gateway and subnet. Networks that HCX extends are not recreated by hand: HCX creates them on the target when you extend them. Step 4: the NSX distributed firewall goes with Jeroen Buren's NSX DFW toolkit: export, sanitize, review, import with WhatIf, import, compare; VM tags follow in phase 5.](images/networks-firewall/routes.png)

| Source | Route | Target | Toolkit |
| --- | --- | --- | --- |
| VDS port group | Recreate | VDS port group | [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) |
| Standard switch port group | Recreate as a VDS port group (step 2, by hand or from a template port group) | VDS port group | – |
| NSX segment (VLAN or overlay) | Recreate | NSX segment | [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration) |
| Any network whose VMs keep their IP addresses through HCX | Extend with HCX Network Extension; HCX creates the target network | Extended network | HCX, see [Networks that HCX extends](#networks-that-hcx-extends) |
| NSX DFW: IP sets, services, groups, context profiles, policies and rules | Export, sanitize, import | NSX DFW | [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit) (Jeroen Buren) |
| NSX tags on VMs | Per wave, after the VM arrives | NSX tags | With HCX: *Replicate Security Tag* (phase 5); without HCX: the same toolkit |
| Services on NSX gateways: NAT, load balancer, DHCP, DNS forwarder, VPN, gateway firewall | List per subnet, rebuild on the target gateway, switch over in the subnet's cutover window | Target gateway, or Avi for load balancing | By hand, see [step 5](#step-5-services-on-the-nsx-gateways) |

---

## Before you start

**The route from phase 0.** Whether VMs keep their IP addresses, and how
(question 2 in [docs/29](29-side-by-side-migration.md#2-do-the-vms-keep-their-ip-addresses)),
decides what you build here:

- **Kept, with HCX:** the extended networks come from HCX Network
  Extension, which creates them on the target (see
  [Networks that HCX extends](#networks-that-hcx-extends)). Don't also
  build them by hand with their own gateway on the target: one subnet
  should have one gateway at a time.
- **Kept, without HCX:** the source VLANs must be trunked to the target
  hosts' uplinks, and you recreate the port groups or VLAN segments with
  the **same VLAN IDs**. The gateway stays on the physical network or the
  source until the cutover. Where the L2 stretch between the sites is the
  standard design (a data center interconnect or an EVPN fabric), the
  VLANs already reach the target side; check that they're on the target
  hosts' uplinks, and note in the mapping table that the gateway doesn't
  move ([docs/35, case A](35-cutover-and-clean-up.md#case-a-the-gateway-doesnt-move)).
  An **NSX overlay** segment on the source isn't
  a VLAN you can trunk: its subnet lives on a source Tier-1, and the two
  NSX environments don't share layer 2. Recreate it on the target without
  a gateway (step 3), and choose per subnet between moving all its VMs in
  the cutover window and an NSX Edge bridge during the migration
  ([docs/35, Networks on NSX overlay](35-cutover-and-clean-up.md#networks-on-nsx-overlay)).
- **Not kept:** you build new networks with new subnets, and the mapping
  table records old and new.

**The target's network design.** Whether a network becomes a VDS port
group, an NSX VLAN segment, an overlay segment or a VPC on the target is
a design choice, not something this page decides. See the
[VCF 9 deployment planning guide](https://vcf-planning.hollebollevsan.nl/).

**The toolkits.** Paul van Dieen wrote VDSPortGroupManager and
nsx-segment-migration; Jeroen Buren wrote the NSX DFW migration toolkit.
The use-at-your-own-risk disclaimer in
[docs/29](29-side-by-side-migration.md#toolkits) applies to all three:
test in a lab first, review every export, use the dry run, and check the
result yourself.

- VDSPortGroupManager needs VCF.PowerCLI and therefore PowerShell 7.4+
  (see [docs/30](30-carry-over-vcenter-configuration.md#before-you-start)).
- nsx-segment-migration and the DFW toolkit talk to the NSX Manager REST
  API directly, without PowerCLI. The DFW toolkit's import opens a Windows
  file dialog for each CSV (*"System.Windows.Forms is unavailable
  (non-Windows / no GUI)"* makes it stop), so run it on a Windows desktop.

---

## Step 1: the network mapping table

Start from what VMs actually use, not from what's configured: networks
nobody uses don't need to move. On the source, with PowerCLI:

```powershell
Get-VM | Get-NetworkAdapter | Group-Object NetworkName |
  Select-Object Name, Count | Sort-Object Name |
  Export-Csv -Path <working-folder>\networks-in-use.csv -NoTypeInformation
```

Then fill in one row per network:

| Column | Example | Why |
| --- | --- | --- |
| Source network | `pg-app-prod` | Name on the source |
| Source type | VDS port group / standard switch / NSX VLAN segment / NSX overlay segment | Decides the toolkit |
| VLAN or segment | VLAN 120 | The target must carry the same VLAN when IPs are kept without HCX |
| Subnet and gateway | `10.11.120.0/24`, gateway `.1` | Where the gateway lives now and after cutover |
| Target network | `pg-app-prod` | Same name keeps the import and the VM's network mapping simple |
| Target type | VDS port group / NSX VLAN segment / overlay / VPC | From the target design |
| Route | Recreate / HCX extend / new subnet | From question 2 |
| Waves | 1, 3 | Which waves need it; the network must exist before the first one |
| DFW groups | `grp-app-prod` | Groups that refer to this network, so you can check them in step 4 |

Note one limit: a VM can move from a standard switch to a distributed
switch, but not from a distributed switch to a standard switch
([KB 344959](https://knowledge.broadcom.com/external/article/344959)).

**Check.** Every network in `networks-in-use.csv` has a row, and every
row has a target and a route.

---

## Step 2: VDS port groups

**Toolkit:** [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager)
(Paul van Dieen). It exports port groups in vCenter's own backup format
(`Export-VDPortGroup`, *"exports the configuration of a specified
distributed port group to a specified .zip file"*, PowerCLI help) and
imports them with `New-VDPortgroup -BackupPath`. It needs VCF.PowerCLI and
therefore PowerShell 7.4+.

| | What | Changes the target? |
| --- | --- | --- |
| [2.1](#21-decide-where-the-port-groups-land) | Decide where the port groups land | No |
| [2.2](#22-compare-the-switches) | Compare the switches | No |
| [2.3](#23-export-from-the-source) | Export from the source | No |
| [2.4](#24-import-into-the-target) | Import into the target | **Yes** |
| [2.5](#25-a-new-switch-hosts-and-uplinks) | A new switch: hosts and uplinks | **Yes** |
| [2.6](#26-standard-switch-port-groups) | Standard switch port groups | **Yes**, by hand |
| [2.7](#27-undo) | Undo | **Yes** |

### 2.1 Decide where the port groups land

Usually on the distributed switch that VCF built for the target cluster.
Sometimes on a separate switch. Decide per mapping-table row:

| Target switch | When | Watch out for |
| --- | --- | --- |
| The VDS VCF built | The default: the hosts and uplinks are already there | Uplink **names** usually differ from the source switch's; the import maps them (2.2, 2.4) |
| A new VDS at the **source's** VDS version | Live migration without HCX, where the VDS versions differ (question 4 in [docs/29](29-side-by-side-migration.md#4-which-vds-versions-are-on-both-sides)) | It needs its own hosts and physical uplinks (2.5); a switch outside the one VCF built is a design decision, check it against the target design |
| Not on a VDS at all | The network is an NSX segment on the target, or HCX extends it | Step 3, or [Networks that HCX extends](#networks-that-hcx-extends) |

**Check.** Every VDS row in the mapping table has a target switch.

### 2.2 Compare the switches

An exported port group's teaming policy refers to uplinks **by name**.
VCF-built switches use `uplink1`, `uplink2`; a source switch often has
other names (`Uplink 1`, `lag1`, ...). Restoring vCenter's own backup onto
such a switch fails with *"activeUplinkPortName ... is not valid"*
(VDSPortGroupManager README). VDSPortGroupManager 1.2.0 and later checks
this before it imports and maps the names for you (2.4); you only need to
know which name goes where. Compare the switches on **both** vCenters:

```powershell
Get-VDSwitch | Select-Object Name, Version, NumUplinkPorts, Mtu,
  @{N='UplinkNames';E={$_.ExtensionData.Config.UplinkPortPolicy.UplinkPortName -join ', '}}
```

- **Names match:** import onto the target switch as is (2.4).
- **Names differ:** write down the uplink map, source name → target
  name, for example `Uplink 1` → `uplink1`, `Uplink 2` → `uplink2`. Map
  the uplinks that carry the same physical role (the same vmnics and the
  same physical switches); the order in the list is not enough. You pass
  this map to the import in 2.4.
- **LACP:** a source port group that uses a LAG (`lag1`) as its active
  uplink can be mapped to plain uplinks, but its load-balancing policy may
  need to change too. The import warns when you do this.
- **MTU** is set on the switch, not on the port group. Check that the
  target switch's MTU is at least the source switch's when networks carry
  jumbo frames.

**Check.** For every source switch you have an uplink map (or know that
the names match), and you know the MTU fits the target switch.

### 2.3 Export from the source

1. Run the export against the **source** vCenter:

   ```powershell
   .\Invoke-VDSPortGroupManager.ps1 -vCenterServer <source-vcenter> -Mode Export -BackupDirectory <working-folder>\portgroups
   ```

   The script runs on the workstation (PowerShell 7.4+, VCF.PowerCLI),
   not on the vCenter. It has been lab-tested against vCenter 9.1.1 and
   9.0.2, and from a vCenter 8.0 U3 source into 9.1.1 (VDSPortGroupManager
   1.4.0, 2026-11-16: all four test port groups identical to the source
   after the import). A vCenter 7 source is not tested; check the export
   (2.3) and the import's dry check (2.4) carefully there.
2. Pick the source switch, then the port groups: a number, a list
   (`1,3,5`), a range (`2-6`) or `all`. Each entry shows its VLAN and port
   count; uplink port groups are left out.
3. Port groups that NSX manages are tagged `[NSX-backed]` and skipped:
   *"the vCenter backup API does not support them and their
   configuration lives in NSX Manager"* (README). Those go across in
   step 3.
4. Read the summary: *succeeded / skipped (NSX-backed) / failed*. The log
   file is in `Logs\` next to the script.

Next to each zip the export writes a **settings file**, `<portgroup>.json`:
the port group's complete configuration as the vSphere API returns it,
with a readable summary on top (VLAN, uplink order, shaping, NetFlow,
allocation). Keep both files together; the import needs the settings file
to map uplink names.

**Check.** One `<portgroup>.zip` and one `<portgroup>.json` per port group
in the mapping table, and the summary shows no failures.

### 2.4 Import into the target

1. Run the import against the **target** vCenter, with the uplink map from
   2.2 if the names differ:

   ```powershell
   .\Invoke-VDSPortGroupManager.ps1 -vCenterServer <target-vcenter> -Mode Import -BackupDirectory <working-folder>\portgroups `
     -UplinkMap @{ 'Uplink 1' = 'uplink1'; 'Uplink 2' = 'uplink2' }
   ```

   Without `-UplinkMap`, the script asks per missing name which target
   uplink it maps to, with a *skip* option.
2. Pick the zips.
3. Pick the target switch:
   - **A. An existing switch**, normally the one VCF built (2.1).
   - **B. `<Create a NEW VDS and import into it>`**: you give the
     datacenter, a new name, and either **clone** version, uplink count,
     uplink names and MTU from an existing switch in this vCenter, or
     enter them (blank is vCenter's default; for the version, the newest
     this vCenter supports). For a migration switch at the source's VDS
     version (2.1), enter that version here.
4. **Names.** Distributed port group names must be unique per datacenter,
   across all switches. When a name already exists, the script asks for
   a prefix or suffix (or takes `-NamePrefix` / `-NameSuffix`); a port
   group that still clashes is skipped with the owning switch named.
   Keep the source names wherever you can: it makes the VM's network
   mapping in phase 5 obvious. Write any renamed port group into the
   mapping table.
5. Read the log. Per port group the script first checks the uplink names
   its teaming order uses against the target switch (a port group that
   inherits its uplink order from the switch has none of its own):
   - **Names present:** restored from the zip, vCenter's own backup.
   - **Names missing:** reported before anything is created, then the
     port group is **rebuilt from the settings file** with the mapped
     names, in one step that either completes or creates nothing. The
     rebuild carries the complete configuration; in a lab test (vCenter
     9.1.1 and 9.0.2, both directions, and 8.0 U3 to 9.1.1) the rebuilt
     port groups were
     identical to the source on every field, including traffic shaping,
     fixed allocation, NetFlow and settings inherited from the switch
     ([README](https://github.com/pauldiee/VDSPortGroupManager#other-uplink-names-on-the-target-switch)).
   - **Zip from a newer vCenter:** a port group backup from vCenter 9.1.1
     can't be restored on 9.0.2 (*"Uncompress and Deserialize failed on
     backup config blob"*, lab-verified); the script then rebuilds from the
     settings file instead.
   - A NIOC network resource pool that the target switch doesn't have
     falls back to the default pool, with a warning.

To retry after a failure, run the import again and pick **only** the zips
that failed: port groups that are already there count as name clashes,
and the script would ask for a prefix or suffix for them.

**Check.** Every VDS row has its port group on the target switch, with
the VLAN from the mapping table, and the uplink order on the mapped
uplinks. To check the settings, export the target port groups again and
compare the `Summary` in the settings files with the source's.

### 2.5 A new switch: hosts and uplinks

Only for option B in 2.4. *"A freshly created VDS has no hosts attached;
add hosts before workloads can use the imported port groups"* (README).
In the vSphere Client (Networking, the switch, **Add and Manage Hosts**),
or with PowerCLI:

```powershell
$vds = Get-VDSwitch -Name '<new-switch>'
Add-VDSwitchVMHost -VDSwitch $vds -VMHost (Get-Cluster '<target-cluster>' | Get-VMHost)
# then per host: give the switch its physical uplinks
Add-VDSwitchPhysicalNetworkAdapter -DistributedSwitch $vds `
  -VMHostPhysicalNic (Get-VMHostNetworkAdapter -VMHost '<host>' -Physical -Name '<vmnicX>')
```

The physical NICs you give it must be free (not used by another switch)
and carry the VLANs of the port groups on the physical network.

**Check.** Every host in the target cluster is on the switch, with its
uplinks connected.

### 2.6 Standard switch port groups

A standard switch port group has no export in this toolkit. VMs can move
from a standard switch to a distributed one
([KB 344959](https://knowledge.broadcom.com/external/article/344959)), so
recreate each one as a distributed port group on the target switch, in
the vSphere Client or with `New-VDPortgroup`, with:

- the same **VLAN ID**;
- the **security** settings it needs (promiscuous mode, MAC address
  changes, forged transmits), for example for appliances that rely on
  them;
- **teaming and failover** that matches the target switch's uplinks.

**Check.** Every standard-switch row in the mapping table has a
distributed port group on the target with the same VLAN.

### 2.7 Undo

`-Mode Delete` on the **target** vCenter:

```powershell
.\Invoke-VDSPortGroupManager.ps1 -vCenterServer <target-vcenter> -Mode Delete
```

Pick the switch and the port groups. Port groups still in use by VMs are
flagged (vCenter refuses to delete them), the script offers a safety
export first, and it asks for a typed `YES`. A switch the script created
in 2.4 is removed in the vSphere Client once it's empty.

**Check for step 2.** Every VDS and standard-switch row in the mapping
table has its port group on a target switch that every host in the
cluster is connected to, with the VLAN from the mapping table.

---

## Step 3: NSX segments and segment profiles

**Only for networks that are not extended by HCX.** For those, see
[Networks that HCX extends](#networks-that-hcx-extends) at the end of this
step.

**Toolkit:** [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration).
Works against NSX 4.x and 9.x; it tries both API path formats and uses
the one that answers (README).

**Export from the source NSX Manager:**

```powershell
.\Export-NSXSegments.ps1 -NSXManager <source-nsx> -OutputBase <working-folder>\segments\export
```

Select the segments from the menu. You get two files: a `.json` with the
full objects, and a `.csv` with a name-mapping table. The export includes
all custom segment profiles (QoS, SpoofGuard, IP Discovery, MAC
Discovery, Segment Security) and each segment's profile bindings.

**Edit the CSV** where a name changes on the target: fill in `NewName`
for a segment, a segment profile, or a Tier-1 gateway whose id is
different on the target. Leave `NewName` equal to `OldName` to keep a
name.

**Dry run, then import into the target NSX Manager:**

```powershell
.\Import-NSXSegments.ps1 -NSXManager <target-nsx> -InputPath <working-folder>\segments\export.json -WhatIf
.\Import-NSXSegments.ps1 -NSXManager <target-nsx> -InputPath <working-folder>\segments\export.json
```

The import asks for a **transport zone** on the target (or takes
`-TransportZoneId`), then imports profiles, segments and bindings in that
order. For an **overlay** transport zone, the script checks each segment
for a gateway connection (`connectivity_path`, a Tier-0 or Tier-1) and a
subnet with the gateway address, and asks for any that are missing before
it starts. Pressing Enter at the gateway prompt leaves the segment
*"disconnected"*; NSX accepts that (`Import-NSXSegments.ps1`). A segment
that had a Tier-1 on the source keeps it: the script maps it to the
target Tier-1 from the CSV. VLAN segments skip the check.

**Overlay subnets that keep their IP addresses without HCX.** Don't give
these a gateway on the target yet: the old Tier-1 still has it, and a
second, connected segment with the same subnet can be advertised from
both NSX environments at once. Import them with **Connectivity None**: run
the import for those segments with `-Disconnected`. The script removes
`connectivity_path` before the import, keeps the subnets and skips the
gateway prompt. Select only those segments in the menu, and import the
rest in a separate run without the switch.

```powershell
.\Import-NSXSegments.ps1 -NSXManager <target-nsx> -InputPath <working-folder>\segments\export.json -Disconnected -WhatIf
.\Import-NSXSegments.ps1 -NSXManager <target-nsx> -InputPath <working-folder>\segments\export.json -Disconnected
```

NSX allows that
(*"If a segment is not connected to a gateway, subnet is optional"*) and
lets you connect the segment to a Tier-1 later (*"you can change the
connectivity of segment from "None" to a tier-0 or tier-1 gateway"*,
[Create an NSX Segment](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/segments/add-an-nsx-segment.html)).
The import ends with a table of these segments: the gateway each one
connects to at the cutover (the source gateway, with a Tier-1 renamed
per the CSV) and its subnets. Write the gateway IP and the target Tier-1
in the mapping table; the connection is made at the cutover
([docs/35, Networks on NSX overlay](35-cutover-and-clean-up.md#networks-on-nsx-overlay)).


**Undo.** `Remove-NSXSegments.ps1` on the target, with `-WhatIf` first.
It removes bindings, then segments, then profiles, flags segments with
attached ports, and asks for a typed `YES`.

**Check.** Every NSX row in the mapping table has its segment on the
target, in the right transport zone, with its profiles bound. The
segment is visible as a network on the target hosts that will run the
VMs.

### Networks that HCX extends

These you don't create in this step. Broadcom:
*"When you extend a network, a corresponding network is created at the
destination site."* You can extend *"Distributed Port Groups, NSX or VLAN
segments, or NSX VPC subnets"*
([VCF 9.0 HCX user guide, Extending Networks](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/extending-networks-using-vmware-hcx.html)).

What HCX asks for depends on the type of network on the target (same
page):

| Target network | You give |
| --- | --- |
| NSX VLAN | The destination VLAN ID; optionally the gateway IP address (when the source is a VDS port group or an NSX VLAN segment) |
| NSX overlay | The **Destination First Hop Router** (an NSX gateway) and *"the Gateway IP address and Prefix"*; optionally Mobility Optimized Networking (MON) |
| NSX VPC subnet | The VPC as first hop, the gateway IP address and prefix, and an access mode |

Two consequences for this phase:

- **Don't create the segment yourself first.** *"By default, VCF
  Operations HCX blocks attempts to extend the same subnet to the same
  Tier 1 router at the destination site."* A segment you made with
  nsx-segment-migration for the same subnet on that Tier-1 stands in the
  way. HCX has an option to allow overlapping subnets; you don't need it
  if you leave the segment to HCX.
- **The extension is done when HCX is set up**, not in this phase. In the
  mapping table, mark these networks as route "HCX extend". They get their
  target network during the HCX setup (the HCX page of this set, still to
  be written), before the first wave that needs them.

The gateway stays where it is until the cutover: one subnet, one gateway
(see [Before you start](#before-you-start)). MON changes that for the
VMs you select: *"You can select Mobility Optimized Networking (MON) for
all workloads that require routing through the local gateway at the
target site."* MON *"is not supported when extending networks to VLAN
segments or VPC subnets"*.

**Check.** Every "HCX extend" row in the mapping table has the target
type, first hop and gateway/prefix written down, so the extension can be
set up in one go.

---

## Step 4: the NSX distributed firewall

**Toolkit:** the [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit)
by Jeroen Buren, described in his posts
([part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/),
[part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/),
[part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/)).
It was written for an NSX 4 source and an NSX 9 target. The scripts are
newer than the posts: where they differ, this page follows the script
help (`Get-Help .\<script>.ps1 -Full`), read on 2026-11-13.

**Why this step takes the most time.** It's usually the hardest part of
the whole migration. *"A firewall rule references security groups. A
security group may contain other security groups. A service group
references individual services"*, and *"If you try to import a group
before the group it references has been created, you get a 404"*
(part 1). On top of that come IDs from the NSX-V era, rules nobody
remembers the reason for, and tags that silently decide group
membership. So:

- **Rehearse it first.** Run 4.2 to 4.7 against a lab or an empty
  target, wipe it (4.10), fix the export, and run it again. The author
  worked the same way: *"I found myself repeatedly importing, discovering
  a problem, rolling back, fixing the export, and trying again"*
  (part 1).
- **Involve the people who own the rules.** 4.4 is a decision about
  which rules go along, not a technical step. Plan a review session with
  the security or network team, and get their sign-off on the comparison
  report in 4.7.
- **Plan time for it** in the migration plan, separate from the network
  work in steps 2 and 3.

![Migrating the NSX distributed firewall step by step with Jeroen Buren's toolkit. Read-only: from the source NSX 4 Manager, 4.2 export to one CSV per object type, 4.3 sanitize to renamed IDs with _sanitized and _id_mapping files while keeping tags that groups use, 4.4 review in Excel with the rule owners and check service groups by hand, 4.5 dry run with WhatIf. Changes the target: 4.6 import into the target NSX 9 Manager, conflict action Skip first. Read-only: 4.7 compare source and target with the mapping files, HTML report as sign-off. Rehearse 4.2 to 4.7 against a lab or empty target and wipe it with 4.10 until the comparison is clean. Later: 4.8 after each HCX extension, re-point groups with an extended segment as member; 4.9 per wave in phase 5, import the VM tags or use HCX Replicate Security Tag. Gateway Firewall is not covered.](images/networks-firewall/dfw.png)

The walkthrough below goes through it in nine steps:

| | What | Script | Changes the target? |
| --- | --- | --- | --- |
| [4.1](#41-prepare) | Prepare | – | No |
| [4.2](#42-export-from-the-source) | Export from the source | `Export-NSX-DFW.ps1` | No |
| [4.3](#43-sanitize-the-export) | Sanitize the export | `Sanitize-NSX.ps1` | No |
| [4.4](#44-review-the-csv-files) | Review the CSV files | – | No |
| [4.5](#45-dry-run-the-import) | Dry run the import | `Import-NSX-DFW.ps1 -WhatIf` | No |
| [4.6](#46-import) | Import | `Import-NSX-DFW.ps1` | **Yes** |
| [4.7](#47-compare-source-and-target) | Compare source and target | `Compare-NSX-Migration.ps1` | No |
| [4.8](#48-groups-that-refer-to-hcx-extended-networks) | Groups that refer to HCX-extended networks | – | By hand |
| [4.9](#49-vm-tags-per-wave-phase-5) | VM tags, per wave (phase 5) | `Import-NSX-DFW.ps1 -ImportTags` | **Yes** |

Undo is at the end, in [4.10](#410-undo). With HCX network extension,
[The DFW with HCX-extended networks](#the-dfw-with-hcx-extended-networks-phase-by-phase)
puts the firewall work of both sides in order, phase by phase.

### 4.1 Prepare

1. **Timing.** Do this after step 3, so the segments exist on the target
   before the security groups that may refer to them, and **before the
   first VM moves**, so a VM is covered by its rules the moment it
   arrives.
2. **The target needs no NSX segments for the DFW.** The DFW also
   protects VMs on VDS port groups ("NSX on DVPGs"). For that, NSX creates
   *"A VLAN transport zone for each VDS"*, and *"These objects are
   system-generated and are not configurable or editable"*
   ([vDefend Firewall 9.0, Distributed Firewall for vSphere Distributed Switch](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-0/vdefend-distributed-firewall/distributed-security-for-vds.html);
   the transport zone's name is explained in
   [KB 393650](https://knowledge.broadcom.com/external/article/393650)).
   On a greenfield VCF 9.1.1 target this is active by default (field- and
   lab-verified 2026-11-12; no Broadcom page states the default).
3. **A Windows desktop.** The import opens a Windows file dialog for every
   CSV and stops without one (*"System.Windows.Forms is unavailable
   (non-Windows / no GUI)"*, script help). Download the scripts into one
   folder on that machine; they call each other.
4. **Accounts.** An NSX admin account on the source and the target NSX
   Manager. Every script asks for credentials when it starts
   (`Get-Credential`); nothing is stored.
5. **A folder per run** in your working folder, for example
   `<working-folder>\dfw`. Everything below writes into it.
6. **Logging.** The scripts take `-LogTarget Screen|File|Both` and
   `-LogFile <path>`. Use `Both` for the real runs, so you keep a record
   next to the exports. One exception: `Export-NSX-SystemObjects.ps1`
   (4.2) has no `-LogTarget`; its `-LogFile` writes a PowerShell
   transcript (script code).
7. **What's not covered.** *"The export script currently excludes Gateway
   Firewall policies, focusing only on DFW"* (part 1). List the gateway
   firewall rules separately and rebuild them on the target's gateways
   yourself.

**Check.** The scripts are on a Windows desktop that can reach both NSX
Managers on 443, and the run folder exists.

### 4.2 Export from the source

1. Run the export against the **source** NSX Manager. Every object type
   is off unless you switch it on (*"All export types are opt-in and
   default to $false"*, part 1), so name them all:

   ```powershell
   .\Export-NSX-DFW.ps1 -NSXManager <source-nsx> -OutputFolder <working-folder>\dfw `
     -ExportIPSets $true -ExportServices $true -ExportGroups $true `
     -ExportProfiles $true -ExportPolicies $true -ExportTags $true `
     -LogTarget Both -LogFile <working-folder>\dfw\export.log
   ```

2. Enter the source credentials when asked.
3. Look at what it wrote. One CSV per object type (script help and
   part 1):

   | File | Holds |
   | --- | --- |
   | `NSX_IPSets.csv` | IP sets / address groups |
   | `NSX_Services.csv` | Services |
   | `NSX_ServiceGroups.csv` | Service groups |
   | `NSX_Groups.csv` | Security groups |
   | `NSX_Profiles.csv` | Custom context profiles (system profiles are left out: they exist on every NSX) |
   | `NSX_Policies.csv` | DFW policies |
   | `NSX_Rules.csv` | DFW rules |
   | `NSX_VMTags.csv` | NSX tags on VMs |

   Every row has readable columns plus a `RawJson` column with the full
   object. The import uses only `RawJson`; the other columns are for you.
   The export already strips read-only fields such as `_create_time` and
   `_revision`, which would otherwise fail on the target (part 1).
4. **System objects: tags and descriptions.** The export above leaves out
   the system-owned services and groups (the built-in ones, such as
   HTTPS or DNS), because they exist on every NSX. Their objects
   *"cannot be created or deleted, but their 'tags' and 'description'
   fields can be modified by users"* (script help of
   `Export-NSX-SystemObjects.ps1`). Take those changes along with a
   second, read-only export:

   ```powershell
   .\Export-NSX-SystemObjects.ps1 -NSXManager <source-nsx> -OutputFolder <working-folder>\dfw\system `
     -LogFile <working-folder>\dfw\export-system.log
   ```

   It writes `NSX_SystemServices.csv` and `NSX_SystemGroups.csv`, and
   only for objects with tags or a description (`-OnlyModified`, on by
   default). No file means nobody changed a system object: nothing to do
   in 4.6.

**Check.** Every file is there, and the row counts look like the source
(for example, the number of policies in `NSX_Policies.csv` matches what
the NSX Manager UI shows under Security → Distributed Firewall). The
export changed nothing on the source.

### 4.3 Sanitize the export

Why: objects that date from NSX-V often have an ID like
*"securitygroup-223 or ipset-286"* while their name is something
readable. Imported as-is, the target ends up full of those IDs (part 1).
Sanitizing renames the IDs to the names and fixes every reference.

1. Run the orchestrator on the exported files:

   ```powershell
   .\Sanitize-NSX.ps1 -GroupsFile <working-folder>\dfw\NSX_Groups.csv `
     -ServicesFile <working-folder>\dfw\NSX_Services.csv `
     -RulesFile <working-folder>\dfw\NSX_Rules.csv `
     -PoliciesFile <working-folder>\dfw\NSX_Policies.csv `
     -ProfilesFile <working-folder>\dfw\NSX_Profiles.csv
   ```

2. What it does, in this order (script header and parts 1 to 3):
   - **Groups:** the ID becomes the display name, every `/groups/<old-id>`
     reference is rewritten. Characters NSX doesn't allow in an ID become
     a dash; two groups with the same name get `-1`, `-2` with a warning.
   - **Services and service groups:** the same, for `/services/<old-id>`.
   - **Rules and policies:** group and service references in source,
     destination and *applied to* are rewritten. Policy names lose the
     legacy suffix *":: NSX Service Composer – Firewall"*; names that
     become equal get `-1`, `-2` (part 3).
   - **Tags on the objects themselves** (groups, services, profiles) are
     removed as migration artefacts, **except** tags that a group's
     membership condition refers to: those are kept with a warning
     (`Get-NSXTagsInUse.ps1`). Removing such a tag would silently take an
     object out of a group, *"breaking firewall coverage with no API
     error"* (script header).
3. Look at the output: next to each input file a `_sanitized.csv`, and
   an `_id_mapping.csv` (old ID → new ID) per object type. **Keep the
   mapping files**: 4.7 needs them.
4. **Service groups: check them yourself.** The export writes service
   groups to their own file, `NSX_ServiceGroups.csv`, and a service
   group's members point at services by path (`/infra/services/<id>`).
   The script notes say to *"Process NSX_Services.csv before
   NSX_ServiceGroups.csv so that the full ID map is available when
   rewriting ServiceGroup member paths"*, but the orchestrator takes only
   one services file. If you have service groups, open
   `NSX_ServiceGroups.csv` and check that its members point at the
   **new** service IDs from `NSX_Services_id_mapping.csv`. If they don't,
   run `Sanitize-NSXServices.ps1` on that file too (see its help), or
   ask the author.
5. Read the console or log for warnings: duplicate names that got a
   suffix, and tags that were kept.

**Check.** You have a `_sanitized.csv` and an `_id_mapping.csv` for
groups, services, rules and policies, and you've read every warning.

### 4.4 Review the CSV files

This is the step where you decide what goes to the target.

1. Open each `_sanitized.csv` in Excel.
2. **Delete the rows of objects you don't want on the target**: test
   policies, rules for systems that won't move, groups nobody uses. The
   import skips what isn't in the file (part 1).
3. Watch for dependencies when you delete: a rule that stays needs its
   groups and services; a group that stays needs the groups it refers to.
4. Note any group whose membership is a **segment** that HCX will extend
   (route "HCX extend" in the mapping table). In the export such a member
   is a path to the **source** segment, and HCX creates a different
   network on the target. How to import those groups is in 4.8; decide
   it now, because it can change what goes in the import folder.
5. Save the files as CSV, keeping the `RawJson` column intact.
6. **Put the import set in its own folder**, `<working-folder>\dfw\import`,
   under the **standard names**: `NSX_Groups_sanitized.csv` becomes
   `NSX_Groups.csv` there, and so on for every type, plus
   `NSX_ServiceGroups.csv` (checked in 4.3) and `NSX_VMTags.csv`. Why:
   the undo in 4.10 reads the files by those fixed names from the folder
   you give it and deletes by ID (script code). Pointed at the raw export,
   it looks for the old IDs and finds nothing of what the import created.

**Check.** Every row that's left is something you want on the target,
nothing that's left refers to something you deleted, and
`dfw\import` holds one file per type under its standard name.

### 4.5 Dry run the import

1. Run the import against the **target** NSX Manager with `-WhatIf`,
   with every object type except the VM tags:

   ```powershell
   .\Import-NSX-DFW.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw\import `
     -ImportIPSets $true -ImportServices $true -ImportServiceGroups $true `
     -ImportGroups $true -ImportProfiles $true -ImportPolicies $true -WhatIf `
     -LogTarget Both -LogFile <working-folder>\dfw\import-whatif.log
   ```

2. A file dialog opens for each object type, in the import folder. Pick
   the file of that type there; they are your reviewed, sanitized files.
3. Read what it would do. The import runs in dependency order: IP sets,
   services and service groups, security groups, context profiles, then
   policies and rules (script help). Objects that already exist on the
   target show up as conflicts.

**Check.** No errors, and the number of objects it would create matches
what you kept in 4.4.

### 4.6 Import

1. Run the same command **without** `-WhatIf`, and pick the same files.
2. Leave `-ConflictAction` at its default, `Skip`: objects that already
   exist on the target are left alone with a warning. The other choices
   are `Overwrite`, `Prompt` (ask per object) and `Abort`. The author
   runs *"with Skip first to get a baseline inventory, then with Overwrite
   once I'm satisfied the data is correct"* (part 1).
3. Read the log. Every object is either created, skipped as a conflict,
   or failed with the NSX API's error.
4. Fix the cause of any failure (often a reference to something you
   deleted in 4.4), then run the import again: what's already there is
   skipped.
5. **System objects**, only if 4.2 wrote `NSX_SystemServices.csv` or
   `NSX_SystemGroups.csv`. The script only updates *"tags"* and
   *"description"* on the system objects that already exist on the
   target; both types are off unless you switch them on (script help):

   ```powershell
   .\Import-NSX-SystemObjects.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw\system `
     -ImportServices $true -ImportGroups $true -WhatIf `
     -LogTarget Both -LogFile <working-folder>\dfw\import-system.log
   ```

   Then run it without `-WhatIf`. An object that doesn't exist on the
   target is logged as NOT FOUND (*"different NSX version?"*, script
   code). The undo in 4.10 doesn't take these changes back.

**Check.** The log shows no failures, and in the NSX Manager UI of the
target the policies appear in the right order under Security →
Distributed Firewall.

### 4.7 Compare source and target

1. Run the comparison, with the mapping files from 4.3 so it can match
   renamed objects:

   ```powershell
   .\Compare-NSX-Migration.ps1 -SourceNSX <source-nsx> -DestNSX <target-nsx> `
     -CompareIPSets $true `
     -GroupMappingFile <working-folder>\dfw\NSX_Groups_id_mapping.csv `
     -ServiceMappingFile <working-folder>\dfw\NSX_Services_id_mapping.csv `
     -PolicyMappingFile <working-folder>\dfw\NSX_Policies_id_mapping.csv `
     -RuleMappingFile <working-folder>\dfw\NSX_Rules_id_mapping.csv `
     -OutputFolder <working-folder>\dfw\compare
   ```

   IP sets are off by default in the comparison (`-CompareIPSets`
   defaults to `$false`); the other types are on.
2. Each object gets one of these results (script help):

   | Result | Meaning | What you do |
   | --- | --- | --- |
   | MATCH | On both sides, key fields agree | Nothing |
   | MISMATCH | On both sides, key fields differ | Look at the difference; fix it, or explain it |
   | MISSING_DST | On the source, not on the target | Expected only for rows you deleted in 4.4 |
   | MISSING_SRC | On the target, not on the source | Expected only for things you created on purpose |

3. Groups that are logically the same but built differently (*"same
   conditions split across different criteria blocks"*) can be listed in
   a text file passed as `-GroupReviewList`; they then show as REVIEW and
   don't count as mismatches.
4. The output folder gets an HTML report and a CSV. The HTML report is
   meant to be shown to the customer (script help).

**Check.** Overall status PASSED, or every finding explained in writing.
Keep the HTML report with the exports: it's the sign-off for this step.

### 4.8 Groups that refer to HCX-extended networks

A security group with a segment as member refers to that segment by its
path. A network that HCX extends only exists on the target after the
extension (see [Networks that HCX extends](#networks-that-hcx-extends)),
under a name HCX chooses. The export still holds the path of the
**source** segment, which the target doesn't have, and NSX 9 refuses
that group: a PATCH like the import's returns *"The path=[...] is
invalid"* (error 500012), and a rule that uses the missing group then
fails with *"could not be found"* (lab-verified on NSX 9.1.1,
2026-11-18). The import logs both as failed and carries on (script
code), so the rest of the import is not held up. A rule's *applied to* can't point at
a segment directly: NSX 9.1.1 answers *"Valid values are groups or
labels pointing to groups"* (same test), so groups are the only place to
correct. This page doesn't yet confirm what HCX names the network on
the target.

So, for the groups you noted in 4.4:

1. **Extend first, where you can.** HCX is paired in phase 1, so the
   networks marked "HCX extend" can be extended in phase 3, before the
   DFW import (4.5). The target network then exists when the groups
   arrive.
2. **Look up the network HCX created** in the target NSX Manager, and its
   path.
3. **Correct the path before the import.** In `NSX_Groups.csv` in the
   import folder, replace the source segment's ID with the new one in the
   `RawJson` column. Check first that the old ID occurs nowhere else.
4. **A network that can only be extended later:** keep its groups, and
   the rules that use them, out of the first import, in a second import
   folder under the standard names. Correct the path and import that
   folder after the extension. The undo (4.10) then also runs per
   folder.
5. Run the comparison (4.7) again. Expect these groups as MISMATCH,
   because the member path differs from the source on purpose; write
   that down with the sign-off.

**Check.** The import log shows no failed groups or rules, and every
group with an extended segment as member points at the network HCX
created.

### 4.9 VM tags, per wave (phase 5)

NSX tags are what puts a VM into a tag-based security group. They can
only be set on VMs that are on the target already: the import
*"verifies that the VM's external ID (the vCenter UUID) exists in the
destination NSX fabric inventory. If it doesn't, the VM is skipped with a
warning."* (part 1).

So this is not phase 3 work. Per wave in phase 5:

**With HCX:** tick **Replicate Security Tag** in the Mobility Group, per
group or per VM: it *"Replicates tags that are associated with a virtual
machine undergoing migration"*
([docs/33, what HCX carries over](33-migrating-with-hcx.md)). The tags
then arrive with the VM, and you only check them. For a VM where they
didn't arrive, use the import below.

**Without HCX**, or as the fallback, after each wave:

1. run the import with only the tags:

   ```powershell
   .\Import-NSX-DFW.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw\import `
     -ImportTags $true -LogTarget Both -LogFile <working-folder>\dfw\tags-wave-<n>.log
   ```

   (with `-WhatIf` first), and pick `NSX_VMTags.csv`;
2. check the warnings: VMs of later waves are skipped, which is expected.

**Check.** Every VM of the wave carries its NSX tags on the target and is
a member of the groups it was in on the source.

**While an application is split across both sides.** A wave is meant to
be a whole application, but a large one, or one whose database moves
separately, can run partly on the source and partly on the target for a
while. Each side then has its own DFW, and a tag-based group only holds
VMs from its own NSX: tags are set on VMs in that NSX's inventory (the
import above skips VMs that aren't there), and the source NSX doesn't
know the VMs that left. A rule that allows one tier to reach another by
tag then misses the half on the other side, in both NSX environments.
For as long as the application is split:

1. **Before the wave**, list the application's flows between the VMs that
   move and the VMs that stay (the rules that use its groups).
2. **Add the IP addresses of the other side** to those groups, as an IP
   set, on both sides: on the target, the IPs of the VMs still on the
   source; on the source, the IPs of the VMs that left. With kept IP
   addresses that's the same list as before the move.
3. **Test the flows** right after the wave, with the application owner,
   as part of the wave's sign-off.
4. **When the last VM of the application has moved**, take the IP sets
   out of the target groups, so the rules work on tags again, and check
   once more that the application works. The source rules go with the
   source.

**Check.** No application spans both sides with rules that only match on
tags; every IP set added for a split application is written down with the
wave that removes it.

### The DFW with HCX-extended networks, phase by phase

With HCX network extension, the firewall work is spread over four phases
and two NSX environments. This overview puts the pieces from 4.1 to 4.9,
[docs/33](33-migrating-with-hcx.md) and
[docs/35](35-cutover-and-clean-up.md) in order.

![The DFW with HCX-extended networks, phase by phase, in three lanes. HCX: phase 1 deploy, pair and build the Service Mesh; phase 3 extend the networks marked HCX extend, HCX creates the target network; phase 4 diagnostics, Transport Analytics and a test VM there and back; phase 5 per wave, Replicate Security Tag on in the Mobility Group so NSX tags go with the VM; phase 6 per network, unextend with Connect cloud network. Target DFW: phase 3, steps 4.2 to 4.7, groups with an extended segment pointed at the HCX network (4.8), optionally dummy VMs carrying every tag; phase 4, the test VM has its tags and groups and the expected rules hit; phase 5, check tags and groups per VM, and for a split application an IP set with the VMs still on the source; phase 6, check the groups of the network, take the IP sets out after the last VM of a split application, remove the dummy VMs. Source DFW: keeps running unchanged, the export only reads it; in phase 5 a split application gets an IP set with the VMs that left; the rules retire with the source.](images/networks-firewall/dfw-hcx.png)

| Phase | HCX | Target DFW | Source DFW |
| --- | --- | --- | --- |
| 1 | Deploy, pair, Service Mesh | – | Unchanged |
| 3 | Extend the "HCX extend" networks | 4.2 to 4.7; groups with an extended segment point at HCX's network (4.8); optionally dummy VMs (below) | Unchanged; the export only reads it |
| 4 | Diagnostics, Transport Analytics, test VM there and back | The test VM has its tags and groups, the expected rules hit ([docs/34](34-prove-the-path.md)) | Unchanged |
| 5, per wave | Replicate Security Tag in the Mobility Group (4.9) | Check tags and groups per VM; split application: IP set of the VMs still on the source (4.9) | Split application: IP set of the VMs that left (4.9) |
| 6, per network | Unextend with Connect cloud network ([docs/35](35-cutover-and-clean-up.md)) | Check the groups of the network (4.8); IP sets out after the last VM of a split application; remove the dummy VMs | Retires with the source |

**Optional: groups with members before the first wave.** On the target,
tag-based groups stay empty until the first VMs arrive with their tags.
`Seed-NSX-DFW-Dummy-VMs.ps1` creates small powered-off dummy VMs on the
target and gives them every NSX tag from `NSX_VMTags.csv`, *"so that NSX
DFW tag-based groups are populated before real VMs are migrated"*
(script help). That lets you see in phase 3 or 4 that every tag-based
group picks up members, before a real VM depends on it.

- One dummy VM per 30 tags: *"NSX enforces a hard limit of 30 tags per
  VM"*, and a tag used by many VMs still needs only one dummy VM (script
  help).
- It needs the target vCenter as well as the target NSX Manager, and
  PowerCLI (the script loads `VMware.VimAutomation.Core`). Without a
  template (`-TemplateVM`) it builds a VM with no disks, 1 vCPU and 4 MB
  of memory.
- Dry run first; it supports `-WhatIf`. The file is called
  `Seed-NSX-DFW-Dummy-VMs.ps1`, while the examples in its help say
  `Seed-NSX-DFW-DummyVMs.ps1`.

  ```powershell
  .\Seed-NSX-DFW-Dummy-VMs.ps1 -NSXManager <target-nsx> -VCenter <target-vcenter> `
    -TagsCsv <working-folder>\dfw\import\NSX_VMTags.csv `
    -Datacenter <datacenter> -Cluster <cluster> -Datastore <datastore> -WhatIf `
    -LogTarget Both -LogFile <working-folder>\dfw\seed.log
  ```

- While they exist, the dummy VMs are members of every tag-based group.
  Remove them from vCenter when the real VMs carry their tags (script
  notes); at the latest in phase 6.

### 4.10 Undo

![Undoing a DFW import. The import creates IP sets, services, service groups, security groups, context profiles, then policies and rules. The targeted undo deletes in the reverse order: rules, policies, security groups, service groups, services, IP sets; context profiles are not removed. Targeted undo with Remove-NSX-ImportedObjects.ps1 reads the CSV files by their standard names from the input folder and deletes by ID, so point it at the import folder from 4.4; the raw export has the old IDs. ClearVMTags empties the tags on the VMs in NSX_VMTags.csv; objects already gone are logged as NOT FOUND. Full wipe with Remove-NSX-AllCustomObjects.ps1 needs no CSV files, deletes every custom DFW object including context profiles, never touches system-owned objects, and is only for a target with nothing else on it, never the source. Both: WhatIf first, both ask for confirmation.](images/networks-firewall/dfw-undo.png)

There are two ways back. Pick the one that fits, and run it with
`-WhatIf` first: both scripts list what they would delete and ask for
confirmation before they do.

**Targeted: remove what the import created.**
`Remove-NSX-ImportedObjects.ps1` deletes the objects listed in the CSV
files, in the reverse order of the import: *"1. DFW Rules 2. DFW Policies
3. Security Groups 4. Service Groups 5. Services 6. IP Sets"* (script
help). Use this when the target already had other DFW content, or when
only part of the import has to go.

1. Point it at the **import folder** from 4.4. It reads `NSX_Policies.csv`,
   `NSX_Rules.csv`, `NSX_Groups.csv` and so on by those names and deletes
   by the IDs in them (script code), so it has to see the same files the
   import used.
2. Dry run:

   ```powershell
   .\Remove-NSX-ImportedObjects.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw\import `
     -RemovePolicies $true -RemoveGroups $true -RemoveServiceGroups $true `
     -RemoveServices $true -RemoveIPSets $true -WhatIf
   ```

3. Run it without `-WhatIf`. Objects that are already gone are logged as
   NOT FOUND and skipped.
4. What it leaves alone (also the full wipe below): tags and
   descriptions put on system objects in 4.6, and the dummy VMs of the
   seed script, which you delete in vCenter. And two more:
   - **Context profiles:** the script has no switch for them. Remove
     imported context profiles in the NSX Manager UI, or use the full
     wipe below.
   - **VM tags** are not deleted; `-ClearVMTags $true` empties the tags on
     the VMs listed in `NSX_VMTags.csv`. *"VM tags are not deleted but can
     be cleared (set to empty)"* (script help).

**Full wipe: start the target over.** `Remove-NSX-AllCustomObjects.ps1`
needs no CSV files. It *"Removes all custom (non-system-owned) NSX DFW
objects directly from inventory"*, context profiles included, and
*"System-owned objects are never touched by this script"* (script help). This is the
rehearsal reset from the start of step 4.

1. **Only** on a target that has no other DFW content yet, and **never**
   on the source: it doesn't know which objects came from the import.
2. Dry run, with the object types you want gone:

   ```powershell
   .\Remove-NSX-AllCustomObjects.ps1 -NSXManager <target-nsx> `
     -RemovePolicies $true -RemoveGroups $true -RemoveServiceGroups $true `
     -RemoveServices $true -RemoveIPSets $true -RemoveProfiles $true -WhatIf
   ```

3. Run it without `-WhatIf`.
4. With `-ClearVMTags $true` it asks for a tag scope filter (for example
   `env`) so unrelated tags stay; without a filter it clears all tags and
   asks for an explicit `YES` first (part 1).

**Check.** After a targeted undo, the comparison (4.7) shows the undone
objects as missing on the destination and nothing else changed. After a
full wipe, the target has no custom DFW objects left, and you can run
4.5 again.

---

## Step 5: services on the NSX gateways

**Only when the source uses NSX gateways.** A subnet on an NSX overlay
segment often needs more from its source Tier-1 or Tier-0 than routing:
NAT, a load balancer VIP, DHCP, a DNS forwarder, an IPsec or L2 VPN, the
gateway firewall. These live on the gateway, not on the segment. Step 3
carries the segments and the DFW toolkit carries the distributed firewall
(*"The export script currently excludes Gateway Firewall policies"*,
[part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/));
neither carries the gateway services. If the subnet's routing moves at the
cutover and its services don't, the application works only half.

### 5.1 List them, per gateway and per subnet

On the **source** NSX Manager, for every Tier-1 and Tier-0 that a segment
in the mapping table connects to:

| Service | What to write down |
| --- | --- |
| NAT | Every rule: action (SNAT, DNAT, reflexive, no-SNAT, no-DNAT), source, destination, translated IP and port, the gateway, *Apply To*, firewall setting, priority |
| Load balancer | Every virtual server (VIP and port), its pool members, monitors, profiles and certificates, and the Tier-1 the LB service is attached to |
| DHCP | Per segment: the DHCP type (segment DHCP server, gateway DHCP server or DHCP relay), the DHCP profile, ranges, static bindings, options, lease time; for relay, the DHCP servers it relays to |
| DNS forwarder | **Networking**, **IP Management**, **DNS**: the gateway, the listener IP, the default zone and the FQDN zones with their DNS servers |
| IPsec VPN, L2 VPN | Per VPN service: the gateway, local endpoint IPs, sessions, peers, profiles, and for L2 VPN the segments in each session |
| Gateway firewall | The gateway policies and rules per gateway |
| Route advertisement | Per Tier-1, which types are advertised besides the connected segments: *"All NAT IP's"*, *"All DNS Forwarder Routes"*, *"All LB VIP Routes"*, *"All LB SNAT IP Routes"*, *"All IPSec Local Endpoints"* |

Then link each service to the subnets that use it, in the mapping table.
A NAT rule, a VIP or a DNS forwarder serves clients on certain subnets;
it has to move in the cutover window of the subnet it belongs to, or stay
on the source until the last subnet that needs it has moved. A service
that serves subnets in different waves is a planning decision for phase 0.

Sources for the field names and the route advertisement types:
[Configure an NSX NAT](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation/configure-an-nsx-nat.html),
[Add an NSX DNS Forwarder Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/ip-address-management-ipam/add-an-nsx-dns-forwarder-service.html),
[Configure NSX DHCP Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/nsx-dhcp-policy-ui/configure-nsx-dhcp-service.html),
[Add an NSX Tier-1 Gateway](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-1-gateways/add-an-nsx-tier-1-gateway.html).

### 5.2 Where each one lands on the target

First the gateway itself. A target Tier-1 that only routes may have no
NSX Edge cluster. To run services it needs one: *"Select an NSX Edge
cluster if you want this tier-1 gateway to host stateful services such as
NAT, load balancer, or firewall"*, and then *"a service router will always
be created (even if you do not configure stateful services), affecting the
north/south traffic pattern"*
([Add an NSX Tier-1 Gateway](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-1-gateways/add-an-nsx-tier-1-gateway.html)).
The gateway's HA mode limits what it can run, see the table. If the target
uses VPCs instead of Tier-1 gateways, where each service goes is a design
question; see the
[VCF 9 deployment planning guide](https://vcf-planning.hollebollevsan.nl/).

| Service | On the target | Watch out |
| --- | --- | --- |
| NAT | NAT rules on the target Tier-1 or Tier-0 | SNAT and DNAT: *"Supported on tier-0/tier-1 gateways running in active-standby mode"*, and *"Stateful NAT services are supported when using Stateful Active-Active HA mode"*. A Tier-0 in plain active-active only offers *Reflexive* ([NAT](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation.html), [Configure an NSX NAT](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation/configure-an-nsx-nat.html)) |
| Load balancer | Usually **Avi Load Balancer**, not the NSX load balancer | From VCF 9.0, *"General purpose load balancing features are no longer part of the VCF entitlement"*; the NSX load balancer is supported only for VCF appliances and Layer 4 for vSphere Supervisor ([KB 401492](https://knowledge.broadcom.com/external/article/401492)). Existing NSX LB use on VCF 9.0/9.1 may continue *"until May 30, 2027, provided they have secured the equivalent Avi licenses"*, and Broadcom points to the vDefend and Avi Conversion Tool (vACT) for the move ([KB 439411](https://knowledge.broadcom.com/external/article/439411)). Decide this in phase 0: it's a licence and a design question |
| DHCP | The same DHCP type on the target segment, with a DHCP profile on the target | nsx-segment-migration copies the segment as it is, including its DHCP fields, but doesn't create DHCP profiles: create the profile on the target first and check the segment's DHCP profile reference in the export. The target is a different NSX, so it starts without the source's leases; keep the ranges and static bindings the same |
| DNS forwarder | A DNS service on the target Tier-1 or Tier-0 with the **same listener IP** | VMs send their queries to that IP. Create it with **Admin Status** off and turn it on in the cutover window ([Add an NSX DNS Forwarder Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/ip-address-management-ipam/add-an-nsx-dns-forwarder-service.html)) |
| IPsec VPN, L2 VPN | A VPN service on a target gateway in **active-standby** | IPsec VPN and L2 VPN are on the list of services that a stateful active-active gateway does not support ([Stateful Services on Tier-0 and Tier-1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-0-gateways/stateful-services-on-tier-0-and-tier-1-gateways.html)). On a Tier-0, *"the local endpoint IP address must be different from the Tier-0 gateway's uplink interface IP address"* ([Add Local Endpoints](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/virtual-private-network-vpn/add-local-endpoints.html)). The remote peer is configured against the source endpoint: agree with whoever runs the other side whether the endpoint IP moves or changes. L2 VPN needs a new peer code from the server side ([NSX VPN services](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/virtual-private-network-vpn/adding-nsx-vpn-services.html)) |
| Gateway firewall | Gateway policies on the target gateway, rebuilt by hand | The DFW toolkit leaves them out (above). On the target it's a vDefend feature: *VMware vDefend Gateway Firewall* is one of the vDefend component keys ([KB 424676](https://knowledge.broadcom.com/external/article/424676)), and in NSX 9.1 *"vDefend features (including DFW) require the License Hub component for license management"* ([KB 446503](https://knowledge.broadcom.com/external/article/446503)). Check the target's licence before the first wave |

### 5.3 Build them ready, switch them on at the cutover

Services that own an IP address on the gateway are advertised like a
subnet: NAT IPs, LB VIPs, the DNS listener and IPsec local endpoints each
have their own route advertisement type on the Tier-1 (5.1). Built and
active on the target while the source still runs them, they would be
advertised from both NSX environments, the same problem as a subnet with
two gateways
([docs/35, Networks on NSX overlay](35-cutover-and-clean-up.md#networks-on-nsx-overlay)).
So:

- **Build them now, disabled**, where the object has a switch: a NAT rule
  has **Enabled**
  ([Configure an NSX NAT](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation/configure-an-nsx-nat.html)),
  a DNS service has **Admin Status**.
- **Otherwise prepare them from the list** and create them in the window.
- **Gateway firewall rules** carry no IP of their own: build them now, on
  the target gateway, so traffic is filtered from the moment the subnet
  arrives.
- Write each service in the cutover plan of its subnet: what to switch
  off on the source, what to switch on on the target
  ([docs/35, the cutover](35-cutover-and-clean-up.md#the-cutover)).

**Check.** Every gateway service from 5.1 has a target in the mapping
table, the target gateway has an NSX Edge cluster and an HA mode that
supports it, the load balancer route (NSX LB or Avi) and its licence are
decided, and the target's DHCP profiles exist.

---

## Phase 3 is done when

- [ ] Every network in use has a row in the mapping table, with a target
      and a route.
- [ ] Every recreated VDS port group exists on a switch that all target
      hosts in the cluster are connected to.
- [ ] Every recreated NSX segment exists in the right transport zone,
      with its profiles.
- [ ] Networks that HCX will extend are marked "HCX extend" with their
      target details, and have no hand-made segment on the target.
- [ ] No subnet has a gateway on both sides while HCX extends it.
- [ ] The DFW comparison shows nothing missing on the destination, and
      mismatches are explained.
- [ ] Every service on a source NSX gateway (NAT, load balancer, DHCP,
      DNS forwarder, VPN, gateway firewall) is listed with the subnets
      that use it, and has a place on the target (step 5).
- [ ] Gateway firewall rules are rebuilt on the target gateway; NAT rules
      and DNS services are built disabled or prepared for the window.
- [ ] Exports, mapping files and the comparison report are in the working
      folder.

Then go on with phase 4 in
[docs/29](29-side-by-side-migration.md#phase-4-prove-the-path).

---

## Sources

Checked on 2026-11-13.

- [KB 344959](https://knowledge.broadcom.com/external/article/344959):
  Cross vCenter Migration and Clone requirements in VMware vSphere 6.x and
  later
- VCF 9.0 HCX user guide:
  [Extending Networks](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/extending-networks-using-vmware-hcx.html)
- vDefend Firewall 9.0 TechDocs:
  [Distributed Firewall for vSphere Distributed Switch](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-0/vdefend-distributed-firewall/distributed-security-for-vds.html)
- [KB 393650](https://knowledge.broadcom.com/external/article/393650):
  clarification on the system-generated transport zone
- Jeroen Buren, configmgr.nl, 2026-03:
  [part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/),
  [part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/),
  [part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/),
  and the script help in his
  [repository](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit)
  (read 2026-11-13; `Export-/Import-NSX-SystemObjects.ps1` and
  `Seed-NSX-DFW-Dummy-VMs.ps1` read 2026-11-18, last toolkit change
  2026-04-24)
- Toolkit READMEs:
  [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) 1.4.0 (read 2026-11-16),
  [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration)
- PowerCLI cmdlet syntax (`Get-NetworkAdapter`, `Export-VDPortGroup`,
  `New-VDPortgroup -BackupPath`): VCF.PowerCLI 9.1.1
- Step 5, read on 2026-11-16: NSX administration guide for VCF 9.0,
  [Network Address Translation](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation.html),
  [Configure an NSX NAT](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/network-address-translation/configure-an-nsx-nat.html),
  [Stateful Services on Tier-0 and Tier-1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-0-gateways/stateful-services-on-tier-0-and-tier-1-gateways.html),
  [Add an NSX Tier-1 Gateway](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-1-gateways/add-an-nsx-tier-1-gateway.html),
  [Configure NSX DHCP Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/nsx-dhcp-policy-ui/configure-nsx-dhcp-service.html),
  [Add an NSX DNS Forwarder Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/ip-address-management-ipam/add-an-nsx-dns-forwarder-service.html),
  [NSX VPN services](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/virtual-private-network-vpn/adding-nsx-vpn-services.html),
  [Add Local Endpoints](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/virtual-private-network-vpn/add-local-endpoints.html);
  [KB 401492](https://knowledge.broadcom.com/external/article/401492)
  (NSX load balancer entitlement from VCF 9.0),
  [KB 439411](https://knowledge.broadcom.com/external/article/439411)
  (NSX LB to Avi, until 30 May 2027),
  [KB 424676](https://knowledge.broadcom.com/external/article/424676) and
  [KB 446503](https://knowledge.broadcom.com/external/article/446503)
  (vDefend keys, License Hub in NSX 9.1); nsx-segment-migration source
  (no DHCP profile handling)
