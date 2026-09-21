# Patching an existing VCF 9.1 fleet (maintenance releases)

**This is about applying a maintenance release to a fleet already
running VCF 9.1** – e.g. 9.1.0.x → 9.1.1 – not the initial 5.2/8.x → 9.x
upgrade, which is its own much larger project covered in [Full VCF
upgrade sequence](13-vcf-upgrade-sequence.md). Patching is smaller in
scope but has its own strict component ordering, separate from that
9-phase spine.

Applies to VCF and VVF alike for the depot/binary mechanics; the
component patching order below is VCF-specific (SDDC Lifecycle, NSX,
Fleet-Management-driven components) – a standalone VVF fleet has fewer
of these components to sequence in the first place.

---

## Two kinds of patch in 9.1: maintenance releases vs. Express Patches

9.1 introduced **Express Patches (EPs)** as a faster delivery mechanism
alongside full maintenance releases, and they follow different rules:

- **Maintenance release** (e.g. 9.1.0 → 9.1.1) – the scenario this doc
  covers. Strict component dependency order, covered below.
- **Express Patch** – targeted security/product fixes shipped as soon as
  they're ready rather than bundled into a scheduled release, named
  `9.1.0.01XX` (e.g. `9.1.0.0100`, `9.1.0.0200`, `9.1.0.0300`).
  **Express Patches can be applied in any order** – each is independent
  and cumulative, so there's no need to apply earlier EPs first before a
  later one. The one exception: *"if an EP contains Fleet Lifecycle
  fixes, you should consider applying that first since that is what
  drives the actual patch and upgrade for the VCF Fleet components."*
  Apply via **Build → Lifecycle → VCF Management → Upgrade** → **Sync**
  to refresh available patches → **Change Target Version → Customize**
  to pick a specific EP. Per [Understanding VCF Express
  Patches](https://williamlam.com/2026/07/vcf-9-1-understanding-vcf-express-patches.html).

The rest of this doc is about the maintenance-release case, which does
have a strict order.

---

## Step 1: Get the binaries in place

Nothing below can start until the target version's binaries are staged
in the software depot – **online** (Fleet Management connects straight
to Broadcom) or **offline** (an internal web server, populated ahead of
time). Only one depot connection can be ACTIVE at a time.

**Building the offline depot web server itself is a one-time,
foundational task** – standing up the box, the TLS cert (SAN, not just
CN), the auth split (`PROD/COMP` and `PROD/metadata` behind basic auth,
`PROD/vsan/hcl` and `umds-patch-store` open), and the initial activation
code registration. That's covered in full, field-verified detail in the
companion repo's [Binary Depot – Offline Depot & the VCF Download
Tool](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/) –
build it there if it doesn't already exist, then come back here for the
patching-specific part below.

**What's specific to patching an already-deployed fleet** (as opposed to
the initial install) is different enough to call out on its own:

### Filling the depot for a fleet upgrade – the loop

The install-time depot fill and a Day-N patch fill draw on **different
binary sets**, and VCF Operations' UI doesn't spell out how to get the
patch set – it hands you a spec file and a one-line hint. The loop:

1. **Sync the lifecycle metadata first.** The Upgrade page shows *Last
   lifecycle metadata sync time* with a **Sync** link – if it reads
   `N/A`, sync it and confirm a real timestamp before going further;
   binary availability is evaluated against that metadata.
2. **CHECK BINARY AVAILABILITY** – tells you what the fleet needs and
   what the depot is missing. This is the authoritative answer, not
   anything the CLI reports on its own.
3. **EXPORT DOWNLOAD SPECIFICATION** if you want the exact subset for
   this hop – produces a `manage-binaries.json` file and the
   instruction "use it with the VCF Download Tool to obtain these
   binaries." **It never names the flag** – it's
   `--download-spec-file`.
4. **Download** (below), into the depot store the fleet is actually
   registered against – it's easy to accidentally fill a staging
   directory nobody reads.
5. **Re-run CHECK BINARY AVAILABILITY.** Still reporting gaps after a
   successful download? Suspect the metadata sync or the depot path,
   not the binaries themselves.

**Three ways to actually pull the binaries**, in order of precision:

**A – the spec file** (least guesswork):

```bash
./vcf-download-tool binaries download \
  --download-spec-file /root/manage-binaries.json \
  --depot-download-activation-code-file /root/reg.txt \
  --depot-store /depotdata \
  --proxy-server <fqdn:port>
```

**B – a filtered catalog pull**, no spec file, but **the size trade is
not small**: a bare release line returns *every* patch line at once –
`9.1.0.0`, `.0100`, `.0200`, `.0300`, `.0400` – so a single point
upgrade can drag in four vCenter builds at ~28.7 GiB each, comfortably
over 100 GiB for one hop if left unfiltered:

```bash
./vcf-download-tool binaries download --sku VCF --vcf-version 9.1.0 \
  --type UPGRADE --depot-store /depotdata \
  --depot-download-activation-code-file /root/reg.txt \
  --proxy-server <fqdn:port>
```

**C – by binary ID** (the middle ground – no spec file, no superfluous
lines either): list first with `binaries list`, take the IDs for the
release wanted, feed them back with `--id=<id1>,<id2>,<id3>`.

Key filters (`--vcf-version` accepts ranges like `9.1.0..9.1.1`;
`--component` takes `VCENTER`, `SDDC_MANAGER_VCF`, `NSX_T_MANAGER`,
`ESX_HOST`, `VROPS`, `VRLI`, `VRNI`, `VSP`, and others; `--type` is
`INSTALL` or `UPGRADE` only – there's no `PATCH` type, though `UPGRADE`
rows display as `PATCH`). Run long pulls detached (`screen`/`nohup`) and
watch `<toolroot>/log/vdt.log` – the tool has its own free-space
precheck and refuses rather than filling the disk.

### The gotcha that looks nothing like a depot problem

**A fresh download lands root-owned; nginx (or whichever web server)
can't read it, and answers 403 – but the fleet never surfaces a 403.**
Instead, a VCF Operations upgrade precheck fails at subtask **Stage
Precheck Binaries** with a generic `ops.task.stage.failed` – that
task's only job is fetching bits, so a failure there is a
binary-delivery problem, not an environment-readiness one, even though
nothing about the error says "permissions." Re-apply ownership after
**every** download, not just the initial build:

```bash
chown -R nginx:nginx /var/www/offline_depot
chmod -R a+rX /var/www/offline_depot
```

(Capital `X` sets execute on directories only, so directories stay
traversable and files stay non-executable.) The durable fix – a systemd
path unit that re-applies this automatically on every write to the
store, so it stops depending on someone remembering – is in the
companion repo's [depot doc, §6](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/#gotcha-a-fresh-download-lands-root-owned--nginx-403s-and-the-precheck-fails).

### A disconnected depot doesn't auto-fetch Day-N binaries either

Optional components added after initial bring-up (Log Management,
Real-time Metrics, VCF Operations for Networks) or a new VCF
Instance/domain need their own manual binary upload – not covered by
whatever was staged for the original install or a routine patch cycle.

### Reclaiming space

`binaries cleanup` takes the same filter groups as `download`
(`--vcf-version`, `--id`, or `--download-spec-file`, mutually
exclusive). **Always use the exact four-part version** when pruning one
line – a short version string matches broadly on `cleanup` too, and
there's no `--dry-run`; preview with `binaries list` using the same
filters first:

```bash
./vcf-download-tool binaries cleanup --depot-store=/depotdata \
  --vcf-version=9.1.0.0100 --type=UPGRADE
```

Safest to remove, in order of confidence: superseded patch lines you
won't roll back to, then `INSTALL` bundles for components already
deployed – but keep the ESX install bundle if a future host
commissioning or cluster add is still possible.

---

**A depot patch blocks every other component patch while it's in
progress** – per Broadcom's [Lifecycle Management of VCF
Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html),
*"patching other components is blocked because the patch binaries are
unavailable."* Don't schedule a depot update alongside anything else,
and **download every component's binaries before starting** the order
in Step 2 – running out partway through stalls the whole sequence.

---

## Step 2: Respect the mandatory dependency order

Quoted verbatim from Broadcom's [Lifecycle Management of VCF
Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html)
TechDocs – these are hard constraints for a 9.1.0.x → 9.1.1 patch, not
suggestions:

- *"You begin applying the 9.1.1 maintenance release in your 9.1.0.x
  environment by patching the VCF management services fleet lifecycle
  component to 9.1.1 before any other VCF component."* Fleet Lifecycle
  always goes first.
- *"VCF Operations must not be patched in parallel with other
  components."* Serialize it – don't batch it alongside anything else,
  and don't start other lifecycle operations while it's running.
- *"Before you patch ESX hosts from 9.1.0.x to 9.1.1.0, you must first
  patch the VCF Operations instance and the license servers connected
  to it."* Cloud Proxy and License Server patch automatically as part
  of the VCF Operations patch – no separate step for either.
- *"Before you patch an identity broker instance from 9.1.0.x to
  9.1.1, you must first patch the respective VCF management services
  runtime that hosts the identity broker instance."*
- *"Before you patch Salt RaaS from 9.1.0.x to 9.1.1, you must first
  patch the respective VCF management services runtime that hosts the
  Salt RaaS instance."* Same rule as Identity Broker: the runtime
  hosting a service patches before that service.
- *"Before you patch the migration service engine component from
  9.1.0.x to 9.1.1, you must first patch VCF Automation."*

### The full 9.1.1 order in practice

A practitioner's documented, component-by-component 9.1.0.x → 9.1.1
patching run – [Upgrading VCF Management Components to 9.1.1 All in One
(Cosmin.us)](https://cosmin.us/upgrading-vcf-management-components-to-9-1-1-all-in-one/)
– consistent with the constraints above and specific to 9.1.1 (not the
9.0.x line) – **not independently field-verified in this repo, but the
closest thing to a full worked example currently available**:

1. **Fleet Lifecycle** – required first, no exceptions
2. **VCF Operations** – as its own standalone appliance update
3. **VCF Services Runtime** – before Identity Broker or Salt RaaS on
   that same instance
4. **SDDC Lifecycle** – before scaling Services Runtime from Small to
   Small (High Availability), if that's planned
5. **VCF Automation** – before the Migration Service Engine
6. **Migration Service Engine** (VCD_MIGRATOR)
7. **Identity Broker** – only after its Runtime is already on 9.1.1
8. **Salt RaaS** – only after its Runtime is already on 9.1.1
9. **Salt Master** – after Runtime
10. **Log Management** – before Operations for Networks
11. **Operations for Networks** – sequentially after Log Management, not
    in parallel with it (see gotchas below)
12. **Real-Time Metrics Store**
13. **Real-Time Metrics**
14. **Telemetry** – last

**Do not use an "Upgrade (ALL)" button if one is offered.** Broadcom
documents a 9.1 lifecycle issue where running components concurrently
can interfere with plan records – a component can finish successfully
but stay stuck showing "Ready for upgrade" even though both sides
already match on build. Patch sequentially and wait for each task to
show **Completed** before starting the next.

---

## Step 3: The UI walkthrough, per component

1. **Build → Lifecycle → VCF Management → Upgrade.**
2. Confirm the target version is set to the correct **9.1.1.\*** build.
3. Filter to and select a **single component row** – not multiple at
   once, per the concurrency warning above.
4. **Run Prechecks** – open **Precheck details** and remediate anything
   flagged. A warning here is the patch telling you what it's about to
   trip on; don't proceed past a red precheck.
5. Confirm the row shows **Ready for upgrade**.
6. Click **Upgrade**, open **Upgrade details**, and wait for
   **Completed** – including the final inventory sync, don't consider it
   done the moment the progress bar stops moving.
7. **Build → Lifecycle → VCF Management → Components** – verify the
   component shows **Running** and the expected target build before
   moving to the next component in the order above.

**Domain-level patching** (NSX, vCenter, ESX per workload domain) uses a
slightly different flow: navigate to the VCF domain, **Plan Upgrade**,
select the target version, confirm the change summary, then run through
the same precheck → remediate → upgrade cycle per domain.

---

## Known gotchas for a 9.1.0.x → 9.1.1 patch

- **Log Management and Operations for Networks running in parallel can
  cause issues** – per Broadcom [KB 388305, "Parallel Deployment of VCF
  Operations Networks and VCF Operations Logs from Fleet Management
  fails while Pushing
  Capabilities"](https://knowledge.broadcom.com/external/article/388305/parallel-deployment-of-vcf-operations-ne.html).
  This is exactly why the order above puts Log Management strictly
  before Operations for Networks, not just conveniently near it.
- **VCF Automation 9.1.1 deprecates AWS/Azure/GCP support by default**
  (Broadcom KB 448993 – no direct URL confirmed, search the Broadcom
  Support Portal for the number) – confirm this doesn't affect an
  in-use integration before patching.
- **Custom VCF Automation profiles carried over from 9.0.x/9.1.0.x must
  be cleaned up before the upgrade** (Broadcom KB 451147 – no direct
  URL confirmed, search the Broadcom Support Portal for the number), or
  the patch can fail against them.
- **Operations for Networks XL deployments may need an additional 1TB
  disk** added before patching – per Broadcom [KB 400822, "VCF
  Operations for Networks reports Appliance disk not configured
  according to disk
  guidance"](https://knowledge.broadcom.com/external/article/400822/aria-operations-for-networks-reports-app.html),
  an X-Large deployment needs a manually-added extra 1TB disk to meet
  the XL brick size's 2TB requirement. Check sizing ahead of time, not
  after the patch stalls on disk space.
- **If planning to scale VCF Services Runtime from Small to Small (High
  Availability)**, patch SDDC Lifecycle to 9.1.1 first – doing it the
  other way round is unsupported per the order above.

---

## Rough timing, per component

From the same 9.1.0.x → 9.1.1 practitioner run referenced above – treat
as a planning reference, not a commitment (see the general caveat about
per-component time estimates in [Full VCF upgrade sequence: Windows,
ordering and rollback](13-vcf-upgrade-sequence.md#windows-ordering-and-rollback)):

| Component | Rough duration |
| --- | --- |
| Fleet Lifecycle | ~15-20 min |
| VCF Services Runtime | ~5 hr 45 min (full workflow) |
| SDDC Lifecycle | ~15 min prechecks, ~49 min upgrade |
| Log Management | ~1 hr 11 min |
| Operations for Networks | ~2 hr 9 min |
| Real-Time Metrics Store | ~44 min |
| Real-Time Metrics | ~47 min |
| Telemetry | ~44 min |

---

## Sources

- [Binary Depot – Offline Depot & the VCF Download Tool (VCF9-DeploymentPlanning)](https://vcf-planning.hollebollevsan.nl/docs/09-binary-depot/) – the companion repo's full, field-verified offline-depot build-out and the Day-N "filling the depot for a fleet upgrade" procedure Step 1 draws on above
- [Lifecycle Management of VCF Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/lifecycle-management-of-vcf-components.html) – the mandatory dependency-order quotes in Step 2
- [Configure a Software Depot Connection Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/connect-sddc-manager-to-a-software-depot-for-downloading-bundles.html)
- [Set Up an Offline Depot](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/set-up-an-offline-depot-web-server-for-vmware-cloud-foundation.html)
- [Download Binaries to an Offline Depot by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/download-bundles-to-an-offline-depot.html)
- [Download Binaries to Software Depot in Disconnected Mode by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/offline-download-of-vmware-cloud-foundation-5-2-upgrade-bundles.html)
- [VCF 9.1 - VCF Download Tool (VCFDT) Cheatsheet](https://williamlam.com/2026/05/vcf-9-1-vcf-download-tool-vcfdt-cheatsheet.html) – concrete VCFDT command examples
- [VCF 9.1 - New HTTP Offline Depot Support for VCF Installer & Fleet Depot Service](https://williamlam.com/2026/05/vcf-9-1-new-http-offline-depot-support-for-vcf-installer-fleet-depot-service.html)
- [VCF 9.1 - Understanding VCF Express Patches](https://williamlam.com/2026/07/vcf-9-1-understanding-vcf-express-patches.html) – the Express Patch mechanism, naming, and application rules
- [Upgrading VCF Management Components to 9.1.1 All in One (Cosmin.us)](https://cosmin.us/upgrading-vcf-management-components-to-9-1-1-all-in-one/) – the full 14-step worked order, UI walkthrough, gotchas (KB 388305, 448993, 451147, 400822), and timing table – a practitioner account, not a Broadcom TechDocs page
