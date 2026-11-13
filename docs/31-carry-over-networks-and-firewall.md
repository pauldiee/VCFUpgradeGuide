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
- [Phase 3 is done when](#phase-3-is-done-when)
- [Sources](#sources)

---

## What goes where

![Carrying over the networks and the firewall. Step 1: a network mapping table, from the networks VMs actually use. Step 2: VDS port groups go from the source VDS to the target VDS with VDSPortGroupManager; clone the target switch's uplink names, and port group names must be unique per datacenter. Step 3: NSX segments and segment profiles go from the source NSX Manager to the target with nsx-segment-migration; pick the target transport zone, and overlay segments need a gateway and subnet. Networks that HCX extends are not recreated by hand. Step 4: the NSX distributed firewall goes with Jeroen Buren's NSX DFW toolkit: export, sanitize, review, import with WhatIf, import, compare; VM tags follow in phase 5.](images/networks-firewall/routes.png)

| Source | Route | Target | Toolkit |
| --- | --- | --- | --- |
| VDS port group | Recreate | VDS port group | [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) |
| Standard switch port group | Recreate as a VDS port group (step 2, by hand or from a template port group) | VDS port group | – |
| NSX segment (VLAN or overlay) | Recreate | NSX segment | [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration) |
| Any network whose VMs keep their IP addresses through HCX | Extend with HCX Network Extension | Extended network | HCX, see the HCX page of this set |
| NSX DFW: IP sets, services, groups, context profiles, policies and rules | Export, sanitize, import | NSX DFW | [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit) (Jeroen Buren) |
| NSX tags on VMs | Per wave, after the VM arrives | NSX tags | Same toolkit, or HCX *Migrate NSX Tags* (phase 5) |

---

## Before you start

**The route from phase 0.** Whether VMs keep their IP addresses, and how
(question 2 in [docs/29](29-side-by-side-migration.md#2-do-the-vms-keep-their-ip-addresses)),
decides what you build here:

- **Kept, with HCX:** the extended networks come from HCX Network
  Extension. Don't also build them by hand with their own gateway on the
  target: one subnet should have one gateway at a time.
- **Kept, without HCX:** the source VLANs must be trunked to the target
  hosts' uplinks, and you recreate the port groups or VLAN segments with
  the **same VLAN IDs**. The gateway stays on the physical network or the
  source until the cutover.
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

**Toolkit:** [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager).

**Export from the source.** Pick the source switch, then the port groups
(each entry shows its VLAN configuration and port count; uplink port
groups are left out):

```powershell
.\Invoke-VDSPortGroupManager.ps1 -vCenterServer <source-vcenter> -Mode Export -BackupDirectory <working-folder>\portgroups
```

Each port group becomes `<portgroup>.zip` in vCenter's own backup format
(`Export-VDPortGroup`). Port groups that NSX manages (segments shown on
the VDS, Supervisor and VPC networks) can't be exported this way; the
picker marks them `[NSX-backed]` and skips them. Those go across in
step 3.

**Import into the target:**

```powershell
.\Invoke-VDSPortGroupManager.ps1 -vCenterServer <target-vcenter> -Mode Import -BackupDirectory <working-folder>\portgroups
```

Pick the zips, then the target switch. Three things to know:

- **Uplink names.** An exported teaming policy refers to uplinks **by
  name**. VCF-built switches use `uplink1`, `uplink2`; a source switch
  with other names makes the import fail with *"activeUplinkPortName ...
  is not valid"* (VDSPortGroupManager README). Either import onto a switch
  with matching uplink names, or choose **Create a NEW VDS and import into
  it** and clone the uplink names from an existing switch.
- **Unique names.** Distributed port group names must be unique per
  datacenter, across all switches. On a clash the script asks for a
  prefix or suffix (`-NamePrefix`, `-NameSuffix`), and a port group that
  still clashes is skipped.
- **A new switch has no hosts.** If you let the script create a VDS, add
  the target hosts to it before VMs can use the port groups.

**VDS version.** If you plan live migrations without HCX, the target
switch's version matters (question 4 in
[docs/29](29-side-by-side-migration.md#4-which-vds-versions-are-on-both-sides)).

**Undo.** `-Mode Delete` on the target: it flags port groups in use,
offers a safety export first, and asks for a typed `YES`.

**Check.** Every VDS row in the mapping table has its port group on the
target, on a switch that every target host in the cluster is connected
to, with the VLAN from the mapping table.

---

## Step 3: NSX segments and segment profiles

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
order. For an **overlay** transport zone, every segment needs a gateway
connection (`connectivity_path`, a Tier-0 or Tier-1) and a subnet with the
gateway address; the script asks for any that are missing before it
starts. VLAN segments skip that check.

Overlay segments with a gateway on the target are exactly the case from
[Before you start](#before-you-start): if HCX extends the same subnet,
don't give it a second gateway on the target until the cutover.

**Undo.** `Remove-NSXSegments.ps1` on the target, with `-WhatIf` first.
It removes bindings, then segments, then profiles, flags segments with
attached ports, and asks for a typed `YES`.

**Check.** Every NSX row in the mapping table has its segment on the
target, in the right transport zone, with its profiles bound. The
segment is visible as a network on the target hosts that will run the
VMs.

---

## Step 4: the NSX distributed firewall

**Toolkit:** the [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit)
by Jeroen Buren, described in his posts
([part 1](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-the-right-way-a-powershell-toolkit/),
[part 2](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-2/),
[part 3](https://configmgr.nl/powershell/migrating-nsx-distributed-firewall-policies-part-3/)).
It was written for an NSX 4 source and an NSX 9 target. Read each
script's help (`Get-Help .\Import-NSX-DFW.ps1 -Full`) before you run it;
the scripts are newer than the posts.

**Do this after step 3**, so the segments exist on the target before the
security groups that may refer to them. And do it **before the first VM
moves**, so a VM is covered by its rules the moment it arrives.

**A DFW on the target doesn't need NSX segments.** The DFW also protects
VMs on VDS port groups ("NSX on DVPGs"). For that, NSX creates *"A VLAN
transport zone for each VDS"*, and *"These objects are system-generated
and are not configurable or editable"*
([vDefend Firewall 9.0, Distributed Firewall for vSphere Distributed Switch](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-0/vdefend-distributed-firewall/distributed-security-for-vds.html);
the transport zone's name is explained in
[KB 393650](https://knowledge.broadcom.com/external/article/393650)).
On a greenfield VCF 9.1.1 target this is active by default
(field- and lab-verified 2026-11-12; no Broadcom page states the default).

The pipeline, in order:

1. **Export from the source.** Every object type is off unless you switch
   it on (*"All export types are opt-in and default to $false"*, part 1):

   ```powershell
   .\Export-NSX-DFW.ps1 -NSXManager <source-nsx> -OutputFolder <working-folder>\dfw `
     -ExportIPSets $true -ExportServices $true -ExportGroups $true `
     -ExportProfiles $true -ExportPolicies $true -ExportTags $true
   ```

   One CSV per object type. Only the `RawJson` column is used by the
   import; the other columns are there for you to read.
2. **Sanitize.** `Sanitize-NSX.ps1` renames groups, services and policies
   whose ID differs from their name (typical for objects that date from
   NSX-V, such as *"securitygroup-223 or ipset-286"*) and updates every
   reference to them. It writes `_sanitized.csv` files and `_id_mapping.csv`
   files; keep the mapping files, step 6 needs them.

   ```powershell
   .\Sanitize-NSX.ps1 -GroupsFile <working-folder>\dfw\NSX_Groups.csv `
     -ServicesFile <working-folder>\dfw\NSX_Services.csv `
     -RulesFile <working-folder>\dfw\NSX_Rules.csv `
     -PoliciesFile <working-folder>\dfw\NSX_Policies.csv
   ```

   The import opens a file dialog for each object type you import (script
   help); pick the `_sanitized.csv` versions there.
3. **Review.** Open the CSVs. Delete the rows of objects you don't want
   on the target; the import skips what isn't there (part 1).
4. **Import with `-WhatIf`.** The import runs in dependency order: IP
   sets, services and service groups, security groups, context profiles,
   then policies and rules (script help). The VM tags wait until
   phase 5.

   ```powershell
   .\Import-NSX-DFW.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw `
     -ImportIPSets $true -ImportServices $true -ImportServiceGroups $true `
     -ImportGroups $true -ImportProfiles $true -ImportPolicies $true -WhatIf
   ```

5. **Import.** The same command without `-WhatIf`. Objects that already
   exist are skipped by default (`-ConflictAction Skip`); the author runs
   *"with Skip first to get a baseline inventory, then with Overwrite once
   I'm satisfied the data is correct"* (part 1).
6. **Compare.** `Compare-NSX-Migration.ps1 -SourceNSX <source-nsx>
   -DestNSX <target-nsx>`, with the mapping files from step 2
   (`-GroupMappingFile`, `-ServiceMappingFile`). It reports each object as
   match, mismatch, missing on the destination or extra on the
   destination, and writes an HTML report and a CSV.

Not covered by this toolkit: *"The export script currently excludes
Gateway Firewall policies, focusing only on DFW"* (part 1). Rebuild
gateway firewall rules on the target's gateways by hand, or with a tool
of your own.

**Undo.** `Remove-NSX-ImportedObjects.ps1` removes what an import created,
in reverse dependency order, using the same CSVs; run it with `-WhatIf`
first.

**Check.** The comparison report shows nothing missing on the
destination, and every mismatch has been explained. Policies and rules on
the target apply to the groups you expect (check a few in the NSX
Manager UI against the mapping table's DFW column).

---

## Phase 3 is done when

- [ ] Every network in use has a row in the mapping table, with a target
      and a route.
- [ ] Every recreated VDS port group exists on a switch that all target
      hosts in the cluster are connected to.
- [ ] Every recreated NSX segment exists in the right transport zone,
      with its profiles.
- [ ] No subnet has a gateway on both sides while HCX extends it.
- [ ] The DFW comparison shows nothing missing on the destination, and
      mismatches are explained.
- [ ] Gateway firewall rules, if any, are rebuilt or listed for later.
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
- Toolkit READMEs:
  [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) 1.1.2,
  [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration)
- PowerCLI cmdlet syntax (`Get-NetworkAdapter`, `Export-VDPortGroup`,
  `New-VDPortgroup -BackupPath`): VCF.PowerCLI 9.1.1
