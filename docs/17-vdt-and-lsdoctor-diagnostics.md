# VDT and lsdoctor: self-service diagnostic tools

Two **self-service** diagnostic tools for a vCenter appliance, both plain
Broadcom KB attachments. Between the two, they're where most real answers
come from once something is actually broken – reach for **VDT** first for
a broad health sweep, then **lsdoctor** if VDT's Lookup Service/AD check
(or any other SSO symptom) points deeper into the Lookup Service / vmdir
layer. Neither is tied to any one migration or upgrade step – both apply
whenever a vCenter/PSC exists, regardless of track (VCF, VVF, or
standalone vSphere).

> **Before copying either tool over: SCP to the appliance fails until the
> default shell is switched from `appliancesh` to `bash`.** Confirmed
> current on vCenter 9.0 as well as 7.x/8.x – TechDocs still documents
> `appliancesh` as the default login shell. From the appliance shell
> (console or SSH):
> ```
> shell.set --enabled true
> shell
> chsh -s /bin/bash root
> ```
> Reconnect, then SCP/WinSCP works. Revert with
> `chsh -s /bin/appliancesh root` once done, per the appliance-hardening
> norm of not leaving bash as the standing default.

---

## VCF Diagnostic Tool for vSphere (VDT)

A general vCenter appliance health-check script – the closest self-service
equivalent to an SDDC Manager fleet precheck when there's no SDDC Manager
to run one from (e.g. the standalone VVF / manual GUI upgrade path). Per
[Broadcom KB 344917, "Using the VCF Diagnostic Tool for vSphere (VDT)"](https://knowledge.broadcom.com/external/article/344917/using-the-vcf-diagnostic-tool-for-vspher.html):

1. Download the VDT version matching the source vCenter build from the KB
   attachments, copy it to the appliance (WinSCP or equivalent – see the
   default-shell note above) into
   `/root`, then extract it:
   ```
   cd /root/
   unzip vdt-<version_number>.zip
   cd vdt-<version_number>
   ```
2. Run it:
   ```
   python vdt.py
   ```
   Prompts for the `administrator@<sso-domain>` password – *"Many checks
   will still run even if credentials are not supplied,"* but supply it
   for full coverage.
3. Review the PASS/FAIL/WARN results. Checks that matter most for an
   upgrade specifically: **DNS**, **NTP**, **disk space**,
   **certificates**, **Lookup Service / AD integration**, **vCenter
   services**, and **VCHA** – all things a prerequisites checklist
   assumes are healthy; VDT is how to actually confirm that instead of
   assuming it.

A FAIL here is cheaper to fix now than mid-migration – run it per
vCenter before the window opens, not after something's already gone
wrong. If the FAIL is in the Lookup Service / AD integration check
specifically, that's the signal to move on to lsdoctor below rather than
treating it as a standalone DNS/AD problem.

### Known issue: "General Info" check crashes with `IndexError: list index out of range`

The very first check VDT runs can itself fail outright rather than
report PASS/FAIL, with a Python traceback ending:

```
File ".../vcenter/vc_scripts/vc_info.py", line 158, in getNtpServers
    ntpservers.append(line.split()[1])
IndexError: list index out of range
```

This is **a bug in VDT's own NTP-parsing code, not a finding about the
vCenter's health** – per [Broadcom KB 426374, "VDT run failed at
'General Info' check with an Error while attempting to collect NTP
server information"](https://knowledge.broadcom.com/external/article/426374/vdt-run-failed-at-general-info-check-wit.html),
`getNtpServers()` assumes
every line in `/etc/ntp.conf` splits into at least two tokens, and chokes
on a malformed line (stray whitespace, a blank line, or similar) instead
of skipping it. Fix the input file, not VDT itself:

1. Back up first: `cp /etc/ntp.conf /etc/ntp.conf_bak`.
2. Edit with `vi /etc/ntp.conf` and remove any blank lines or
   trailing/extraneous whitespace – valid entries should read cleanly as
   `server xx.xx.xx.xx` with nothing else on the line.
3. Restart `ntpd` so it's running against the corrected file:
   `systemctl restart ntpd`. VDT reads `/etc/ntp.conf` directly rather
   than querying the running daemon, so this step hasn't been observed
   as strictly necessary just to clear the crash – include it anyway,
   since leaving `ntpd` running against the pre-edit config is its own
   latent inconsistency.
4. Re-run `python vdt.py` – General Info should now complete and report
   its actual PASS/FAIL/WARN results instead of crashing before it gets
   there.

Fix it before assuming VDT itself is broken or unsupported on this
build – the traceback is VDT's own parsing bug tripping on this
specific file's contents, not a signal about the vCenter.

### Field-observed symptom: `vpxd.cfg` XML parse failure (malformed `<vcls>` block)

The **vCenter Basic Info** check can report a WARNING with its own
traceback:

```
[INFO]    vCenter Basic Info
...
WARNING!  FAILED TO PARSE VPXD.CFG. Trace: Traceback (most recent call last):
  File ".../vc_info.py", line 85, in SDDCManaged
    vpxd = xml.parse("/etc/vmware-vpx/vpxd.cfg")
  ...
xml.etree.ElementTree.ParseError: not well-formed (invalid token): line <N>, column 7
```

**Unlike the NTP crash above, this one is not a VDT bug** –
`/etc/vmware-vpx/vpxd.cfg` genuinely is malformed XML. Per Broadcom KB
(legacyId 416489, ["vCenter server hostname shows localhost. and the
vpxd service is
stopped"](https://knowledge.broadcom.com/external/article/416489/vcenter-server-hostname-shows-localhost.html)),
the same corruption can destabilize `vpxd` itself well beyond this one
VDT check – documented symptoms include the appliance hostname reverting
to `localhost`, the vCenter Server service stopped, `vpxd` generating
coredumps, and `vapi` pinned at 100% CPU in `vimtop`. Treat this WARNING
as a reason to check `vpxd`'s actual health (service status, coredumps,
`vimtop`), not dismiss it as cosmetic just because VDT itself kept
running.

That KB's example points at a malformed `<vcls>` block as the cause. The
line number will differ per environment (KB's own example is line 45,
not line 39/whatever the local traceback reports) – confirm before
editing anything:

1. Back up first: `cp /etc/vmware-vpx/vpxd.cfg /root/vpxd.cfg.bak`.
2. Inspect the reported line: `less -N /etc/vmware-vpx/vpxd.cfg`, jump
   to the line number from the traceback, and confirm it actually falls
   inside a `<vcls>...</vcls>` block before touching anything – don't
   assume this KB's specific cause matches without checking.
3. If confirmed, remove the block:
   `sed '/<vcls>/,/<\/vcls>/d' -i /etc/vmware-vpx/vpxd.cfg`.
4. Restart vCenter services so `vpxd` picks up the corrected file:
   `service-control --stop --all && service-control --start --all`.
5. Re-run `python vdt.py` to confirm the WARNING clears.

> **Untested in this repo.** This `sed` command directly edits a live
> `vpxd.cfg` and hasn't been field-verified here yet – take the snapshot
> in step 1 seriously, and treat step 2's confirmation as mandatory, not
> optional, before running step 3 against a different environment.

---

## lsdoctor: Lookup Service / SSO / vmdir troubleshooting

**Lookup Service Doctor (`lsdoctor`)** is Broadcom's general-purpose tool
for **data stored in the PSC database, plus data local to a vCenter** –
SSL trust mismatches between services, broken/stale service
registrations, and inconsistent solution users. Reach for it whenever
something in the SSO/Lookup Service/vmdir layer looks wrong and doesn't
cleanly match a more specific, already-diagnosed symptom – see
[Field notes: Identity Broker / VCF SSO](04-field-notes.md#identity-broker--vcf-sso)
for symptoms this tool has already resolved (Identity Broker encryption
key desync, NTP-adjacent SSO token failures, ELM drift after breaking
Enhanced Linked Mode).

For a worked example of the read-only check run at a specific point in a
migration's flow, see [IWA to AD-over-LDAPS migration → Validate
SSO/Lookup Service health with
lsdoctor](06-iwa-ldaps-migration.md#validate-ssolookup-service-health-with-lsdoctor).
This doc is the general reference; that one shows it in context.

### Supported versions and where to run it

- **vCenter Server 6.7 (Windows-based or VCSA) and later** – covers 7.x,
  8.x, and 9.x. Per Broadcom KB 320837 (source below), support for the
  very latest vCenter build can lag slightly behind release, so confirm
  compatibility with the target build before relying on it right after a
  new release.
- Needs **shell/SSH access** to the target node.
- Works across **embedded PSC, external PSC, and mixed Enhanced Linked
  Mode deployments spanning multiple SSO sites** – most operations can
  run from any node within the same SSO site, not necessarily the
  Primary.

### Download and setup

1. Download the tool attachment from
   [Broadcom KB 320837, "Using the 'lsdoctor' Tool"](https://knowledge.broadcom.com/external/article/320837/using-the-lsdoctor-tool.html).
2. Copy it to the target vCenter (WinSCP or equivalent – see the
   default-shell note above), SSH in, and unzip it.
3. Run it from inside the extracted `lsdoctor-main` directory – it must
   be run from there, not a copy of individual files elsewhere.

### Always run the read-only check first

```
python lsdoctor.py -l
```

(`-l` / `--lscheck`) only reports – it makes no changes, so it's safe to
run without a fresh snapshot beyond whatever backup discipline the
surrounding procedure already requires. Resolve anything it flags before
assuming a separate, unrelated cause for whatever symptom brought you
here – an unresolved Lookup Service inconsistency tends to surface later
as a confusing, hard-to-place permission or authentication failure rather
than a clean error at the point it was actually introduced.

#### Field-observed symptom: "Node In Multiple Sites"

The read-only check can report the same vCenter node registered under
more than one SSO site, e.g.:

```
SSO CHECKS
    VC Lookup Service Check
        • SSO Site: default-first-site
            • [FAIL]    vcenter.example.com (VC Server or CGW)
                [FAIL]    Node In Multiple Sites
                            Please run python lsdoctor.py -r option 2 on this node
                            Affected Nodes: {'default-first-site': 'vcenter.example.com', 'domain': 'vcenter.example.com'}
                            Documentation: https://knowledge.broadcom.com/external/article?legacyId=80469
        • SSO Site: site-b
            • [FAIL]    vcenter.example.com (UNKNOWN)
                [FAIL]    Node In Multiple Sites
                            Please run python lsdoctor.py -r option 2 on this node
                            Affected Nodes: {'site-b': 'vcenter.example.com', 'default-first-site': 'vcenter.example.com'}
```

The tool's own output names the fix directly: run `python lsdoctor.py -r`
and choose **option 2** from the rebuild menu for the affected node – per
[KB legacyId=80469](https://knowledge.broadcom.com/external/article?legacyId=80469)
that the tool's output itself links to. Take the same-instant, whole-SSO-domain
snapshot from the warning below **before** running any `-r` option, same
as any other repair mode.

#### Field-observed symptom: STS connection string pointing to the vCenter's own IP

The read-only check's **Identity Source Checks** category can report:

```
IDENTITY SOURCE CHECKS

    [PASS]    Local OS identity source exists

    [FAIL]    STS connection string is incorrect (ldap://<ip-address>)
                Note:           This could prevent services from starting after a recent decommission of another vCenter
                Documentation:  https://knowledge.broadcom.com/external/article?legacyId=91965
```

Broadcom's KB (legacyId 91965 / KB 323195) frames this as leftover from
decommissioning another vCenter in **Enhanced Linked Mode**, but the note
is boilerplate for this specific FAIL – it shows regardless of whether
ELM is actually in play. Observed on a **standalone (non-ELM) vCenter**
where `vmwSTSConnectionStrings` had drifted to the vCenter's own **IP
address** instead of `ldap://localhost:389`, correlated with the
vCenter having **no PTR (reverse DNS) record**. Read that correlation as
the more likely root cause here: a component falling back to
registering by IP when reverse DNS doesn't resolve cleanly, not an ELM
decommission this vCenter never had.

The vCenter can run normally in this state – the FAIL only bites when
services actually restart and need to re-resolve the STS connection
string, which is exactly what an upgrade does (`vpxd`, `vapi-endpoint`,
`vpxd-svcs` all restart). Treat it as a pre-upgrade fix, not a
"currently broken, drop everything" issue:

1. **Fix the PTR record first** – forward *and* reverse DNS is already
   a standard upgrade prerequisite independent of this symptom, and
   fixing the connection string before DNS risks the same drift
   recurring on the next service restart/reconfig.
2. **Then run `fix_sts_attrs.py`** (KB 323195) to correct
   `vmwSTSConnectionStrings` back to `ldap://localhost:389`. The script's
   own instructions say to upload it to "any vCenter in ELM," but the
   mechanism is a per-node vmdir attribute fix – it applies the same way
   on a standalone node; just scope the "snapshot every node in the SSO
   domain first" step to whatever the domain actually contains (one node
   here).
3. `service-control --stop --all && service-control --start --all`.
4. Re-run the read-only check to confirm the FAIL clears.

#### Field-observed symptom: cs.identity Missing Node ID

The read-only check's **VC Lookup Service Check** category can report:

```
VC Lookup Service Check
    • SSO Site: default-site
        • [FAIL]                                            (VC Server or CGW)
            [FAIL]    cs.identity Missing Node ID
                        Regenerate on vCenter Server: <vcenter-fqdn> (VC Server or CGW) after upgrading to 9.1.0.x.
                        If skipping 9.1.0.x, this can be ignored.
                        Documentation:  https://knowledge.broadcom.com/external/article/448977
```

Broadcom KB 448977 documents this purely as a **post-9.1 upgrade
symptom**: a synchronization failure between vCenter Server and the
Identity Broker leaves the **`cs.identity` Lookup Service registration
with a missing Node ID**, alongside stale OAuth2 trust registrations.
Left unresolved, it surfaces later as SSO login failures – *"An error
occurred during authentication"* in the browser, with `"vCenter ID not
found"` and `"AsyncTokenProvider has been closed"` in the logs. **The KB
says nothing about pre-upgrade detection** – but field-observed: this
exact FAIL can already show up in a **read-only lsdoctor sweep run
against vCenter 8.x, before any 9.1 upgrade has happened**. The tool is
flagging a condition it expects to matter later, not something already
broken on 8.x.

**Do not run any of the KB's remediation options against the still-on-8.x
vCenter.** The `cs.identity` registration this KB fixes belongs to the
Identity Broker, a **9.1-only component that doesn't exist yet** on an
un-upgraded vCenter – there's nothing there to regenerate. Read the
tool's own note as the instruction it is: *"Regenerate on vCenter Server
… after upgrading to 9.1.0.x. If skipping 9.1.0.x, this can be
ignored."* Track it as an expected pre-upgrade FAIL, confirm the target
path actually transits 9.1.0.x (skip it if not), and re-run the read-only
check **after** the 9.1.0.x upgrade phase completes – only apply the
remediation below if the FAIL is still present at that point.

Three remediation options per KB 448977, for after reaching 9.1.0.x, in
order of preference:

1. **`regen_csidentity.sh`** (the KB's own script) – take an offline
   snapshot first, run it, it regenerates the `cs.identity` service
   registration and restarts all services itself.
2. **`lsdoctor.py -r`, option 2** ("Replace all services with new
   services") – the general-purpose rebuild option covered in [Repair
   modes](#repair-modes--all-more-invasive-than-the-read-only-check)
   below; same same-instant whole-SSO-domain snapshot precaution applies.
3. **Manual steps** – confirm the missing Node ID, retrieve the stale
   Service ID via `lstool.py`, unregister it, then re-register with
   `sts-init-ls.sh`, then restart all services. Same
   verify-before-deleting discipline as the [orphaned service
   registrations](#field-observed-symptom-orphaned-service-registrations)
   manual cleanup above.

#### Field-observed symptom: orphaned service registrations

A `[WARNING]`-level *"3rd party/Orphaned service registrations"* line for
a service the tool can't associate by hostID/nodeID/serviceID (third-party
integrations like a storage vendor's vSphere plugin are a common source)
is informational, not necessarily something to fix – confirm the service
is genuinely orphaned (the integration was removed) before touching it,
rather than treating every warning as an action item.

**Decommissioned Site Recovery Manager / VMware Live Site Recovery** is a
common, confirmable source of this same warning: an old SRM/VLSR
appliance that was decommissioned improperly, or that became unreachable
before it could
unregister itself cleanly (e.g. deleted or powered off before running
its own uninstall/unregister flow). Per Broadcom KB
[337576, "Cleaning up decommissioned SRM registrations"](https://knowledge.broadcom.com/external/article/337576/cleaning-up-decommissioned-srm-registrations.html),
symptoms besides the lsdoctor warning include SSL errors unregistering
via the appliance's own VAMI, a `"Failed to connect to Site Recovery
Manager Server at https://<IP>:9086/vcdr/vmomi/sdk"` connection-refused
error in the vSphere Client, and stale entries under **vCenter →
Administration → Client Plug-Ins**. Applies to SRM 8.x, VLSR 9.0.2.4, and
vCenter 7.x/8.x. Relevant if disaster recovery is in scope for the
upgrade – see [Disaster Recovery](02-disaster-recovery.md) for the
SRM/VLSR convergence workstream this can surface during.

Root cause, quoted verbatim: *"Stale registrations and solution users
remain orphaned in the vCenter VMDIR database when an appliance is
decommissioned improperly or is no longer reachable."* Three-step
cleanup, in order:

1. **Unregister the extension via the vCenter MOB.** Navigate to
   `https://<vCenter_FQDN>/mob` → **Content** → **ExtensionManager** →
   **More** (to see the full list) → find the extension prefixed
   `com.vmware.vcDr`, open it, and check the **Server** field's IP
   address to confirm it's the stale instance before touching anything.
   Back in ExtensionManager, click **UnregisterExtension**, paste that
   extension's ID, **Invoke Method**.
2. **Remove the service registration via CLI.** SSH to the vCenter, then:
   ```
   cd /usr/lib/vmware-lookupsvc/tools/
   ./lstool.py list --url http://localhost:7090/lookupservice/sdk --no-check-cert --ep-type com.vmware.dr.vcDr
   ```
   Identify the Service ID matching the stale IP, then:
   ```
   ./lstool.py unregister --url http://localhost:7090/lookupservice/sdk --id <Service_ID> --user 'administrator@vsphere.local' --password '<password>' --no-check-cert
   ```
3. **Remove the solution user via VMDIR/LDAP**, if step 2 didn't fully
   clear it. Connect an LDAP browser (e.g. JXplorer) to the vCenter –
   Host `<vCenter_IP>`, Port `389`, Base DN `dc=vsphere,dc=local` –
   navigate to **vsphere → Configuration → Sites → [Site_Name] →
   LookupService → ServiceRegistrations**, and delete the identified
   Service IDs.

Verify the IP/Service ID at every step before deleting anything – this
removes registrations directly from the SSO domain's database, with no
undo beyond whatever snapshot/backup discipline the surrounding
procedure already requires.

#### Field-observed symptom: Machine ID mismatch (VMAFD vs. Likewise registry)

The read-only check's **VC Machine ID Check** category can report two
related failures:

```
VC Machine ID Check
    [PASS]    Machine ID Check
    [FAIL]    Compare Machine ID (VMAFD vs. registry)
                Machine ID doesn't match between the VMAFD service and the likewise registry!  Follow the KB to correct.
                Documentation: https://knowledge.broadcom.com/external/article/312479
    [FAIL]    Compare Machine ID (vpxd.cfg vs. registry)
                Machine ID doesn't match between vpxd.cfg and the likewise registry!  Follow the KB to correct.
                Documentation: https://knowledge.broadcom.com/external/article/312479
    [PASS]    vpxd.cfg SSO Domain Check
```

This is not just an lsdoctor curiosity – per Broadcom KB
[312479](https://knowledge.broadcom.com/external/article/312479), the
same underlying desync **can block a 7.0.x → 8.0.x vCenter upgrade
outright**, failing Stage 2 pre-checks with `Exception occurred in
postInstallHook`, and it's exactly what **VDT's own Machine ID Check**
validates (see [VDT](#vcf-diagnostic-tool-for-vsphere-vdt) above) – so
this can surface from either tool. Root cause, quoted verbatim: *"The
`MachineGuid` value stored within the local Likewise registry (`vmdir`
service) is missing or desynchronized from the authoritative Machine ID
managed by VMAFD and referenced in `vpxd.cfg`."*

**Take an offline (powered-off) snapshot first** – of every replication
partner if the vCenter is part of Enhanced Linked Mode, not just the one
node being fixed. Then, per KB 312479:

1. **Get the authoritative Machine ID from VMAFD:**
   ```
   /usr/lib/vmware-vmafd/bin/vmafd-cli get-machine-id --server-name localhost
   ```
2. **Check whether `MachineGuid` exists in the registry:**
   ```
   /opt/likewise/bin/lwregshell ls "[HKEY_THIS_MACHINE\Services\vmdir]"
   ```
3. **If missing, add it with a temporary placeholder value:**
   ```
   /opt/likewise/bin/lwregshell add_value '[HKEY_THIS_MACHINE\Services\vmdir]' MachineGuid REG_SZ 1
   ```
4. **Set it to the real value from step 1:**
   ```
   /opt/likewise/bin/lwregshell set_value '[HKEY_THIS_MACHINE\Services\vmdir]' "MachineGuid" <Correct_UUID>
   ```
5. **Restart services:**
   ```
   service-control --stop --all && service-control --start --all
   ```
6. **Re-run the read-only lsdoctor check or VDT** to confirm both FAILs
   clear before proceeding.

### Repair modes – all more invasive than the read-only check

None of these reboot the appliance VM, but **every one of them requires a
`service-control` restart afterward** – a vCenter management-plane outage
for however long that restart takes (running VMs on ESXi are unaffected;
this is vCenter/PSC service downtime, not workload downtime), and the
restart scope differs by flag – some are single-node, some are
domain-wide:

| Flag | Does | Restart scope required afterward (verbatim from KB 320837) |
| --- | --- | --- |
| `-l`, `--lscheck` | Read-only diagnostic – always run this first | None – makes no changes |
| `-t`, `--trustfix` | Corrects SSL trust mismatches in Lookup Service registrations | *"restart all services on all nodes in the SSO site"* – every node in the site, not just the one it ran on |
| `-r`, `--rebuild` | Rebuilds service registrations – the most significant change; presents an interactive menu with four recovery sub-options | *"restart all services"* |
| `-u`, `--solutionusers` | Recreates missing or inconsistent solution users | *"restart all services on this node"* – single-node only |
| `-s`, `--stalefix` | Cleans up stale configuration left over from a 5.x-era upgrade | *"restart all services"* |
| `-p`, `--pscHaUnconfigure` | Removes PSC HA load-balancer configuration | *"Once lsdoctor has run on all nodes behind the LB, restart services on all of the PSCs"* – run the tool on every node behind the LB first, then restart every one of them |

The restart itself is the standard appliance-wide cycle:

```
service-control --stop --all && service-control --start --all
```

**Plan for this like any other vCenter/PSC service restart** – schedule
it in a maintenance window, expect the vSphere Client and API to be
unreachable for the restart's duration, and don't run a repair mode
against a production SSO domain expecting zero interruption. `-t` and
`-p` are the ones most likely to surprise – they demand a
site-wide/LB-wide restart, not just the node you ran the command on.

**Before using any repair mode, snapshot the whole SSO domain at the same
instant.** Quoted verbatim from KB 320837: *"Before using lsdoctor to
make any changes, ensure you have taken proper snapshots of your SSO
domain. This means that you must shut down all VCs or PSCs that are in
the SSO domain at the same time, then snapshot them, and power them on
again. If you need to revert to one of these snapshots, shut all the
nodes down, and revert all nodes to the snapshot. Failure to perform
these steps will lead to replication problems across the PSC
databases."*

That's a **same-instant, whole-domain** snapshot – not one node at a
time, and not a live/running-state snapshot. Reverting works the same
way: shut every node down first, revert every node, then power back on.

Output includes JSON report files (exact paths are printed by the tool
at run time); the `-r`/`--rebuild` interactive menu's four sub-options
should be chosen based on what the read-only check surfaced, not
guessed at.

---

## Sources

- [Using the VCF Diagnostic Tool for vSphere (VDT) (KB 344917)](https://knowledge.broadcom.com/external/article/344917/using-the-vcf-diagnostic-tool-for-vspher.html)
- [VDT run failed at "General Info" check with an Error while attempting to collect NTP server information (KB 426374)](https://knowledge.broadcom.com/external/article/426374/vdt-run-failed-at-general-info-check-wit.html) – the `getNtpServers()` crash and the `/etc/ntp.conf` cleanup fix
- [vCenter server hostname shows localhost. and the vpxd service is stopped (KB legacyId 416489)](https://knowledge.broadcom.com/external/article/416489/vcenter-server-hostname-shows-localhost.html) – the malformed `<vcls>` block in `vpxd.cfg`, its wider vpxd-instability symptoms, and the `sed` fix
- [Using the Appliance Shell to Configure vCenter Server (9.0)](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vcenter-configuration/configuring-vcenter-server-using-the-appliance-shell.html) – confirms `appliancesh` is still the vCenter 9 default, behind the SCP-fails-until-bash-is-set note above
- [Toggling the vCenter Server Appliance default shell (Broadcom KB 319670)](https://knowledge.broadcom.com/external/article/319670/toggling-the-vcenter-server-appliance-de.html)
- [Using the "lsdoctor" Tool (KB 320837)](https://knowledge.broadcom.com/external/article/320837/using-the-lsdoctor-tool.html)
- [Cleaning up decommissioned SRM registrations (KB 337576)](https://knowledge.broadcom.com/external/article/337576/cleaning-up-decommissioned-srm-registrations.html)
- [Machine ID mismatch between VMAFD and the Likewise registry (KB 312479)](https://knowledge.broadcom.com/external/article/312479)
- [STS connection string is incorrect (KB 323195 / legacyId 91965)](https://knowledge.broadcom.com/external/article?legacyId=91965) – `vmwSTSConnectionStrings` drift and the `fix_sts_attrs.py` remediation
- [cs.identity Missing Node ID (KB 448977)](https://knowledge.broadcom.com/external/article/448977) – the post-9.1.0.x upgrade Lookup Service registration defect, `regen_csidentity.sh`, and the SSO login failure it causes if left unresolved (KB itself is silent on the pre-upgrade FAIL this doc also documents)
