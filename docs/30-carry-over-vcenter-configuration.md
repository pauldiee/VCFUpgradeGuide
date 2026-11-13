# Carrying over the vCenter configuration

Phase 2 of a [side-by-side migration](29-side-by-side-migration.md), in
depth. Before the first VM moves to the new vCenter, the configuration
that VMs and people depend on has to exist there: roles, tag categories
and tags, custom attributes, storage policies, and folders with their
permissions. This page takes you through it step by step, with the
commands and a check after each step.

Facts on this page come from Broadcom KB articles, public blogs, the
toolkits' own documentation and code, and PowerCLI 13.5.1 (VCF.PowerCLI
9.1.1), checked on 2026-11-13. Each is linked where it's used.

---

## Contents

- [Before you start](#before-you-start)
- [The order, and why](#the-order-and-why)
- [Step 1: roles](#step-1-roles)
- [Step 2: tag categories and tags](#step-2-tag-categories-and-tags)
- [Step 3: custom attributes](#step-3-custom-attributes)
- [Step 4: storage policies](#step-4-storage-policies)
- [Step 5: folders and permissions](#step-5-folders-and-permissions)
- [Phase 2 is done when](#phase-2-is-done-when)
- [Sources](#sources)

---

## Before you start

**A workstation** that can reach both vCenters on 443, with:

- **PowerShell 7.4 or later.** Not Windows PowerShell 5.1, even though
  that's what Windows ships with. Broadcom:
  *"In VCF PowerCLI 9.x a requirement of PowerShell 7.0.13 + was
  introduced"*, and on 5.1 the tag cmdlets fail with *"Could not load file
  or assembly 'Newtonsoft. Json, Version=10.0.0.0'"*
  ([KB 409981](https://knowledge.broadcom.com/external/article/409981)).
  The [PowerCLI installation guide](https://developer.broadcom.com/powercli/installation-guide)
  adds: *"PowerShell 5.1 is being deprecated. [...] PowerShell 7.4 or later
  is officially supported and is our minimum recomended version for use."*
  Start the toolkits from `pwsh`, not from `powershell.exe`.
- VCF.PowerCLI 9.0 or later:
  `Install-Module -Name VCF.PowerCLI -Scope CurrentUser`.
- The toolkits: [VIRoleManager](https://github.com/pauldiee/VIRoleManager),
  [StoragePolicyManager](https://github.com/pauldiee/StoragePolicyManager)
  and [VIFolderManager](https://github.com/pauldiee/VIFolderManager).
  Download each as a zip or clone it.

**Accounts.** An administrator on both vCenters. The toolkits ask for
credentials once and save them as `<vCenter>.cred` next to the script. On
Windows the password is DPAPI-encrypted for the current user; on Linux
and macOS it is **not** encrypted (VIFolderManager README). Delete the
`.cred` files when the migration is done.

**The target's directory.** The users and groups that hold permissions
on the source must resolve on the target before step 5. Connect the
target to the same directory first (question 5 in
[docs/29](29-side-by-side-migration.md#5-where-do-the-users-and-groups-come-from-on-the-target)).

**One working folder** for the whole migration, kept outside both
vCenters. Every export lands there. It's your reference for the checks,
and your record of what the source looked like.

**Who made the toolkits.** VIRoleManager, StoragePolicyManager and
VIFolderManager, and the tags and custom attributes toolkit in
development, are written by Paul van Dieen, the author of this guide
([hollebollevsan.nl](https://www.hollebollevsan.nl)).

> **Use at your own risk.** These are community tools, not Broadcom
> products, and they come without support or warranty. Before you use one
> on a real environment, read its README, test it in a lab or against a
> non-production vCenter first, check every export file before you import
> it, use the dry run where the toolkit has one, and check the result
> yourself afterwards. You are responsible for what they change in your
> environment. The same goes for the PowerCLI examples on this page. Found
> a problem? Open an issue in the toolkit's GitHub repository.

**What has been tested.** The toolkits have been tested with vSphere 9
vCenters on both sides; VIFolderManager is still in test (lab-tested on
VCF 9.1.1 and 9.0.2). Exporting from an **older source vCenter** (7.x or
8.x) hasn't been tested yet. Open each export file and check that it
holds what you expect before you import it. Where a toolkit has a dry
run, use it first.

**Things all three toolkits do the same way:**

- **Running an import twice is safe.** Roles and storage policies that
  already exist are skipped; folders that exist are reused. So after a
  partial run or a fix, just run it again.
- **Self-signed certificates** (a lab, or a vCenter without a CA-signed
  certificate yet): add `-SkipCertificateValidation`. In production, fix
  the certificate trust instead.
- **Wrong or changed password:** add `-ResetCredentials` to be asked
  again.
- **Pickers** accept a number, a comma-separated list, or `all`
  (VIFolderManager also ranges like `2-6`).

---

## The order, and why

![Carrying over the vCenter configuration in five steps. Before you start: PowerShell 7.4 or later with VCF.PowerCLI 9, the target joined to the same directory, one working folder. Step 1, roles with VIRoleManager: in phase 2 custom roles created and skipped privileges reviewed; nothing per VM. Step 2, tag categories and tags with the tags and custom attributes toolkit in development: in phase 2 categories and tags with the same cardinality and entity types; in phase 5 export assignments before each wave and apply them after, because they don't follow the VM. Step 3, custom attributes, same toolkit: in phase 2 attribute names with the same target type; in phase 5 check that the values arrived. Step 4, storage policies with StoragePolicyManager: in phase 2 imported or mapped, skipped rules reviewed; in phase 5 check each VM against the policy mapping. Step 5, folders and permissions with VIFolderManager, still in test: in phase 2 folder trees and folder permissions without moving objects; in phase 5 an import with -MoveObjects puts arrived VMs in their folders. Folder permissions need the roles from step 1; tag-based storage policy rules need the tags from step 2.](images/vcenter-config/order.png)

| Step | What | Tool | Needs first |
| --- | --- | --- | --- |
| 1 | Roles | VIRoleManager | – |
| 2 | Tag categories and tags | PowerCLI (toolkit in development) | – |
| 3 | Custom attributes | PowerCLI (same toolkit, in development) | – |
| 4 | Storage policies | StoragePolicyManager | Step 2, for tag-based rules |
| 5 | Folders and permissions | VIFolderManager, PowerCLI | Step 1 and the target's directory |

Why before the VMs: per
[KB 344959](https://knowledge.broadcom.com/external/article/344959),
*"vCenter definitions that do not exist in the destination vCenter
(regardless of SSO), such as: vSphere Tags, Custom Attributes,
Permissions"* are not migrated with a VM, and VM storage policies
*"may or may not persist as the policy may or may not exist on the
target VC"*.

Tags are a special case: even when they exist on the target, the
**assignment** of a tag to a VM doesn't come along. See step 2.

---

## Step 1: roles

**Toolkit:** [VIRoleManager](https://github.com/pauldiee/VIRoleManager).

**Export from the source.** VIRoleManager lists the custom roles (system
roles are left out). Pick them by number, or `all`:

```powershell
.\Invoke-VIRoleManager.ps1 -vCenterServer <source-vcenter> -Mode Export -FilePath <working-folder>\roles
```

Each role becomes one JSON file with its name, description and privilege
IDs.

**Import into the target.** Point `-FilePath` at the folder; the script
lists the JSON files and you pick them:

```powershell
.\Invoke-VIRoleManager.ps1 -vCenterServer <target-vcenter> -Mode Import -FilePath <working-folder>\roles
```

What the import does:

- A role whose **name already exists** on the target is skipped with a
  warning. To import it anyway under another name, import that one file
  with `-NewRoleName`.
- **Privileges that don't exist on the target** are listed and skipped;
  the role is created with the rest. Read that list: a privilege that
  was renamed or removed in vSphere 9 may leave the role short of what it
  needs.
- The import copies only the privileges the role had on the source. It
  doesn't add privileges that newer vSphere versions introduced. Check
  each imported role against what its holders must be able to do on 9.x.

**On a vCenter 9.1.1 target**, a new custom role also gets a permission
on the vCenter root for a group `VSPHERE.LOCAL\vcf_reserved_<n>`. Leave
it alone. (Lab-verified on VCF 9.1.1, 2026-11-12; not on 9.0.2; no
Broadcom source found.)

**Undo.** To remove a role you imported by mistake:
`Remove-VIRole -Role (Get-VIRole -Name '<role>')`. On a 9.1.1 target this
reports the role as in use because of the `vcf_reserved` permission above
(lab-verified). `-Force` removes a role *"even if it is associated with a
permission"* (PowerCLI help); whether that is safe for the
`vcf_reserved` permission hasn't been tested, so try it in a lab first.

**Check.** Run this on both vCenters and compare the two files:

```powershell
Get-VIRole | Where-Object { -not $_.IsSystem } | Sort-Object Name | ForEach-Object {
  [PSCustomObject]@{ Role = $_.Name; Privileges = ($_.ExtensionData.Privilege | Sort-Object) -join ';' }
} | Export-Csv -Path <working-folder>\roles-<vcenter>.csv -NoTypeInformation
```

Every source role is on the target. Where the privilege lists differ, the
difference is the list the import reported, and you've decided per
privilege whether that's acceptable.

---

## Step 2: tag categories and tags

**Toolkit:** in development. Until then, PowerCLI as below, based on Jim
Millard's [Copy-vcTags.ps1 and Migrate-vcTags.ps1](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html).

There are two parts to tags, and they move at different times:

- **Categories and tags** (the definitions) go across now.
- **Tag assignments** (which object has which tag) are re-applied after
  each migration wave, in phase 5.

Why the split: Jim Millard found that *"when a VM is migrated from one
vCenter to another using cross-vCenter vMotion, the tags on the VM do not
get migrated with it even if the corresponding tags & categories are
present in the target vCenter"*, and that the assignments must be
captured before the VM moves, *"or that information is lost forever"*
([Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html),
Jim Millard, 2026-05).

A toolkit for tags and custom attributes together is being developed for
this set. Until it's available, use PowerCLI.

**Copy categories and tags.** Connected to both vCenters, this creates
every source category and tag that the target doesn't have yet. It's
the same approach as Jim Millard's `Copy-vcTags.ps1`. Try it against a
lab or a test vCenter first.

```powershell
$src = Connect-VIServer <source-vcenter>
$dst = Connect-VIServer <target-vcenter>

foreach ($cat in Get-TagCategory -Server $src) {
  if (-not (Get-TagCategory -Server $dst -Name $cat.Name -ErrorAction SilentlyContinue)) {
    New-TagCategory -Server $dst -Name $cat.Name -Description $cat.Description `
      -Cardinality $cat.Cardinality -EntityType $cat.EntityType
  }
}
foreach ($tag in Get-Tag -Server $src) {
  $dstCat = Get-TagCategory -Server $dst -Name $tag.Category.Name
  if (-not (Get-Tag -Server $dst -Category $dstCat -Name $tag.Name -ErrorAction SilentlyContinue)) {
    New-Tag -Server $dst -Name $tag.Name -Category $dstCat -Description $tag.Description
  }
}
```

`-Cardinality` is `Single` (one tag of this category per object) or
`Multiple`; `-EntityType` limits which object types the category can be
assigned to. Both are copied from the source, so a category behaves the
same on the target.

**Export the assignments now, as a baseline.** You'll export them again
right before each wave, but take this one now so you have the full
picture before anything moves:

```powershell
Get-TagAssignment -Server $src | Select-Object `
  @{N='Entity';E={$_.Entity.Name}}, @{N='EntityId';E={$_.Entity.Id}}, `
  @{N='Category';E={$_.Tag.Category.Name}}, @{N='Tag';E={$_.Tag.Name}} |
  Export-Csv -Path <working-folder>\tag-assignments-baseline.csv -NoTypeInformation
```

**Running it again** creates only what's still missing, so it's safe to
repeat. **Undo:** `Remove-Tag` and `Remove-TagCategory` on the target.

**Check.** `Get-TagCategory` and `Get-Tag` on both vCenters return the
same names, and each category has the same cardinality and entity types.

---

## Step 3: custom attributes

**Toolkit:** the tags and custom attributes toolkit, in development.
Until then, PowerCLI as below.

Custom attributes are the extra annotation fields on VMs and hosts.
[KB 344959](https://knowledge.broadcom.com/external/article/344959) lists
them among the definitions that aren't migrated when they *don't* exist
on the target, and among the metadata that *is* migrated when they do.
So create the attribute names on the target first.

Compare first; most environments have only a few:

```powershell
Get-CustomAttribute -Server $src | Select-Object Name, TargetType
Get-CustomAttribute -Server $dst | Select-Object Name, TargetType
```

Create each missing one on the target with the same name and target type,
for example:

```powershell
New-CustomAttribute -Server $dst -Name '<attribute-name>' -TargetType VirtualMachine
```

An attribute without a target type on the source is a global one; create
it with `-TargetType $null` (*"If the value is $null the custom attribute
is global and applies to all target types"*, PowerCLI help).

**Check.** Both lists match. After the test VM in phase 4, compare its
values with `Get-Annotation` on both sides.

---

## Step 4: storage policies

**Toolkit:** [StoragePolicyManager](https://github.com/pauldiee/StoragePolicyManager).

Tag-based policy rules refer to tags by category and name, so step 2
must be done first.

**Export from the source.** Pick the policies by number, or `all`:

```powershell
.\Invoke-StoragePolicyManager.ps1 -vCenterServer <source-vcenter> -Mode Export -FilePath <working-folder>\policies
```

**Import into the target:**

```powershell
.\Invoke-StoragePolicyManager.ps1 -vCenterServer <target-vcenter> -Mode Import -FilePath <working-folder>\policies
```

What the import does:

- A policy whose **name already exists** on the target is skipped with a
  warning. Expect this for the default policies that every vCenter has.
  Use `-NewPolicyName` (one file at a time) to import under another
  name.
- **Capability-based rules** (vSAN and others) are matched by capability
  ID; **tag-based rules** by category and tag name. A capability or tag
  that the target doesn't have is reported and skipped, and so is a rule
  type the script doesn't know.

Read every skipped item. A rule that was skipped makes the policy on the
target weaker than on the source, and a VM placed on it gets different
storage behaviour without any error.

**Undo:** `Remove-SpbmStoragePolicy -StoragePolicy (Get-SpbmStoragePolicy
-Name '<policy>')`, as long as no VM uses the policy yet. Then fix the
cause and import that file again.

**Check.** Every source policy that VMs use exists on the target, either
imported or deliberately replaced by a target policy. Write down that
mapping (source policy → target policy): in phase 5 you check each
migrated VM against it.

---

## Step 5: folders and permissions

**Toolkit:** [VIFolderManager](https://github.com/pauldiee/VIFolderManager) (still in test, so the dry run is not
optional). Other permissions: PowerCLI.

**Folders, without moving anything yet.** Export all four folder types
from the source:

```powershell
.\Invoke-VIFolderManager.ps1 -vCenterServer <source-vcenter> -Mode Export -FolderType VM,Host,Datastore,Network -BackupDirectory <working-folder>\folders
```

You pick the datacenters; each gets one JSON file. Folders that vCenter,
the Supervisor or NSX manage themselves (`vCLS`, `Namespaces`,
`NSX Managed Folders`, `Virtual Private Clouds`) are skipped.

Import into the target, first as a dry run. No objects are moved in this
phase: the VMs aren't there yet.

```powershell
.\Invoke-VIFolderManager.ps1 -vCenterServer <target-vcenter> -Mode Import -BackupDirectory <working-folder>\folders -MoveObjects:$false -ApplyPermissions -DryRun
```

Read the log, then run the same command without `-DryRun`. What the
import does:

- Folders with the same path are reused, missing ones are created.
  Nothing is renamed or removed.
- Permissions on folders are matched to roles **by name** (step 1) and
  to principals through the target's directory. A principal that doesn't
  resolve is reported.
- Permissions on a datacenter's hidden root folders (`vm`, `host`,
  `datastore`, `network`) are not re-applied, because vCenter refuses
  them with *"Operation not allowed on sub-entity"*; they're listed in
  the log (VIFolderManager README; lab-verified on VCF 9.1.1).

The log file goes to `Logs\` next to the script unless you pass
`-LogDirectory`. Keep it with the exports.

**Undo:** VIFolderManager deliberately has no delete mode, *"destroying a
vSphere folder also destroys everything inside it, VMs included"*
(README). Remove a wrong folder by hand in the vSphere Client while it's
still empty.

**Permissions on everything else.** VIFolderManager handles permissions
on folders only. Permissions set on the vCenter root, datacenters,
clusters, hosts, datastores, networks or individual VMs need their own
export. The command for that, and for a full role export, is in the
[permissions backup of docs/06](06-iwa-ldaps-migration.md#1-backup-before-touching-anything).
Recreate them on the target with `New-VIPermission`, for those objects
that exist on the target. **Global permissions** don't come from
`Get-VIPermission`; docs/06 explains how to capture them.

**Check.** The folder trees on both vCenters match (a new export of the
target, compared with the source export), the import log has no
unresolved principals, and every non-folder permission from the export
either exists on the target or waits for an object that arrives in a
later wave.

---

## Phase 2 is done when

- [ ] Every custom role is on the target, and skipped privileges have
      been reviewed.
- [ ] Every tag category and tag is on the target, with the same
      cardinality and entity types.
- [ ] The tag assignment baseline is exported.
- [ ] Every custom attribute is on the target.
- [ ] Every storage policy in use is on the target or mapped to a target
      policy, and skipped rules have been reviewed.
- [ ] The folder trees match, and folder permissions are in place.
- [ ] Other permissions are recreated or listed for later waves.
- [ ] All exports are in the working folder.

Then go on with phase 3 in [docs/29](29-side-by-side-migration.md#phase-3-carry-over-the-networks-and-the-firewall).

---

## Sources

Checked on 2026-11-13.

- [KB 344959](https://knowledge.broadcom.com/external/article/344959):
  Cross vCenter Migration and Clone requirements in VMware vSphere 6.x and
  later
- [KB 409981](https://knowledge.broadcom.com/external/article/409981):
  VCF PowerCLI 9.x fails to run commands with an error "The system cannot
  find the file specified"
- Broadcom, [PowerCLI installation guide](https://developer.broadcom.com/powercli/installation-guide)
- Jim Millard, 2026-05:
  [Migrating tags after cross-vCenter vMotion](https://blog.millard.org/2026/05/migrating-tags-after-cross-vcenter.html)
- Toolkit READMEs and code:
  [VIRoleManager](https://github.com/pauldiee/VIRoleManager) 1.2.3,
  [StoragePolicyManager](https://github.com/pauldiee/StoragePolicyManager) 1.0.3,
  [VIFolderManager](https://github.com/pauldiee/VIFolderManager) 1.1.0
- PowerCLI cmdlet syntax and help (`New-TagCategory`, `New-Tag`,
  `Get-TagAssignment`, `New-CustomAttribute`, `Get-VIPermission`,
  `New-VIPermission`, `Remove-VIRole`, `Remove-SpbmStoragePolicy`,
  `Remove-Tag`, `Remove-TagCategory`): VMware.VimAutomation.Core and
  .Storage 13.5.1 (VCF.PowerCLI 9.1.1)
