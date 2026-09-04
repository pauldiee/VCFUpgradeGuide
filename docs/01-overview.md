# Overview

General guidance for planning a **VMware Cloud Foundation (VCF) upgrade** –
pre-upgrade checks, the upgrade sequence, and post-upgrade validation –
applicable regardless of underlying hardware. Hardware/HCI-specific extra
steps (currently: **Dell VxRail**, see [VxRail Addendum](vxrail-addendum.md))
are layered on top as their own addendum, not baked into this flow, so the
core guidance stays reusable across engagements.

> **Status: draft.** The phase *ordering and conditionality* below is
> verified against the [VCF Upgrade Planner](https://vmware.github.io/vcf-upgrade-planner/)
> (run 2026-08-27, target build 9.1.0.0400). **VCF 9.1.1 went GA on
> 2026-09-03** – that run predates it, so re-run the planner and the
> interoperability matrix for a 9.1.1 target build. Per-phase procedure
> detail, IP counts, and version numbers are transcribed from the planner and
> the supplementary guides and **must be re-confirmed verbatim against
> Broadcom TechDocs** (and against your actual target build) before being
> treated as authoritative. Sources: [`reference/sources.md`](../reference/sources.md).

---

## Contents

- [How to use this doc](#how-to-use-this-doc)
- [What changes in VCF 9.x](#what-changes-in-vcf-9x)
- [Before you start](#before-you-start)
  – [supported path](#confirm-a-supported-upgrade-path)
  · [target build](#pin-a-target-build)
  · [prerequisites & guardrails](#prerequisites-and-architectural-guardrails)
  · [pre-upgrade precheck](#run-the-pre-upgrade-precheck)
- [The upgrade sequence](#the-upgrade-sequence) – Phases 1–9: VCF Operations →
  SDDC Manager → Management Services + License Server → VCF Automation → NSX
  Local Manager → vCenter → ESX / host → NSX finalize → effective versions
- [Windows, ordering and rollback](#windows-ordering-and-rollback)
- [Conditional phases (optional components)](#conditional-phases-optional-components)
  – [NSX Federation](#nsx-global-manager--federation-in-detail)
  · [NSX Edge & Finalize](#nsx-edge--nsx-finalize-in-detail)
  · [vSphere Supervisor](#vsphere-supervisor-in-detail)
  · [Avi + License Hub](#avi-load-balancer--license-hub-in-detail)
  · [Log Management](#post-infrastructure-products--log-management-in-detail)
  · [vSAN File Service](#vsan-file-service-in-detail)
  · companion docs: [Disaster Recovery](02-disaster-recovery.md)
  · [Identity Broker migration](03-identity-broker-migration.md)
- [Post-upgrade validation](#post-upgrade-validation)
- [Cleanup / decommission](#cleanup--decommission)
- companion doc: [Field notes – known issues and gotchas](04-field-notes.md)
- [Hardware addenda](#hardware-addenda) – [VxRail Addendum](vxrail-addendum.md)

---

## How to use this doc

1. Work through **[Before you start](#before-you-start)** – confirm your
   source is on a supported path, pin a target build, run the planner, and
   clear every prerequisite and precheck.
2. Execute **[The upgrade sequence](#the-upgrade-sequence)** phase by phase.
   Every phase boundary is a **safe stopping point** – pause there to
   validate before continuing.
3. Insert any **[conditional phases](#conditional-phases-optional-components)**
   your fleet needs (Avi, SRM, HCX, NSX Federation, Log Management, …) at the
   points shown.
4. Apply your hardware addendum where it cross-links a phase
   (VxRail: [VxRail Addendum](vxrail-addendum.md)).
5. Finish with **[Post-upgrade validation](#post-upgrade-validation)** and
   **[Cleanup](#cleanup--decommission)**.

Keep **[Field notes](04-field-notes.md)** open alongside – the list of things
that went wrong on real upgrades and how they were cleared.

---

## What changes in VCF 9.x

A 5.2 → 9.1 upgrade is more than a version bump. What is structurally new –
know these before planning the sequence:

- **The fleet construct.** VCF Operations manages a *fleet* of VCF instances.
  For a 5.2.x source the planner labels the upgrade **"Create New VCF 9.1
  Fleet"** – still an in-place upgrade of the existing environment; the
  wording reflects the new construct. A 9.0.x source uses "Expand existing
  VCF Fleet by upgrading the current instance".
- **VCF Management Services + a headless License Server** (Phase 3) – a new
  cluster hosting Fleet Lifecycle and SDDC Lifecycle services. It **replaces**
  the standalone 9.0 Fleet Management Appliance and **consolidates** the
  standalone Identity Broker.
- **Subscription licensing** – no perpetual model, no 25-character keys;
  managed through VCF Operations and the VCF Business Services console.
- **VCF Identity Broker replaces VIDM / Workspace ONE Access** as the fleet
  identity layer – not an in-place upgrade
  ([detail](#identity-vidm--workspace-one-access--vcf-identity-broker)).
- **vLCM images only** – baseline / VUM-managed clusters are not supported in
  vSphere 9; convert them first.
- **Unified Cloud Proxy** – one appliance for VCF Operations, Operations for
  Logs, and the SDDC integration; legacy per-purpose 8.18 Cloud Proxies do not
  upgrade in place.
- **Operations for Logs has no in-place upgrade path** – it is a fresh 9.1
  deployment plus content re-import.
- **Behaviour changes** – vCLS deactivated by default; vCenter syslog on TLS
  port 1514; vCenter root password 15–20 characters.

---

## Before you start

### Confirm a supported upgrade path

The **[VCF Upgrade Planner](https://vmware.github.io/vcf-upgrade-planner/)** is
the first stop. Feed it your current deployment (vSphere vs VCF), installed
components and their **exact** versions, your goal, and a target build; it
returns a phase-by-phase plan, the networking/resource requirements, and an
add-on compatibility pre-check.

Supported **source** versions for a 9.1 upgrade (confirm on the release
notes – [Upgrade Sequence to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-0-0-release-notes/upgrade-sequence-to-91.html)):

- VCF 5.2.x / vSphere Foundation 5.2.x
- VCF 9.0.x / vSphere Foundation 9.0.x
- vSphere 8 + Aria Operations 8

> **The source patch level matters – per component, not just SDDC Manager.**
> Broadcom qualifies the 9.1 upgrade **from a specific source version** for
> each product, and the *next* patch after that qualified level often has **no
> path to any 9.x build yet** – a patch **released after a target build**
> upgrades *backwards* to it ("back in time"), which is unsupported. Observed
> against 9.1.0.0x00: SDDC Manager 5.2.2
> upgrades directly but 5.2.3.0 / 5.2.4.0 do not; VCF Operations 8.18.6
> upgrades directly to a 9.1.0.0x00 build but **8.18.7 skips the 9.1.0 line
> entirely – its only 9.x target is 9.1.1.0** (Upgrade Path tool, checked
> 2026-09-04); Operations for Networks 6.14.1 reaches 9.1.0.0100 but not
> 9.1.0.0200, and 6.14.3 has no 9.x path.
> **Applying "the latest patch" as preparation can strip the qualified path.**
> Stay on the version that already has a direct path; only patch a component
> when the matrix shows the current version is *below* the floor.

Check each component in the **[Broadcom Product Interoperability
Matrix](https://interopmatrix.broadcom.com/)** before committing to a date:

- **Upgrade Path** tool – source version → target build, per product. Untick
  "Hide Patch Releases" to see the patch-level rows.
- **Interoperability** tool – "does product A version X work with product B
  version Y" (for example Protection and Recovery vs. the running vCenter /
  ESX / VCF Operations).

The matrix moves. Re-run every check when a new point release ships (see
[Pin a target build](#pin-a-target-build)).

### Pin a target build

VCF 9.1 shipped as patch builds **9.1.0.0, 9.1.0.0100, 9.1.0.0200,
9.1.0.0300, 9.1.0.0400**; **VCF 9.1.1 went GA on 2026-09-03**, adding newly
supported source patch levels and its own target build. If an engagement
calls for "9.1.1":

- **Re-verify everything against the matrix** for the 9.1.1 target. A point
  release re-qualifies **both** the supported *source* versions and the
  *target* builds – it is not "a smaller step" on top of a 9.1.0 plan. Target
  builds, per-component upgrade paths, and the effective versions below all
  change.
- A component already qualified against a 9.1.0.0x00 build is **not**
  automatically qualified against 9.1.1 – re-run the Upgrade Path tool per
  component.

Do not carry a loose "9.1.1" into a runbook; always resolve it to a concrete
build number.

> **A component can force the wait.** If a running component sits at a patch
> level with no path to the current target, and rolling it back would lose
> data (historical metrics), the whole engagement may have to wait for the
> point release that adds that path. This is exactly what **VCF Operations
> 8.18.7** did: no path to any 9.1.0.x build, resolved only by 9.1.1.0
> (Upgrade Path tool, 2026-09-04). Check this early.

### Prerequisites and architectural guardrails

Clear all of these **before** Phase 1. Re-confirm each against TechDocs for
your target build.

| Area | Requirement |
| --- | --- |
| **Fleet health** | Healthy source fleet; no failed workflows; all SDDC Manager prechecks green |
| **Backups** | vCenter file-based backup configured; SDDC Manager + VCF Operations image-based backups to an external SFTP target |
| **vSphere Lifecycle Manager** | All clusters managed by **vLCM images** – transition any remaining baseline-managed clusters first |
| **DNS** | Strictly **lowercase** forward *and* reverse records for every existing and new name |
| **vCenter root password** | **15–20 characters** (new 9.1 standard) |
| **Management Services IP block** | Free **/28 CIDR minimum** on the management network (or a dedicated network); **12 IPs minimum, 30 recommended**. FQDNs for: Fleet component service, Instance component service, VCF services runtime, Identity Broker, License Server |
| **Internal runtime range** | VCF services runtime uses **198.18.0.0/15** internally – must not overlap the management network. Changeable to 240.0.0.0/15 or 250.0.0.0/15 **only** via the deployment JSON spec |
| **vCenter temp IPs** | A temporary IP per vCenter for the reduced-downtime upgrade |
| **vSAN HCL** | Update the vSAN Hardware Compatibility database |
| **Certificates & passwords** | All component certs valid and not near expiry; all managed credentials valid |
| **Syslog** | vCenter syslog moves to **TLS on port 1514** |
| **vCLS** | vSphere Cluster Services is **deactivated by default** in 9.x – expect the behaviour change |
| **Licensing** | VCF 9 is **subscription-only** – no perpetual model, no 25-character keys; managed through VCF Operations and the **VCF Business Services console**. A valid term subscription with the required capacity must be in place **before** the upgrade window. VCF Operations must be licensed within **90 days** of upgrade; the License Server is deployed during Phase 3 |

Cross-references in the sister repo (foundational VCF9 detail that also
applies during an upgrade – don't duplicate it here):

- Firewall flows by zone – `VCF9-DeploymentPlanning/docs/07-firewall-ports.md`
- Certificate-authority setup – `VCF9-DeploymentPlanning/docs/prerequisites.md`
- Fleet SSO / Identity Broker – `VCF9-DeploymentPlanning/docs/12-sso-configuration.md`
- Ordered fleet shutdown/startup – `VCF9-DeploymentPlanning/docs/13-shutdown-startup.md`

### Run the pre-upgrade precheck

Run the **upgrade precheck in SDDC Manager** and resolve every error before
starting. Component-specific prechecks (VCF Automation especially) run again
inside each phase – a green fleet precheck is the entry gate, not the whole
story.

---

## The upgrade sequence

Core spine for a **fleet with core components only** – **9 phases / 10
steps**. Each phase is a safe stopping point. For each phase, follow the
linked Broadcom TechDocs procedure; this doc gives the *order*, the *gotchas*,
and *what to validate before moving on*.

> Numbers below (node counts, sizes, effective versions) are from the planner
> at target **9.1.0.0400** – re-confirm for your build.

### Phase 1 – VCF Operations upgrade

Upgrade the **VCF Operations instance that manages the fleet** first. VCF
Operations is a **required component** in 9.x and must be on the target build
**before the SDDC Manager upgrade begins**. On a 5.2.x source this is the
transition **from Aria Operations** (via vRSLCM) to VCF Operations 9.1.

- **Unified Cloud Proxy** (also **Universal Cloud Proxy / UCP**). 9.1 collects
  for VCF Operations, Operations for Logs, and the SDDC Manager / VCF
  Management integration from a **single** Cloud Proxy appliance (1 node, 1 IP)
  in the first VCF Instance. **Legacy 8.18 vRealize Operations Cloud Proxies
  do not upgrade in place** into the unified model – deploy the new proxy and
  reconfigure the collection paths from SDDC Manager alongside this phase.
  **The upgrade plan does not deploy the UCP for you** – and log-data transfer
  from the old Operations for Logs needs a UCP in *split-proxy* mode
  ([field notes](04-field-notes.md#observability--cloud-proxy-logs-networks)).
- **Operations for Logs has no in-place upgrade to 9.x** – it is a fresh
  deployment regardless of source. Redeploy at 9.1 and re-import content
  packs, forwarding, agents, and RBAC. Plan it as its own step, not part of
  the Operations upgrade (see [conditional phases](#conditional-phases-optional-components)).
- **vRSLCM / Aria Suite Lifecycle is not upgraded in place.** Its lifecycle
  role is absorbed by VCF Operations fleet management and the VCF Management
  Services; its VIDM-management role disappears when VIDM is replaced by
  Identity Broker. Retire it after the Aria → VCF component migration is
  confirmed (see [Cleanup](#cleanup--decommission)).

**Before moving on:** VCF Operations reachable and healthy; metrics still
flowing through the (unified) Cloud Proxy.

### Phase 2 – SDDC Manager upgrade

Upgrade **SDDC Manager** to the target build using the pre-9.1 SDDC Manager
UI. This is where the 9.1 fleet-management UI and the new upgrade workflow
appear; from here on, **NSX and vCenter are driven from SDDC Manager / VCF
Operations Fleet Management**, not their own upgrade tools. Re-run the fleet
precheck afterwards.

**Before moving on:** SDDC Manager UI healthy; inventory intact; prechecks
still green.

### Phase 3 – Deploy VCF Management Services + License Server

Deploy the new **VCF Management Services** cluster and the headless
**License Server**, then transfer licenses onto the new infrastructure. This
layer is new in 9.x – it hosts Fleet Lifecycle and SDDC Lifecycle services
that **replace** the standalone 9.0 Fleet Management Appliance and consolidate
the standalone Identity Broker.

Sizing (planner, target 9.1.0.0400):

| Component | Size | Nodes | vCPU | Memory | Storage |
| --- | --- | --- | --- | --- | --- |
| VCF Management Services nodes | Small | 4 | 12 | 24 GB | 3,000 GB |
| License Server | Small | 1 | 2 | 4 GB | 12 GB |

Extra IPs (up to 18 more, 30 recommended total) can be added later in the
VCF Operations Lifecycle UI as CIDR or individual IPs – they need not be
contiguous.

**Before moving on:** Management Services cluster healthy; License Server
reachable; licenses assigned; vCenter(s) still show valid licensing.

### Phase 4 – VCF Automation upgrade *(if VCF Automation / Aria Automation is present)*

Upgrade **VCF Automation** (8.18.x → 9.1). A new instance is deployed; the
existing FQDN and node IPs are auto-transferred as VIPs, and an existing
external load balancer needs no config change. **VCF Automation must reside
on the management cluster** before VCF can upgrade it. Ensure enough
resources for all Automation components.

**Before moving on:** Automation portal reachable at its original FQDN;
catalog/deployments intact.

### Phase 5 – NSX Local Manager upgrade

Upgrade the **NSX Local Manager(s)**. Check the **VMware Product
Interoperability Matrix** first. *(If NSX Federation is in play, the NSX
Global Manager upgrade comes first – see [conditional phases](#conditional-phases-optional-components).)*

**Before moving on:** NSX management plane healthy; no alarms; overlay intact.

### Phase 6 – vCenter upgrade

Upgrade **vCenter** via **VCF Operations → Fleet Management** – the
installer-UI upgrade path is deprecated. Gotchas:

- **Integrated Windows Authentication is removed in vCenter 9.** Dissolve the
  Active Directory domain join before upgrading – unjoin gracefully per
  KB 373004; move to another IdP configuration.
- **RDU (reduced-downtime upgrade) rollback**, if it fails: shut down the
  target vCenter → run the script to stop the RDU → roll back the 8.0
  vCenter Workspace ONE broker precheck change → reboot vCenter.
- After the upgrade, re-check the vCenter Lifecycle Manager **depot token** –
  it can silently stop matching SDDC Manager's, and ESXi images vanish from
  the vCenter depot ([field notes](04-field-notes.md#entitlement-and-the-depot-download-token)).

**Before moving on:** vCenter on the target build; ELM (if used) intact; all
hosts connected.

### Phase 7 – ESX / host-cluster upgrade

Upgrade **ESX hosts** cluster by cluster via rolling maintenance mode, plus
any **vSAN witness** hosts.

> **Hardware addendum replaces or wraps this phase.** On **Dell VxRail**,
> host/firmware/driver upgrades are delivered as a Dell-validated VxRail
> bundle and driven by Dell – **do not** use the online VxRail Manager UI /
> vCenter plugin path. See **[VxRail Addendum](vxrail-addendum.md)**.

**Before moving on:** all hosts on the target build; vSAN healthy;
resync complete; no HCL warnings.

### Phase 8 – NSX finalize

Run the **NSX upgrade finalization** step. *(With NSX Edge nodes present,
Edge upgrade + finalize happen together here – see
[NSX Edge & Finalize in detail](#nsx-edge--nsx-finalize-in-detail).)*

**Before moving on:** NSX upgrade marked complete; Edge/transport nodes
healthy.

### Phase 9 – Effective versions (reference)

Not an action – a check. At target **9.1.0.0400** the planner reports these
*effective* builds (a component without a patch for the exact build reflects
its highest available version):

| Component | Effective build @ 9.1.0.0400 |
| --- | --- |
| vCenter Server | 9.1.0.0300 |
| ESX / vSphere | 9.1.0.0200 |
| NSX Local Manager | 9.1.0.0200 |
| SDDC Manager | 9.1.0.0400 |
| VCF Operations | 9.1.0.0400 |
| VCF Automation | 9.1.0.0200 |

Confirm each component landed on its expected build.

---

## Windows, ordering and rollback

- **Method.** The upgrade runs **sequentially** – one component, one domain at
  a time. Management domain first, then each workload domain, repeating the
  same phase order.
- **Windows.** Size the window per domain, not for the whole estate, and split
  it into an **unattended block** (host / firmware remediation – the bulk of
  the elapsed time) and **attended blocks** around it (the VCF Operations
  upgrade, config updates, prechecks, DR re-test). A single VxRail management
  + workload domain pair has run to roughly 80 hours end to end.
- **Safe stopping points.** Every phase boundary is a safe stop – run the
  "before moving on" checks, then either continue or pause. Do not stop
  mid-phase.
- **Rollback.** SDDC Manager and NSX upgrades are **not cleanly reversible** –
  the backout position for those phases is restore-from-backup, so the
  pre-upgrade backups must be verified first. vCenter has a reduced-downtime
  upgrade rollback path (Phase 6). ESX / host upgrades roll forward. Agree the
  per-phase backout position before the window.
- **Prechecks are a loop.** The fleet precheck is the entry gate; component
  prechecks re-run inside each phase. Expect to iterate – clear, re-run,
  proceed.

---

## Conditional phases (optional components)

When optional components are present the planner expands the plan (example:
SRM + Avi + HCX + NSX Federation + vSphere Supervisor + VCF Operations for
Logs + vSAN File Service → **15 phases / 17 steps**). The inserts and where
they slot into the core spine:

| Inserted phase | Position | Notes |
| --- | --- | --- |
| **Disaster Recovery Products** | before the core (ahead of SDDC Manager) | Converge SRM / vSphere Replication to **Protection and Recovery** – own doc: [Disaster Recovery](02-disaster-recovery.md) |
| **Upgrade Avi Load Balancer + Deploy License Hub** | after DR Products, before SDDC Manager | See [Avi + License Hub in detail](#avi-load-balancer--license-hub-in-detail) |
| **VMware HCX** | after VCF Automation | Upgrade HCX before the NSX/vCenter/host tier |
| **NSX Global Manager upgrade** | before NSX Local Manager | **NSX Federation only.** See [NSX Federation in detail](#nsx-global-manager--federation-in-detail) |
| **vSphere Supervisor** | after vCenter (Phase 6), before the ESX host phase (Phase 7) | See [vSphere Supervisor in detail](#vsphere-supervisor-in-detail) |
| **NSX Edge & NSX Finalize** | replaces the plain "NSX finalize", after the host phase | Edge nodes upgraded last, after ESX/host kernels, then finalize. See [NSX Edge & Finalize in detail](#nsx-edge--nsx-finalize-in-detail) |
| **Post-Infrastructure Products → Log Management** | after NSX finalize (after Operations for Networks, before Identity Broker) | Deploy fresh Log Management as part of VCF Management Services. See [Log Management in detail](#post-infrastructure-products--log-management-in-detail) |
| **Operations for Networks** (vRNI / Aria Operations for Networks) | with the operations tier | Upgrade-path is version-gated – e.g. 6.14.1 reaches 9.1.0.0100 but not 9.1.0.0200 directly, and the newest 6.14.x may have no 9.x path. Collector nodes are version-locked to the platform – redeploy / re-pair |
| **vSAN File Service** | after Log Management, after the vSAN on-disk format upgrade | Rolling File Service agent (OVF) refresh, driven from the vSphere Client. See [vSAN File Service in detail](#vsan-file-service-in-detail) |

Re-run the planner with the real component list for the authoritative
insert points.

Two of the conditional workstreams have their own docs:

- **[Disaster Recovery](02-disaster-recovery.md)** – SRM / vSphere Replication
  convergence to VCF Protection and Recovery (runs *before* the core upgrade).
- **[Identity Broker migration](03-identity-broker-migration.md)** – VIDM /
  Workspace ONE Access → VCF Identity Broker (runs *after* the core upgrade).

### NSX Global Manager / Federation in detail

**NSX Federation** = one or more **NSX Global Manager** clusters (Active +
Standby) coordinating the NSX Local Manager instances across sites. Detect it
from NSX Manager (**System → Location Manager**), from the presence of Global
Manager appliances, or from the Dell Technical Consultation checklist ("NSX
Federation: Yes / No").

- **Order.** The Global Managers upgrade **before** the Local Managers – the
  upgrade coordinator does the GM cluster (standby node first, then active).
  Only then does the Local Manager phase (core [Phase 5](#phase-5--nsx-local-manager-upgrade))
  run, followed by Edge and finalize.
- **Prerequisites.** Every site's NSX on a version the target supports
  (check the interoperability matrix); inter-site tunnel / RTEP connectivity
  healthy; a fresh Global Manager backup.
- **In a VCF context** the whole NSX upgrade – GM → Local Manager → Edge →
  hosts → finalize – is driven from **SDDC Manager / VCF Operations Fleet
  Management** once SDDC Manager is on 9.1, not from NSX's own tooling.
- **Before moving on:** Location Manager healthy; every location connected;
  Global Managers on the target build.

Broadcom reference: "Upgrading NSX Global Manager Nodes in a Federated
Environment" (techdocs, under *Upgrading Cloud Foundation*).

### NSX Edge & NSX Finalize in detail

**Position: the last core step**, replacing the plain
[Phase 8](#phase-8--nsx-finalize). It runs **after the ESX / host-cluster
phase** and does two things in one workflow: upgrades the **NSX Edge
cluster(s)** to 9.1, then **finalizes** the NSX upgrade – the step that marks
the workload domain fully on 9.1. Applies whenever NSX Edge nodes are present
(any NSX-backed overlay / N-S routing – i.e. almost always).

- **Why it is last.** The Edge dataplane version aligns with the **host
  transport-node dataplane**, so the hosts must be on 9.1 first. VCF
  Lifecycle Management enforces it: the **Configure button for the Edge /
  finalize step stays greyed out** until *every* vCenter and ESX host in the
  domain (and dependent domains) is on 9.1 – "NSX Dataplane upgrade is not
  available for domain … since all vCenter and ESX on the dependent domains
  are not upgraded".
- **Driven from SDDC Manager / VCF Operations Fleet Management** (the NSX
  Upgrade Coordinator underneath), not NSX's own UI, once SDDC Manager is on
  9.1. **Run the NSX upgrade prechecks first.**
- **Rolling.** Edge **clusters** upgrade in parallel by default; **within a
  cluster the edges go serially**. Each edge node: enter maintenance mode →
  stage the new OS → switch → **reboot** → exit maintenance mode. On an
  Active/Standby pair the standby takes the Active role and sends GARP.
- **North-south traffic impact.** Expect a **brief N-S blip per edge** at each
  failover. Known issue: an ESX host can miss the GARP and keep tunnelling to
  the now-offline edge until the ARP entry ages out (~10 min) – KB 440381.
  Schedule the Edge/finalize step in a maintenance window and confirm N-S
  routing re-converges after each node.
- **Shared NSX instance.** If one NSX instance is shared between the
  management domain and one or more workload domains, start the **Edge Cluster
  Upgrade + Finalize from the management domain only**, once every other
  component in every domain on that NSX is upgraded.
- **What "finalize" does.** Completes the Edge dataplane upgrade and commits
  the NSX upgrade – version state flips to fully upgraded, Manager-mode
  fallbacks are cleared, and the domain is reported on 9.1.
- **Gotcha – stale transport-node record.** A leftover / orphaned Host
  Transport Node entry (from a decommissioned or renamed host that was not
  cleanly removed from NSX) makes LCM count an un-upgraded unit and greys out
  the Configure button even though everything really is on 9.1. Remove the
  stale entry in **NSX Manager → System → Fabric → Nodes → Host Transport
  Nodes → Other Nodes** (Remove NSX / Force Delete); verify with
  `GET /api/v1/upgrade/upgrade-units?component_type=HOST`; then retry
  (KB 444026).
- **Before moving on:** all Edge nodes on the target build and in their
  cluster; Edge cluster + tunnels + BFD healthy; N-S routing (BGP / static)
  re-converged; **NSX upgrade marked complete / finalize succeeded**; no
  orphaned upgrade units.

Broadcom reference: "Upgrading vCenter and NSX Manager" →
*Upgrade the NSX Edge Cluster and Finalize NSX Upgrade* (techdocs, under
*Upgrading Cloud Foundation*); "NSX Edge Node Upgrade Process by the Upgrade
Coordinator" (NSX upgrade guide); KB 444026; KB 440381.

### vSphere Supervisor in detail

**Position: after vCenter, before the ESX host phase** – between core
[Phase 6](#phase-6--vcenter-upgrade) and [Phase 7](#phase-7--esx--host-cluster-upgrade),
after NSX Local Manager (and the NSX Global Manager, if federated), ahead of
any vSAN witness and the host kernels. KB 440630's core sequence does not
list it – it is an inserted advanced-product step.

- **Driven by vCenter Workload Management / vLCM**, not SDDC Manager or Fleet
  Management. Follow the "Upgrade a Supervisor cluster" procedure.
- **Supervisor clusters must be on vLCM images.** A Supervisor on a
  baseline / VUM cluster is not supported – transition it first. (The general
  vLCM-only rule, called out explicitly for Supervisor.)
- **The Supervisor version must match the vCenter version.** Auto-upgrade was
  removed at vCenter 9.0, so once vCenter is on the target build the
  Supervisor is out of step until it is upgraded.
- **It touches the hosts.** The Supervisor upgrade rolls each ESX host in the
  cluster through maintenance mode to install the Spherelet – budget for that
  on top of the Phase 7 host remediation.
- **vSphere Kubernetes Service (VKS / Tanzu guest) clusters** upgrade *after*
  the Supervisor, against the Supervisor ↔ VKS compatibility matrix.
- **Before moving on:** Supervisor control plane healthy and on the matching
  version; namespaces and workloads intact.

Broadcom reference: "Upgrade a Supervisor cluster" (vSphere Supervisor
installation and configuration → *Updating vSphere Supervisor* → *Managing a
Supervisor cluster using vLCM*); vSphere Supervisor release notes.

### Avi Load Balancer + License Hub in detail

Two separate things that travel together because License Hub licenses Avi.

**Avi Load Balancer (NSX Advanced Load Balancer).** Upgrade the **Avi
Controller** cluster ahead of the core NSX / vCenter / host tier; Service
Engines follow. Follow the dedicated
[Upgrade Avi Load Balancer to VCF 9.1](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html)
procedure.

**License Hub** licenses **vDefend and Avi** subscription license files
(replacing the 25-character keys). It is needed **only when vDefend *or* Avi
is in scope** – never on the strength of the Security Services Platform alone.

> **License Hub is not the License Server.** The **License Server** is
> deployed automatically at bring-up / [Phase 3](#phase-3--deploy-vcf-management-services--license-server)
> and licenses the VCF *fleet*. **License Hub** is a separate Day-N appliance
> for vDefend / Avi. Both exist in a fleet that runs Avi.

- **License Hub 2.0** (2026) ships as a **single standalone OVA** (~11 GB),
  listed under the **Avi Load Balancer** download page → *Primary Downloads*.
  It no longer uses the Security Services Platform Installer / `.tar` flow.
  **There is no 5.1.2 → 2.0 upgrade path** – a fresh 2.0 deployment.
- **License Hub 5.1.2** (older, if that is what is installed): three VMs
  (installer / controller / worker), roughly **9 IPs** in two pools
  (installer 1, nodes 4, services 4) whose **node and service pools cannot be
  changed after deployment**, two FQDNs. Disconnected (air-gapped) mode
  requires a manual license-file import every six months, indefinitely;
  connected mode polls the Avi Cloud Console.
- **Confirm which version applies** before re-using any 5.1.2 IP-pool / FQDN
  guidance – the 2.0 single-OVA deploy prompts for different inputs.

### Post-Infrastructure Products – Log Management in detail

**Position: after NSX finalize**, inside the post-infrastructure / operations
products run – **after Operations for Networks, before the Identity Broker
migration**. Applies whenever **VCF Operations for Logs** (Aria Operations for
Logs / vRLI) is in use.

Log Management is now a component of **VCF Management Services**
([Phase 3](#phase-3--deploy-vcf-management-services--license-server)) and is
deployed from **VCF Operations**, not upgraded in place.

- **Path depends on the running version.**
  - **From 9.0.x:** VCF Operations runs an upgrade operation that deploys
    Log Management 9.1 and *transfers the configuration* from the 9.0.x
    Operations for Logs instance. Agents and log sources are re-pointed
    automatically.
  - **From 8.x (VCF 5.x source):** no direct path. Deploy 9.1 fresh, then
    migrate configuration by hand and re-point every agent / log source.
- **What does not carry automatically.** Custom dashboards, alerts and saved
  queries are **not** transferred – convert them with the Content Pack →
  Management Pack tool. **Log forwarders are copied but left inactive** –
  activate each one by hand after cut-over. Integrations (SIEM, webhook,
  ticketing) are re-pointed manually.
- **Historical log data.** Three options: the transfer utility, an archived
  data import, or simply query the legacy cluster for **up to 90 days**
  post-upgrade while it runs in parallel for retention.
- **Networking.** The new Log Management **must sit on the management network
  that hosts VCF Management Services**. It **cannot be upgraded / migrated if
  it is on a custom NSX overlay network** – move it to the management network
  first. Its FQDN must resolve *outside* the IP range assigned to VCF
  Management Services. Prepare a **new FQDN** for the 9.1 instance (the old one
  stays with the legacy appliance during parallel run). The clustered form has
  its own integrated load balancer ("Cluster VIP"); size per the current
  deployment guide.
- **Decommission.** Once post-upgrade configuration is done and ingestion is
  confirmed on 9.1, **shut down and remove the legacy Operations for Logs
  appliances**. Repoint or retire anything still aimed at the old FQDN.
- **Log-data transfer needs the split-proxy Cloud Proxy.** Moving log data off
  the old appliance goes through a **Universal Cloud Proxy in split-proxy
  mode** – without it the Control Panel transfer fails with "Transfer failed
  due to an error" (see [Phase 1](#phase-1--vcf-operations-upgrade)
  and [Field notes](04-field-notes.md#observability--cloud-proxy-logs-networks)).
- **Newly added vCenters are not auto-collected** – activate their log
  collectors by hand in the VCF Operations UI.
- **Before moving on:** ingestion flowing from every source on the 9.1
  instance; forwarders active; alerts firing; custom content converted and
  present; legacy appliances powered off.

Broadcom reference:
[Upgrade to Log Management 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-operations-for-logs.html)
and [Deploy Log Management](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-of-components-to-complete-your-vcf-platform/installing-vcf-logs.html)
(fresh deploy).

### vSAN File Service in detail

**Position: last of the conditional phases** – after Log Management, at the
tail of the host-domain work, alongside the other post-host vSAN tasks in
[Post-upgrade validation](#post-upgrade-validation). Applies only when
**vSAN File Service** is enabled on a cluster.

- **Order: after the vSAN on-disk format upgrade.** Prerequisites are ESX
  hosts upgraded → vCenter upgraded → **vSAN on-disk format upgraded**; the
  File Service agent upgrade runs after all three.
- **What is upgraded.** The per-host **File Service agent VMs** (OVF). In the
  vSphere Client: cluster → **Configure → vSAN → Services → File Service →
  Edit → Check upgrade**, choose **Automatic** (pull the OVF) or **Manual**
  (supply the OVF), then **Upgrade**.
- **Rolling.** "The upgrade is performed on a rolling basis" – agents are
  replaced host by host. File server containers **fail over to other agent
  VMs** as each is refreshed.
- **Triggered from the vSphere Client**, not SDDC Manager / VCF Operations and
  not Skyline Health.
- **File shares stay accessible during the upgrade**, with **brief
  interruptions** possible as containers fail over.
- **Before moving on:** every File Service agent on the new version and
  healthy (no degraded / redeploying agents), all file shares served, vSAN
  Skyline Health clean for File Service.

Broadcom reference:
[Upgrade vSAN File Service](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-the-management-domain-to-vmware-cloud-foundation-5-2/upgrade-vsan-file-service.html).

### Identity: VIDM / Workspace ONE Access → VCF Identity Broker

VCF 9 replaces VMware Identity Manager (VIDM) / Workspace ONE Access with
**VCF Identity Broker (VIDB)**. It is **not an in-place upgrade** – Identity
Broker ships fresh with VCF Management Services (Phase 3), and the transition
is a distinct workstream run **after** the core upgrade: parallel-run,
bring users/groups across, rebuild the directory / IdP connection, federation,
MFA policies and branding by hand, re-point the components, then retire VIDM.

Full procedure, prerequisites, and what does / does not carry:
**[Identity Broker migration](03-identity-broker-migration.md)**.

---

## Post-upgrade validation

- **Component builds** – every component on its expected build (Phase 9 table).
- **VMware Tools** – upgrade guests to **13.1**.
- **VM hardware compatibility** – bump VM compatibility where appropriate.
- **vSAN on-disk format** – upgrade the on-disk format version.
- **vSAN File Service** – upgrade if in use; runs *after* the on-disk format
  upgrade – see [vSAN File Service in detail](#vsan-file-service-in-detail).
- **vSphere Distributed Switch** – upgrade vDS versions
  ([TechDocs](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-the-management-domain-to-vmware-cloud-foundation-5-2/upgrade-vsphere-distributed-switch-versions.html)).
- **Licensing** – all vCenter/NSX/host licenses assigned from the License
  Server; no connectivity errors between vCenter and the License Server.
- **Certificates** – re-issue or replace certificates for every new appliance
  (Management Services, License Server, Identity Broker, unified Cloud Proxy,
  Protection and Recovery); update trust on downstream integrations.
- **Identity** – SSO login works at every portal via Identity Broker;
  federation to the upstream IdP re-validated.
- **Integrations** – re-validate ServiceNow round-trips, log forwarding and
  content packs, custom dashboards and reports, vRO workflows, and any API
  consumers.
- **Disaster Recovery** – re-test a recovery plan against the converged
  Protection and Recovery appliance.
- **Backups** – reconfigure backup targets for the new appliances; re-verify
  image-based / file-based backups run clean; take fresh baselines.
- **Fleet health** – SDDC Manager and VCF Operations report a healthy fleet;
  run a fresh precheck.

---

## Cleanup / decommission

After the fleet is stable on 9.1:

- **9.0 Fleet Management Appliance** – decommission; it is fully replaced by
  Fleet Lifecycle / SDDC Lifecycle services in VCF Management Services. Do
  not use it for any further upgrades.
- **Standalone Identity Broker VMs** – consolidated into VCF Management
  Services; ready for decommissioning (no downtime if on the management
  network).
- **vRSLCM / standalone Aria appliances** – retire once the Aria → VCF
  Operations / VCF Automation transition is confirmed.
- General Day-N component removal/reinstall guidance –
  `VCF9-DeploymentPlanning/docs/16-remove-components.md`.

---

## Hardware addenda

| Hardware | Addendum |
| --- | --- |
| Dell VxRail | [VxRail Addendum](vxrail-addendum.md) – replaces Phase 7, plus VxRail-specific prechecks and post-upgrade validation |

---

## Customer data hygiene

This repo is **ITQ-internal** (private). Even so, do not commit real customer
names, IPs, hostnames, or credentials – use generic placeholders.
Per-engagement working files (filled checklists, real upgrade logs) belong
outside the repo, in the customer's OneDrive folder.
