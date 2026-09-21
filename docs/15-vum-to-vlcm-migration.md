# VUM (baselines) to vLCM images migration

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md)'s
[Prerequisites table](13-vcf-upgrade-sequence.md#prerequisites-and-architectural-guardrails)
("vSphere Lifecycle Manager – All clusters managed by **vLCM images** –
transition any remaining baseline-managed clusters first") and the
[Standalone VVF upgrade](14-standalone-vvf-upgrade.md), plus the
[VxRail Addendum](vxrail-addendum.md#where-this-plugs-into-the-general-flow)'s
hard requirement on VxRail. **vSphere Lifecycle Manager (vLCM) baselines are not
supported with VMware Cloud Foundation 9.0 or later** – every cluster and
standalone host still managed by baselines (the VMware Update Manager /
VUM-style model) has to transition to **images** before the ESX host phase
of the upgrade will run.

Applies to **VCF and standalone VVF** – vLCM images are a vSphere 9
platform requirement, not something specific to SDDC Manager. Do this
**before** committing to a phase count or maintenance window; it's a
per-cluster (or per-standalone-host) prerequisite, not something either
upgrade workflow does for you.

---

## Two different mechanisms, pick by track

- **Full VCF (SDDC Manager present)** – use the **`VcfBaselineClusterTransition.ps1`**
  PowerShell script (or the SDDC Manager API directly) – see
  [VCF track: PowerShell script](#vcf-track-powershell-script-vcfbaselineclustertransitionps1).
  This is the Broadcom-supported path for anything SDDC Manager already
  knows about (clusters *and*, since VCF 9.1, standalone hosts).
- **Standalone VVF / plain vSphere (no SDDC Manager)** – use the native
  **vSphere Client** conversion wizard directly against vCenter – see
  [VVF / plain vSphere track: vSphere Client](#vvf--plain-vsphere-track-vsphere-client).

Don't mix them: the PowerShell script talks to SDDC Manager's API and
won't do anything useful against a vCenter with no SDDC Manager behind it.

---

## VCF track: PowerShell script (`VcfBaselineClusterTransition.ps1`)

> **Lab-verified 2026-09-19** (my holodeck lab, PowerShell 7.6.6, SDDC
> Manager/vCenter 9.1.1) – `-Connect`, `-ShowBaselineResources`, and
> `-ShowImagesInVcenter` all ran clean against the real SDDC Manager and
> returned correct results (this lab's cluster is already image-managed,
> so `-ShowBaselineResources` correctly reported nothing to transition –
> the compliance-check/transition flow itself couldn't be exercised for
> lack of a baseline-managed resource to point it at). Three things fixed
> or confirmed along the way:
> - **The README's own inline compliance-check example uses the wrong
>   parameter name** (`-WorkloadDomain`) – the script only defines
>   `-WorkloadDomainName` (confirmed by reading its `Param()` block
>   directly). Fixed below.
> - **`Install-Module -Name VCF.PowerCLI` failed outright** in this
>   environment with an Authenticode publisher mismatch, because an older
>   VMware-signed `VMware.VimAutomation.StorageUtility` module was already
>   installed and the new one ships signed by Broadcom instead (the
>   VMware→Broadcom rebrand) – needed `-SkipPublisherCheck`. Likely to bite
>   anyone who already has `VMware.PowerCLI` installed, which is the
>   common case (it's what this repo's other PowerCLI snippets use).
> - **`VCF.PowerCLI` actively conflicts with a co-installed
>   `VMware.PowerCLI`** – the script itself warns about this every run:
>   *"VMware.PowerCLI 13.3 ships 13.3-era submodule versions ... that
>   conflict with VCF.PowerCLI 9's required 13.4-era submodules"* and
>   recommends `Uninstall-Module -Name VMware.PowerCLI -AllVersions`. If
>   this repo's other scripts (docs/08, docs/13) and this one are ever run
>   from the same PowerShell profile, expect that conflict – consider a
>   separate profile/session for this script rather than uninstalling
>   `VMware.PowerCLI` outright.
> - **`-CreateHostRemediationOptionsFile` is fully interactive with no
>   unattended path** – it hangs waiting on console input even with
>   `-JsonOutput` supplied, and explicitly refuses to run with `-Silence`
>   (*"cannot be used with this option as the feature is interactive"*).
>   Can't be scripted into an unattended run despite looking like an
>   ordinary CLI flag.

### Prerequisites

Per the [script's GitHub repo](https://github.com/vmware/powershell-script-for-vmware-cloud-foundation-vum-to-vlcm):

- **SDDC Manager 5.2.2+ / 9.x**
- **VCF.PowerCLI 9.1**
- **PowerShell 7.4+**

```powershell
Install-Module -Name VCF.PowerCLI -MinimumVersion 9.1
Set-PowerCLIConfiguration -InvalidCertificateAction Ignore
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

If a `VMware.PowerCLI` install is already present, add
`-SkipPublisherCheck` to the `Install-Module` line above – Broadcom's
VCF.PowerCLI submodules are now signed under the Broadcom certificate
rather than the older VMware one, which trips PowerShell's Authenticode
publisher check against an existing VMware-signed install.

Download the script itself from the repo's
[Releases page](https://github.com/vmware/powershell-script-for-vmware-cloud-foundation-vum-to-vlcm/releases) –
it isn't a PowerShell module, just a standalone `.ps1`.

> **This warning can appear even on a brand-new 9.1 deployment.** Per
> [Broadcom KB 385617](https://knowledge.broadcom.com/external/article/385617):
> *"For new 'greenfield' installations of VCF 9.1, this warning can show up
> even if there has been no upgrade, migration, or imports."* Don't assume
> a fresh install is exempt from checking – run the compliance check
> regardless of whether the fleet is a brownfield upgrade or a new build.

### Two usage modes

1. **Interactive / menu-driven** – run the script with no parameters (or
   `-Connect`), work through the on-screen menu. Processes resources
   **sequentially only** – there is no parallel option in this mode.
2. **Command-line, with `-Parallel`** – scriptable, JSON-driven, and the
   only way to process multiple clusters/hosts concurrently.

### Command-line walkthrough

**Connect** (prompts for SDDC Manager credentials if no saved credential
file is found):

```powershell
./VcfBaselineClusterTransition.ps1 -Connect
```

For a non-interactive connect (automation, or just to skip retyping
credentials every run), pass a JSON file instead – `SddcManagerPassword`
isn't shown in the repo's own sample file but the script does read it
(confirmed working against a real SDDC Manager):

```json
{
  "SddcManagerFqdn": "sddcmgr.example.com",
  "SddcManagerUserName": "administrator@vsphere.local",
  "SddcManagerPassword": "<password>"
}
```

```powershell
./VcfBaselineClusterTransition.ps1 -Connect -JsonInput .\SddcManagerCredentials.json
```

**See what's still on baselines**, optionally saving the list to JSON for
the later steps:

```powershell
./VcfBaselineClusterTransition.ps1 -ShowBaselineResources -JsonOutput Resources.json
```

**Run a compliance check** – against a single resource, or a JSON batch
in parallel:

```powershell
# Single resource, image seeding (auto-generates a vLCM image from the host's own state)
./VcfBaselineClusterTransition.ps1 -ComplianceCheck -ResourceType "Standalone Host" -WorkloadDomainName m01 -ResourceName esx-2.example.com

# Batch, from a JSON file, in parallel
./VcfBaselineClusterTransition.ps1 -ComplianceCheck -JsonInput .\BaselineResources.json -Parallel
```

**Review the results** before transitioning anything:

```powershell
./VcfBaselineClusterTransition.ps1 -ReviewComplianceResults -ShowAllResources
```

**Transition** – single resource or JSON batch, serialized by default or
parallel with `-Parallel`:

```powershell
./VcfBaselineClusterTransition.ps1 -TransitionResource -ResourceName esx-3.example.com -ResourceType "Standalone Host" -WorkloadDomainName "m01"

./VcfBaselineClusterTransition.ps1 -TransitionResource -Parallel -JsonInput .\BaselineResources.json
```

**Check transition status**, and **collect logs** if something needs
troubleshooting:

```powershell
./VcfBaselineClusterTransition.ps1 -CheckTransitions
./VcfBaselineClusterTransition.ps1 -CollectLogs
```

> **Task persistence – once started, it can't be paused or stopped.** Per
> the TechDocs menu-driven-interface page: *"Once you start a compliance or
> transition task, it cannot be paused or stopped. The task continues to
> run on the SDDC manager even if the Powershell window is closed."*
> Closing the terminal doesn't cancel it – it keeps running server-side.

### Known false-positive in the compliance check

The compliance check can **mis-identify certain non-user-managed VIBs and
components as non-compliant**, specifically: `vmware-fdm`,
`nsx-lcp-bundle`, `VMware-Spherelet`, and `vmware-hbr-agent`. These are
solution-managed components (vSphere HA, NSX, Supervisor, HBR) that aren't
supposed to be part of a manually-curated image in the first place –
don't chase these as real compliance gaps.

### Host remediation options (retry, power state, QuickBoot)

Optional, but worth setting deliberately rather than accepting defaults for
a production transition – generate and inspect the file first:

```powershell
./VcfBaselineClusterTransition.ps1 -CreateHostRemediationOptionsFile -JsonOutput HostRemediationOptionsFile.json
```

```json
{
  "PreRemediationPowerAction": "DO_NOT_CHANGE_VMS_POWER_STATE",
  "RemediationRetryDelay": "305",
  "RemediationRetryCount": "5",
  "RemediationFailureAction": "RETRY",
  "QuickBootEnabled": false
}
```

`PreRemediationPowerAction` accepts `POWER_OFF_VMS`, `SUSPEND_VMS`,
`DO_NOT_CHANGE_VMS_POWER_STATE`, or `SUSPEND_VMS_TO_MEMORY`. Pass the file
with `-HostRemediationOptionsFile` on the `-TransitionResource` call.

---

## VVF / plain vSphere track: vSphere Client

No SDDC Manager to talk to, so this runs directly against vCenter's own
vSphere Lifecycle Manager UI.

### Prerequisites

Per Broadcom TechDocs
["Convert a Cluster or a Host That Uses Baselines Into a Cluster or a Host
That Uses vSphere Lifecycle Manager Images"](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/managing-host-and-cluster-lifecycle/using-images-to-install-and-update-esxi-hosts-and-clusters/switching-from-baselines-to-images.html):

- **All ESX hosts in the cluster (or the standalone host) must be version
  8.0 or later.**
- Hosts must be **stateful** (stateless hosts are handled differently, with
  exceptions the TechDocs page covers separately).
- **No host in the cluster or standalone host can contain any unknown
  components.**

> **This is a one-way door.** *"If you switch to using images, you cannot
> revert to using baselines for the cluster."* There is no documented
> "convert back to baselines" path for a cluster once it's been switched –
> confirm the cluster is actually ready before starting, not mid-conversion.

Also expect cleanup as a side effect of the first remediation after
conversion: *"After you set up an image for the cluster or host and
remediate the hosts... standalone VIBs are deleted from the hosts"* and
*"non-integrated solution agents are deleted from the hosts."* Anything
manually installed outside of vLCM's own component model doesn't survive.

### Procedure

vSphere Client → select the cluster (or standalone host) → **Updates**
tab → **Image** → choose **manage with a single image**. The **Convert to
an Image** wizard offers three ways to define that image:

1. **Extract an image from an existing host** – vLCM reads the software
   currently installed on a reference host in the cluster and builds the
   image from that. Fastest option when the hosts are already consistent
   with each other. **vSphere Lifecycle Manager cannot extract firmware
   updates from a host**, and the extracted image does not include VIBs
   controlled by solutions like vSphere HA or NSX Local Control Plane –
   those stay managed by their own solution integration, not the manual
   image.
2. **Import an image from a JSON file** – for reproducing a known-good
   image definition (e.g. one exported from another cluster).
3. **Set up a new image manually** – pick the ESXi base version, vendor
   add-on, firmware and drivers, and individual components by hand through
   the wizard.

Whichever option is used, vCenter validates cluster/host eligibility first
and reports any blocking issues before letting the conversion proceed.

### Known extraction failure: "no store copy available for inactive VIB"

A real, documented failure mode when extracting an image from a host that
has been through an **ISO-based upgrade** at some point in its history. Per
[Broadcom KB 407728](https://knowledge.broadcom.com/external/article/407728/failed-to-extract-image-from-the-host-no.html):

- **Symptom:** `"Extraction of image from host <hostname> failed"` in the
  vCenter UI, with the underlying error `"Failed to extract image from the
  host: no stored copy available for inactive VIB
  VMW_bootbank_###..."`. The host's own `/var/run/log/lifecycle.log` shows
  `"VIB <vib> is not available in cached locations."`
- **Cause:** when a higher-version VIB is installed onto a host, the
  version it replaced gets marked "reserved" and cached under
  `/var/vmware/lifecycle/hostSeed/reservedVibs/`. If the host is later
  upgraded via an **ISO** carrying *older* VIB versions, the ISO installer
  deletes that entire `reservedVibs` directory and repopulates it from its
  own `resvib.tgz` – which may not match what was actually reserved,
  leaving the host's image profile internally inconsistent.
- **Resolution**, three options:
  1. Set up the image **manually** instead of extracting it (sidesteps the
     broken extraction entirely).
  2. Reinstall the ESXi host from the target ISO, then manually reinstall
     the higher-version components that were lost.
  3. Copy the specific missing `.vib` file(s) back into
     `/var/vmware/lifecycle/hostSeed/reservedVibs/` on the affected host,
     then retry the extraction.

If a host in scope has an ISO-based upgrade anywhere in its history, expect
this and have **Option 1 (manual image setup)** ready as the fallback
before attempting extraction.

---

## NSX-enabled clusters: extra care

Converting a cluster that also runs **NSX** (management or workload
domain) has its own gotchas on top of the general procedure above, per
[ITQ's own write-up on this exact scenario](https://itq.eu/knowledge/converting-nsx-enabled-cluster-from-baselines-to-single-image/)
(credited – see that source for the fuller walkthrough):

- **NSX-side prerequisites before starting:** every host on ESXi 7.0 U1 or
  later; the NSX **Compute Manager** has **Trust** enabled with access
  level set to **vSphere Lifecycle Manager** (mandatory for NSX/vLCM
  communication) and **Create Service Account** enabled; hosts on a **VDS**
  (not N-VDS); and the **Transport Node Profile applied to the whole
  cluster** before vLCM is enabled on it.
- **The NSX LCP Bundle can't be manually selected during image creation**,
  even entering the exact matching name and version – this is expected
  behavior, not a bug (Broadcom KB 90188). Build a clean custom image and
  let NSX's own solution integration supply that component; don't fight
  the wizard trying to add it by hand.
- **A failed "Apply NSX Solution" task is expected** right after image
  setup completes – it reflects vCenter reporting cluster-enablement
  status back to NSX, not a datapath problem. Confirm NSX's own management
  UI shows the cluster flagged as vLCM-managed and that datapath is
  unaffected before treating it as a real failure.
- **Remediation warnings about NSX components being flagged for removal**
  during the first remediation pass can be safely ignored, per the same KB
  90188 – they're the same "solution-managed component isn't part of the
  manual image" behavior as the LCP Bundle point above.

---

## Before moving on

- Every cluster and standalone host in scope shows **Image**-managed, not
  Baseline-managed, in vCenter / SDDC Manager.
- No outstanding compliance findings other than the known false-positives
  above.
- For NSX-enabled clusters: NSX's own UI shows the cluster as vLCM-managed,
  and the transport zone / overlay is unaffected.
- Re-check the **ProductLocker** shared VMware Tools repository location
  after the transition, if one was configured before it – not confirmed
  whether a baseline-to-image switch preserves it, see [VMware Tools
  ProductLocker](18-vmware-tools-productlocker.md).
- Continue into the ESX host phase –
  [Phase 7](13-vcf-upgrade-sequence.md#phase-7--esx--host-cluster-upgrade)
  (VCF) or [step 4](14-standalone-vvf-upgrade.md#standalone-vvf-manual-upgrade--exact-steps)
  (standalone VVF) – which requires every cluster to already be on images.

---

## Sources

- [Broadcom KB 385617 – Transition to vSphere Lifecycle Manager (vLCM) Images using SDDC Manager](https://knowledge.broadcom.com/external/article/385617)
- [VcfBaselineClusterTransition.ps1 – GitHub repo, README, releases](https://github.com/vmware/powershell-script-for-vmware-cloud-foundation-vum-to-vlcm)
- [Transition to vSphere Lifecycle Manager Images Using the PowerShell Script Menu-Driven Interface (TechDocs)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/upgrading-cloud-foundation/upgrade-the-management-domain-to-vmware-cloud-foundation-5-2/vlcm-baseline-to-vlcm-image-cluster-transition-/transition-vlcm-baseline-clusters-to-vlcm-image-clusters-using-powercli(1)/transition-to-vsphere-lifecycle-manager-images-using-the-powershell-script-menu-driven-interface.html)
- [Convert a Cluster or a Host That Uses Baselines Into a Cluster or a Host That Uses vSphere Lifecycle Manager Images (TechDocs)](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/managing-host-and-cluster-lifecycle/using-images-to-install-and-update-esxi-hosts-and-clusters/switching-from-baselines-to-images.html)
- [Broadcom KB 407728 – "Failed to extract image from the host: no store copy available for inactive VIB" error while converting to an image from baseline](https://knowledge.broadcom.com/external/article/407728/failed-to-extract-image-from-the-host-no.html)
- [ITQ – Converting NSX enabled cluster from baselines to single image](https://itq.eu/knowledge/converting-nsx-enabled-cluster-from-baselines-to-single-image/)
