# VMware Tools ProductLocker: shared repository and why it resets

**`/productLocker`** is a symbolic link on every ESXi host that determines
the **active VMware Tools repository** – where the host looks for the
VMware Tools ISOs it offers to guest VMs for install/upgrade. Its target
is controlled by the `UserVars.ProductLockerLocation` advanced setting,
defaulting to the **local** path `/locker/packages/vmtoolsRepo/` on each
host. Applies to any ESXi host regardless of track (VCF, VVF, or
standalone vSphere) – this is a plain ESXi/vCenter setting, independent
of any licensing layer.

**Why point it at shared storage instead of the local default:** at any
real scale (tens of hosts and up), leaving every host on its own local
copy means VMware Tools versions can silently drift host-to-host, and
each host carries its own redundant copy of the Tools ISOs. Pointing
every host's `/productLocker` at the **same shared datastore path**
centralizes the repository – one place to update, one version truth
across the cluster.

---

## Setting it – two methods

### Method 1: Advanced Settings (needs a host reboot to take effect)

```powershell
# Query current value across every host
Get-VMHost | Get-AdvancedSetting -Name "UserVars.ProductLockerLocation" |
  Select-Object Entity, Value

# Set it
Get-VMHost | Get-AdvancedSetting -Name "UserVars.ProductLockerLocation" |
  Set-AdvancedSetting -Confirm:$false -Value "/vmfs/volumes/<datastore>/<repo-folder>/"
```

Or directly on the host via `esxcli` (ESXi shell/SSH):

```
esxcli system settings advanced set -o /UserVars/ProductLockerLocation -s /vmfs/volumes/<datastore-name-or-volume-id>/<repo-folder>
```

Per Broadcom, this method **does not check that the target directory
exists or contains valid Tools files** – a typo in the path silently
breaks Tools install/upgrade for every VM on that host until caught. And
**updating the `/productLocker` symlink itself needs the host rebooted**
– setting the advanced parameter alone doesn't relocate the live symlink
until the next reboot. (Not independently lab-verified for this method
specifically – Method 2 below *was* tested directly, and its
existence-check behavior turned out to differ from what's claimed about
it, so treat the "no existence check" claim here as unconfirmed rather
than assumed to also apply.)

### Method 2: MOB API via PowerCLI's `ExtensionData` – no reboot needed

The reboot requirement above is avoidable – calling the same host API the
advanced-setting UI eventually triggers, directly, relocates the symlink
immediately:

```powershell
# Query, per cluster
$allhosts = Get-Cluster "<clustername>" | Get-VMHost
foreach ($esxihost in $allhosts) {
  Get-VMHost -Name $esxihost | %{ $_.ExtensionData.QueryProductLockerLocation() }
  Write-Host $esxihost -ForegroundColor Green
}

# Set, per cluster
$allhosts = Get-Cluster "<clustername>" | Get-VMHost
foreach ($esxihost in $allhosts) {
  Get-VMHost -Name $esxihost | %{ $_.ExtensionData.UpdateProductLockerLocation_Task("/vmfs/volumes/<datastore>/<repo-folder>") }
}
```

> **Lab-verified 2026-09-21** (holodeck lab, PowerCLI 13.5.1, vCenter/ESXi
> 9.1.1) – confirmed no reboot is needed: `QueryProductLockerLocation()`
> reflects the change immediately after the task completes. **Two
> corrections to what secondary sources claim about this method:**
> - **The target folder must already exist first.** Calling
>   `UpdateProductLockerLocation_Task` against a path that doesn't exist
>   yet **fails outright** – the task errors with `"File
>   /vmfs/volumes/<datastore>/<folder> was not found"` and the value is
>   left unchanged. This directly contradicts the claim (repeated in a
>   Broadcom VCF blog, cited below) that this method "does not check the
>   existence of the directory." Create the folder first, e.g. via
>   PowerCLI's datastore drive:
>   ```powershell
>   $ds = Get-Datastore "<datastore>"
>   New-PSDrive -Location $ds -Name repo -PSProvider VimDatastore -Root '\' | Out-Null
>   New-Item -ItemType Directory -Path 'repo:\<repo-folder>' | Out-Null
>   Remove-PSDrive -Name repo
>   ```
> - **On a vSAN datastore, the path you get back is not the path you set.**
>   Pointing it at `/vmfs/volumes/<vsan-datastore-name>/<folder>` and then
>   re-querying returned an internal canonicalized path instead (observed:
>   `/vmfs/volumes/vsan:<container-uuid>/<object-uuid>`) – expected
>   behavior for vSAN's object store, not a sign the set failed, but it
>   means a later "does this match what I set" comparison needs to check
>   functionally (can Tools actually be reached) rather than a literal
>   string match against the friendly datastore-name path.

Source: Paul's own write-up, [Set ProductLocker location with
PowerCLI](https://www.hollebollevsan.nl/set-productlocker-location-with-powercli/) –
the base technique this method is drawn from (holds up; the folder-must-exist
and vSAN-canonicalization behavior above are additions from lab testing,
not corrections to that post itself).

---

## Why it resets – and why this needs to be a repeatable step, not a one-off

**A confirmed, now-fixed bug:** on ESXi 7.x, applying a patch via VUM and
rebooting could **truncate the configured path**, corrupting it into
something like `/VMware-Tools/productLocker/` with each consecutive
patch, showing as an invalid/inaccessible location afterward. Fixed in
**ESXi 7.0 Update 3f** (PR 2964856) – if still seeing this exact symptom,
confirm the target build is at or past that patch level.

**The general, still-current reason this needs periodic re-verification:**
`UserVars.ProductLockerLocation` is a per-host advanced setting. Nothing
about a normal ESXi major-version upgrade guarantees it survives –
Broadcom's own documentation doesn't state that it's preserved
automatically across an upgrade, only how to set it. Anything that
re-provisions or reimages a host from scratch (a fresh ESXi install, a
stateless Auto Deploy boot, or any restore-to-default-config path) has no
reason to carry a custom local advanced setting forward unless something
explicitly re-applies it.

**Practical takeaway for an upgrade project:**
- **Re-verify the ProductLocker location as part of post-upgrade
  validation**, the same way builds, VMware Tools versions, vSAN
  on-disk format, and vDS versions already get checked – see [Full VCF
  upgrade sequence: Post-upgrade
  validation](13-vcf-upgrade-sequence.md#post-upgrade-validation). Use
  the query snippet above per cluster/host after every ESXi upgrade,
  not just once at initial setup.
- **Set it via Host Profile if the environment already uses them** –
  Host Profile remediation re-applies advanced settings on drift, which
  turns "did the reboot reset it" into a non-issue instead of a manual
  recheck.
- If in the middle of a **VUM baseline → vLCM image transition** (see
  [VUM to vLCM images migration](15-vum-to-vlcm-migration.md)), re-check
  ProductLocker after the transition completes – Broadcom's own
  documentation doesn't specifically confirm how a vLCM image switch
  interacts with a custom ProductLocker location, so treat it as
  unverified rather than assumed-safe until checked directly against the
  target environment.

---

## Sources

- [Set ProductLocker location with PowerCLI](https://www.hollebollevsan.nl/set-productlocker-location-with-powercli/) – the no-reboot MOB API method
- [Options for Updating VMware Tools at Scale (Broadcom VCF blog)](https://blogs.vmware.com/professional-services/2023/03/options-for-updating-vmware-tools-at-scale.html) – what ProductLocker is, the Advanced Settings method, the reboot requirement
- [Installing and upgrading the latest version of VMware Tools (KB 313876)](https://knowledge.broadcom.com/external/article/313876/installing-and-upgrading-the-latest-vers.html) – `esxcli` method, default local path
- [productLocker location getting changed when applying any patches via VUM?](https://community.broadcom.com/vmware-cloud-foundation/discussion/productlocker-location-getting-changed-when-applying-any-patches-via-vum) – the path-truncation bug and its fix in ESXi 7.0 Update 3f (PR 2964856)
