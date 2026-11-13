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

![Carrying over the networks and the firewall. Step 1: a network mapping table, from the networks VMs actually use. Step 2: VDS port groups go from the source VDS to the target VDS with VDSPortGroupManager; clone the target switch's uplink names, and port group names must be unique per datacenter. Step 3: NSX segments and segment profiles go from the source NSX Manager to the target with nsx-segment-migration; pick the target transport zone, and overlay segments need a gateway and subnet. Networks that HCX extends are not recreated by hand: HCX creates them on the target when you extend them. Step 4: the NSX distributed firewall goes with Jeroen Buren's NSX DFW toolkit: export, sanitize, review, import with WhatIf, import, compare; VM tags follow in phase 5.](images/networks-firewall/routes.png)

| Source | Route | Target | Toolkit |
| --- | --- | --- | --- |
| VDS port group | Recreate | VDS port group | [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) |
| Standard switch port group | Recreate as a VDS port group (step 2, by hand or from a template port group) | VDS port group | – |
| NSX segment (VLAN or overlay) | Recreate | NSX segment | [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration) |
| Any network whose VMs keep their IP addresses through HCX | Extend with HCX Network Extension; HCX creates the target network | Extended network | HCX, see [Networks that HCX extends](#networks-that-hcx-extends) |
| NSX DFW: IP sets, services, groups, context profiles, policies and rules | Export, sanitize, import | NSX DFW | [NSX DFW migration toolkit](https://github.com/jeroenburen/Repository/tree/main/scripts/networking/nsx-migration-toolkit) (Jeroen Buren) |
| NSX tags on VMs | Per wave, after the VM arrives | NSX tags | Same toolkit, or HCX *Migrate NSX Tags* (phase 5) |

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
order. For an **overlay** transport zone, every segment needs a gateway
connection (`connectivity_path`, a Tier-0 or Tier-1) and a subnet with the
gateway address; the script asks for any that are missing before it
starts. VLAN segments skip that check.


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

![Migrating the NSX distributed firewall step by step with Jeroen Buren's toolkit. Read-only: from the source NSX 4 Manager, 4.2 export to one CSV per object type, 4.3 sanitize to renamed IDs with _sanitized and _id_mapping files while keeping tags that groups use, 4.4 review in Excel with the rule owners and check service groups by hand, 4.5 dry run with WhatIf. Changes the target: 4.6 import into the target NSX 9 Manager, conflict action Skip first. Read-only: 4.7 compare source and target with the mapping files, HTML report as sign-off. Rehearse 4.2 to 4.7 against a lab or empty target and wipe it with 4.10 until the comparison is clean. Later: 4.8 after each HCX extension, re-point groups with an extended segment as member; 4.9 per wave in phase 5, import the VM tags or use HCX Migrate NSX Tags. Gateway Firewall is not covered.](images/networks-firewall/dfw.png)

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

Undo is at the end, in [4.10](#410-undo).

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
6. **Logging.** Every script takes `-LogTarget Screen|File|Both` and
   `-LogFile <path>`. Use `Both` for the real runs, so you keep a record
   next to the exports.
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
   (route "HCX extend" in the mapping table). Those come back in 4.8.
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
and this page doesn't confirm what HCX names it.

1. Take the list from 4.4 (groups with an extended segment as member).
2. After each extension, open those groups on the target and point them
   at the network HCX created.
3. Run the comparison (4.7) again for groups.

**Check.** No group on the target refers to a segment that doesn't exist.

### 4.9 VM tags, per wave (phase 5)

NSX tags are what puts a VM into a tag-based security group. They can
only be set on VMs that are on the target already: the import
*"verifies that the VM's external ID (the vCenter UUID) exists in the
destination NSX fabric inventory. If it doesn't, the VM is skipped with a
warning."* (part 1).

So this is not phase 3 work: after each wave in phase 5,

1. run the import with only the tags:

   ```powershell
   .\Import-NSX-DFW.ps1 -NSXManager <target-nsx> -InputFolder <working-folder>\dfw\import `
     -ImportTags $true -LogTarget Both -LogFile <working-folder>\dfw\tags-wave-<n>.log
   ```

   (with `-WhatIf` first), and pick `NSX_VMTags.csv`;
2. check the warnings: VMs of later waves are skipped, which is expected;
3. or use HCX's **Migrate NSX Tags** option on the Mobility Group instead.

**Check.** Every VM of the wave carries its NSX tags on the target and is
a member of the groups it was in on the source.

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
4. Two things it leaves alone:
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
- Toolkit READMEs:
  [VDSPortGroupManager](https://github.com/pauldiee/VDSPortGroupManager) 1.1.2,
  [nsx-segment-migration](https://github.com/pauldiee/nsx-segment-migration)
- PowerCLI cmdlet syntax (`Get-NetworkAdapter`, `Export-VDPortGroup`,
  `New-VDPortgroup -BackupPath`): VCF.PowerCLI 9.1.1
