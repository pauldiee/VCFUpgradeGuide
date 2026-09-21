# Full VCF upgrade sequence

A companion to the [Overview](01-overview.md), expanding the **full VCF**
track: a fleet driven through **VCF Management Services / Fleet
Management** (SDDC Manager, VCF Operations Fleet Management, the License
Server) end to end. If that layer isn't in the picture, see the
[Standalone VVF upgrade](14-standalone-vvf-upgrade.md) doc instead – see
the [Overview](01-overview.md#confirm-which-track-applies) for how to tell
which applies.

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

- [What changes in VCF 9.x](#what-changes-in-vcf-9x)
- [Prerequisites and architectural guardrails](#prerequisites-and-architectural-guardrails)
  · companion doc: [VUM to vLCM images migration](15-vum-to-vlcm-migration.md)
- [Run the pre-upgrade precheck](#run-the-pre-upgrade-precheck)
- [The upgrade sequence](#the-upgrade-sequence) – Phases 1–9: VCF Operations →
  SDDC Manager → Management Services + License Server → VCF Automation → NSX
  Local Manager → vCenter → ESX / host → NSX finalize → effective versions
- [Windows, ordering and rollback](#windows-ordering-and-rollback)
- [Conditional phases (optional components)](#conditional-phases-optional-components)
  – [NSX Federation](#nsx-global-manager--federation-in-detail)
  · [vSphere Supervisor](#vsphere-supervisor-in-detail)
  · [vSAN File Service](#vsan-file-service-in-detail)
  · companion docs: [Disaster Recovery](02-disaster-recovery.md)
  · [Avi + License Hub upgrade](09-avi-license-hub-upgrade.md)
  · [NSX Edge & Finalize](10-nsx-edge-finalize.md)
  · [Log Management migration](11-log-management-migration.md)
  · [Identity Broker migration](03-identity-broker-migration.md)
- [Post-upgrade validation](#post-upgrade-validation)
- [Cleanup / decommission](#cleanup--decommission)
- companion doc: [Field notes – known issues and gotchas](04-field-notes.md)
- [Hardware addenda](#hardware-addenda) – [VxRail Addendum](vxrail-addendum.md)

---

## How to use this doc

1. Confirm a supported path and pin a target build – see the
   [Overview](01-overview.md#confirm-a-supported-upgrade-path).
2. Clear every [prerequisite and precheck](#prerequisites-and-architectural-guardrails)
   below.
3. Execute **[The upgrade sequence](#the-upgrade-sequence)** phase by phase.
   Every phase boundary is a **safe stopping point** – pause there to
   validate before continuing.
4. Insert any **[conditional phases](#conditional-phases-optional-components)**
   your fleet needs (Avi, SRM, HCX, NSX Federation, Log Management, …) at the
   points shown.
5. Apply your hardware addendum where it cross-links a phase
   (VxRail: [VxRail Addendum](vxrail-addendum.md)).
6. Finish with **[Post-upgrade validation](#post-upgrade-validation)** and
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

## Prerequisites and architectural guardrails

Clear all of these **before** Phase 1. Re-confirm each against TechDocs for
your target build.

| Area | Requirement |
| --- | --- |
| **Fleet health** | Healthy source fleet; no failed workflows; all SDDC Manager prechecks green |
| **Bundle staging** | All upgrade bundles downloaded, staged, and integrity-checked before the window; confirm **free disk space on SDDC Manager** – a common, avoidable staging failure |
| **CPU & TPM** | No deprecated CPU families for the target build; TPM 2.0 firmware current, or TPM disabled |
| **Backups** | vCenter file-based backup configured; SDDC Manager + VCF Operations image-based backups to an external SFTP target |
| **vSphere Lifecycle Manager** | All clusters managed by **vLCM images** – transition any remaining baseline-managed clusters first. Full walkthrough: [VUM to vLCM images migration](15-vum-to-vlcm-migration.md) |
| **DNS** | Strictly **lowercase** forward *and* reverse records for every existing and new name |
| **NTP** | Time sync healthy and consistent across all fleet components before the upgrade window |
| **vCenter root password** | **15–20 characters** (new 9.1 standard) |
| **Management Services IP block** | Free **/28 CIDR minimum** on the management network (or a dedicated network); **12 IPs minimum, 30 recommended**. FQDNs for: Fleet component service, Instance component service, VCF services runtime, Identity Broker, License Server |
| **Internal runtime range** | VCF services runtime uses **198.18.0.0/15** internally – must not overlap the management network. Changeable to 240.0.0.0/15 or 250.0.0.0/15 **only** via the deployment JSON spec |
| **vCenter temp IPs** | A temporary IP per vCenter for the reduced-downtime upgrade |
| **vSAN HCL** | Update the vSAN Hardware Compatibility database; confirm Broadcom vSAN plugins are supported on the target build |
| **vSAN health** | Resolve every red/yellow **Skyline Health** finding (vSAN cluster → Monitor → Skyline Health) before upgrading; only silence alerts that are understood and accepted |
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

## Run the pre-upgrade precheck

Run the **upgrade precheck in SDDC Manager** and resolve every error before
starting. Component-specific prechecks (VCF Automation especially) run again
inside each phase – a green fleet precheck is the entry gate, not the whole
story.

Broadcom additionally runs an **internal health-check tool** during the
Technical Consultation gate, access-gated to Broadcom PSO/SRE staff (not a
public download) rather than something available to run yourself – it
sweeps every domain, checks VCF components plus ESXi hosts, and produces
structured, color-coded evidence feeding the go / no-go decision. Confirm
with your Broadcom TC contact whether it will be run against your site,
and if so, get the result bundles from them before closing the gate (they
are not retained indefinitely). (On the [standalone VVF
path](14-standalone-vvf-upgrade.md), no SDDC Manager exists to run this
against – Broadcom's equivalent path runs the same checks directly against
vCenter instead.)

Treat this as a Broadcom-run, Broadcom-owned step: the mechanics of how
their team runs it and what the tool is called are theirs to document, not
this repo's – what matters here is that it exists, gates the window, and
its findings need the same tracking-to-closure treatment as any other
precheck finding.

No finding should go into the upgrade window unowned: track each one to
resolution (or an explicit accepted-risk decision) and re-run the precheck
to confirm it clears before proceeding. This is the **go / no-go gate** –
the window opens only when every blocker is resolved (or explicitly
accepted) and the evidence exists to prove it, not on a verbal "looks fine."

Findings typically split across ownership tiers – some resolved directly,
some needing a customer-executed change (firewall rules, networking,
company policy), some requiring hardware-vendor investigation, and a small
remainder needing vendor support escalation. Agree ownership per finding;
don't assume one team can clear everything.

**VDT is a complementary, self-service option you can run yourself ahead
of the TC-run precheck above.** The **VCF Diagnostic Tool for vSphere
(VDT)** – distributed as a normal, publicly available KB attachment, no
Broadcom account gating needed – runs directly on a vCenter appliance and
checks DNS, NTP, disk space, certificates, AD/Lookup Service integration,
vCenter services, and VCHA. Run it per vCenter before the window opens, to
catch vCenter-level issues early rather than waiting on the TC gate:

```
cd /root/ && unzip vdt-<version_number>.zip && cd vdt-<version_number>
python vdt.py
```

See [vCenter manual GUI upgrade → Validate with VDT before you
start](07-vcenter-manual-upgrade.md#validate-with-vdt-before-you-start)
for the full walkthrough (written for the standalone path, but the tool
and its checks are identical here). Source:
[Broadcom KB 344917](https://knowledge.broadcom.com/external/article/344917/using-the-vcf-diagnostic-tool-for-vspher.html).

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

> **In-place vs. fresh install, re-IP, HA/CA, and registering vCenters as
> data sources** are covered in detail in
> [Operations modernization](05-operations-modernization.md) – read that
> before committing to a re-IP procedure or a content-migration plan.

- **Unified Cloud Proxy** (also **Universal Cloud Proxy / UCP**). 9.1 collects
  for VCF Operations, Operations for Logs, and the SDDC Manager / VCF
  Management integration from a **single** Cloud Proxy appliance (1 node, 1 IP)
  in the first VCF Instance. **Hard blocker: without a Cloud Proxy on the
  first VCF Instance, the upgrade cannot complete** – this applies even with
  no Aria stack present at all (deploy VCF Operations *and* a Cloud Proxy in
  that case; both are mandatory). **Legacy 8.18 vRealize Operations Cloud
  Proxies do not upgrade in place** into the unified model – deploy the new
  proxy and reconfigure the collection paths from SDDC Manager alongside this
  phase.
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

**VCF Operations Orchestrator** (formerly Aria Automation Orchestrator, if
present) upgrades alongside Automation to **Orchestrator 9.1** – on a
5.2.x source this is a **manual** step; on a 9.0.x source it is **driven by
VCF Operations**. Confirm which applies for your source build.

**Before moving on:** Automation portal reachable at its original FQDN;
catalog/deployments intact; Orchestrator (if present) on the target build.

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
  KB 373004; move to another IdP configuration. Full walkthrough, including
  a permissions/roles backup before the switch:
  [IWA to AD-over-LDAPS migration](06-iwa-ldaps-migration.md).
- **RDU (reduced-downtime upgrade)** deploys a new appliance on the target
  build alongside the running one and copies data/config while the source
  stays online; the only outage is the **switchover** (~10 minutes per
  Broadcom KB 313288). **If it fails, it auto-reverts** to the source VM in
  its pre-upgrade state – no manual rollback needed. If the manual rollback
  procedure below is still required for a specific failure: shut down the
  target vCenter → run the script to stop the RDU → roll back the 8.0
  vCenter Workspace ONE broker precheck change → reboot vCenter.
- **After a successful RDU switchover, disconnect the source VM's network
  adapter.** If the old appliance is later powered back on while still
  connected, it will delete the new target VM (KB 313288). Do this before
  the source VM leaves the maintenance window, not as an afterthought.
- After the upgrade, re-check the vCenter Lifecycle Manager **depot token** –
  it can silently stop matching SDDC Manager's, and ESXi images vanish from
  the vCenter depot ([field notes](04-field-notes.md#entitlement-and-the-depot-download-token)).

**Before moving on:** vCenter on the target build; ELM (if used) intact; all
hosts connected.

### Phase 7 – ESX / host-cluster upgrade

Upgrade **ESX hosts** cluster by cluster via rolling maintenance mode, plus
any **vSAN witness** hosts. **NSX VIBs ship inside the ESX image** and
upgrade with the host – there is no separate NSX-on-host step between this
phase and [NSX finalize](#phase-8--nsx-finalize).

> **Hardware addendum replaces or wraps this phase.** On **Dell VxRail**,
> host/firmware/driver upgrades are delivered as a Dell-validated VxRail
> bundle and driven by Dell – **do not** use the online VxRail Manager UI /
> vCenter plugin path. See **[VxRail Addendum](vxrail-addendum.md)**.

**Before moving on:** all hosts on the target build; vSAN healthy;
resync complete; no HCL warnings.

### Phase 8 – NSX finalize

Run the **NSX upgrade finalization** step. *(With NSX Edge nodes present,
Edge upgrade + finalize happen together here – see
[NSX Edge & Finalize](10-nsx-edge-finalize.md).)*

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
  + workload domain pair has run to roughly 80 hours end to end. Ask your
  Broadcom TC contact for their per-component time estimates to build the
  project plan from – use those alongside a real reference point like the
  above.

  **Rough per-component durations**, gathered from field experience and
  general Broadcom planning guidance rather than any single authoritative
  source (single management domain plus workload domains; excludes time to
  resolve blockers found along the way, and will vary by hardware and
  environment size – treat these as a starting point to validate against
  your own TC's numbers, not a commitment):

  | Domain | Component | Est. time | Notes |
  | --- | --- | --- | --- |
  | MGMT | SDDC Manager | ~1.0 hr | First component upgraded |
  | MGMT | NSX-T (Edges / TN / Manager) | ~4.0 hrs | |
  | MGMT | Witness node | ~0.5 hr | If applicable |
  | MGMT | vCenter Server | ~1.0 hr | |
  | MGMT | ESXi (per host) | ~11.0 hrs | Scales with host count |
  | WLD 1+ | NSX-T (shared across WLDs) | ~8.0 hrs | Single upgrade, all WLDs |
  | WLD 1+ | vCenter Server | ~1.0 hr | Per WLD |
  | WLD 1+ | ESXi (per host) | ~8-13 hrs | WLDs can run in parallel |
  | All | Aria Suite LCM | ~1.0 hr | If in scope |
  | All | Post-upgrade checks (TC-run) | TBD | Final step, full environment |
- **Safe stopping points.** Every phase boundary is a safe stop – run the
  "before moving on" checks, then either continue or pause. Do not stop
  mid-phase.
- **Rollback.** Recovery is **per-component – there is no single "undo"**:
  - **VCF Operations** – snapshot each node before starting (cluster
    offline, memory excluded); rollback is a snapshot revert.
  - **SDDC Manager & NSX Manager** – not cleanly reversible; the backout
    position is restore-from-backup (NSX Manager: file-level backup only),
    so pre-upgrade backups must be verified first.
  - **vCenter** – the reduced-downtime upgrade auto-reverts on failure
    (Phase 6); no manual rollback needed in the normal case.
  - **Avi** – follow Avi's own documented rollback procedure, where present
    as a conditional phase.
  - **ESX / host** – forward-only; rollback is only possible within the
    maintenance window, not after.

  **Write down** the agreed per-phase backout position before the window –
  this is one of the things a Technical Consultation gate expects as
  evidence, not just a verbal agreement.
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
| **Upgrade Avi Load Balancer + Deploy License Hub** | after DR Products, before SDDC Manager | Own doc: [Avi + License Hub upgrade](09-avi-license-hub-upgrade.md) |
| **VMware HCX** | after VCF Automation | Upgrade HCX before the NSX/vCenter/host tier |
| **NSX Global Manager upgrade** | before NSX Local Manager | **NSX Federation only.** See [NSX Federation in detail](#nsx-global-manager--federation-in-detail) |
| **vSphere Supervisor** | after vCenter (Phase 6), before the ESX host phase (Phase 7) | See [vSphere Supervisor in detail](#vsphere-supervisor-in-detail) |
| **NSX Edge & NSX Finalize** | replaces the plain "NSX finalize", after the host phase | Edge nodes upgraded last, after ESX/host kernels, then finalize. Own doc: [NSX Edge & Finalize](10-nsx-edge-finalize.md) |
| **Post-Infrastructure Products → Log Management** | after NSX finalize (after Operations for Networks, before Identity Broker) | Deploy fresh Log Management as part of VCF Management Services. Own doc: [Log Management migration](11-log-management-migration.md) |
| **Operations for Networks** (vRNI / Aria Operations for Networks) | with the operations tier | Upgrade-path is version-gated – e.g. 6.14.1 reaches 9.1.0.0100 but not 9.1.0.0200 directly, and the newest 6.14.x may have no 9.x path. Collector nodes are version-locked to the platform – redeploy / re-pair |
| **vSAN File Service** | after Log Management, after the vSAN on-disk format upgrade | Rolling File Service agent (OVF) refresh, driven from the vSphere Client. See [vSAN File Service in detail](#vsan-file-service-in-detail) |

Re-run the planner with the real component list for the authoritative
insert points.

Several of the conditional workstreams have their own docs:

- **[Disaster Recovery](02-disaster-recovery.md)** – SRM / vSphere Replication
  convergence to VCF Protection and Recovery (runs *before* the core upgrade).
- **[Avi + License Hub upgrade](09-avi-license-hub-upgrade.md)** – Avi
  Controller/Service Engine upgrade and the separate License Hub appliance
  (runs before SDDC Manager).
- **[NSX Edge & Finalize](10-nsx-edge-finalize.md)** – Edge cluster upgrade
  and NSX finalize, replacing the plain Phase 8 (runs after the host phase).
- **[Log Management migration](11-log-management-migration.md)** – VCF
  Operations for Logs migration to Log Management 9.1 (runs after NSX
  finalize).
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
- **Manual mode needs the files downloaded ahead of time – this is a
  do-it-yourself step, not something the wizard fetches or prompts you
  through.** **Automatic** needs the vCenter's depot/internet reachability
  to pull it directly; where that's not available (restricted / air-gapped
  environments, or the automatic pull otherwise fails), **Manual** is the
  only option, and it just presents a file picker – it doesn't tell you
  where to get the files. On the **Broadcom Support Portal**: search
  **Cloud Foundation** → select the target release (**9.1.1**) → the
  **VMware vSAN** product page → **Drivers & Tools** tab → **VMware vSAN
  File Services Appliance** section. **It's not a single OVA – download
  every file in that section**: the `.ovf`, its `.mf` and `.cert`
  signature files, and the **three separate `.vmdk` disks**
  (`cloud-components`, `log`, `system`) – six files in total for the 9.1.1.0
  build. The wizard's file picker needs the `.ovf` pointed at, but it reads
  the `.mf`/`.cert`/`.vmdk` files from the same local folder during
  deployment – grabbing only the `.ovf` fails partway through. Download all
  six into the same folder **before** starting the wizard, not after
  hitting the file picker and realizing more is needed.
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

Broadcom's post-upgrade health assessment mirrors the pre-upgrade gate:
ask your TC contact to re-run their health-check tool's post-check mode
and compare the results against the pre-upgrade baseline, re-check **vSAN
Skyline Health**, and confirm every check returns GREEN. Document any
residual items or exceptions and package the evidence for handover, the
same way the pre-upgrade findings were tracked to closure.

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

**Spot-check builds, VMware Tools, vSAN on-disk format, and vDS version with
PowerCLI** (a fleet-wide sweep across the checklist's build/Tools/vSAN/vDS
rows – it does not replace your TC's post-check tool or Skyline Health,
both of which look deeper than these surface-level properties):

> **Lab-verified 2026-09-19** (my holodeck lab, PowerCLI 13.3.0, vCenter/ESXi
> 9.1.1) – run as shown below, with one fix from what first shipped here:
> `Get-VsanClusterConfiguration` does **not** expose a `DiskFormatVersion`
> property on this PowerCLI version at all (confirmed by dumping every
> property on the returned object – it isn't there), so the vSAN check below
> uses `Get-VsanDiskGroup` instead, which does carry it, per host and disk
> group. The build and VMware Tools checks ran clean as originally written.
> One thing to expect, not a bug: VCF appliance VMs (SDDC Manager, VCF
> Operations, NSX Manager, etc.) report `guestToolsUnmanaged` rather than
> `guestToolsCurrent` – that's normal for their bundled open-vm-tools and
> doesn't mean they're behind; the filter below still lists them, so expect
> noise from appliances on every run, not just from genuinely outdated Tools
> on workload VMs.
>
> **The `Get-VDSwitch` line is Untested** – added after the initial lab pass
> and not yet run against a live vCenter. `Version` is expected to be a
> plain string like `"8.0.0"`, not automatically flagged against a target –
> compare it by eye against the target vDS version from
> [Pick a VDS version](08-vss-to-vds-migration.md#before-touching-anything)
> until this line gets its own lab pass.

```powershell
# Component builds - compare against the Phase 9 effective-versions table
Get-VMHost | Select-Object Name, Version, Build | Sort-Object Name
(Get-View ServiceInstance).Content.About |
  Select-Object FullName, Version, Build

# VMware Tools - flag anything not on the target version (13.1 at time of writing)
# Appliance VMs normally show guestToolsUnmanaged (bundled open-vm-tools) - expected, not a gap.
Get-VM | Get-View | Select-Object Name,
  @{N="ToolsVersion";E={$_.Config.Tools.ToolsVersion}},
  @{N="ToolsStatus";E={$_.Guest.ToolsVersionStatus}},
  @{N="ToolsRunningStatus";E={$_.Guest.ToolsRunningStatus}} |
  Where-Object { $_.ToolsStatus -ne "guestToolsCurrent" }

# vDS versions - compare against the target vCenter's max-supported version
Get-VDSwitch | Select-Object Name, Version, NumUplinkPorts, NumPorts

# vSAN on-disk format version - per host, per disk group (Get-VsanClusterConfiguration has no
# DiskFormatVersion property to read this from)
Get-Cluster | Get-VsanDiskGroup |
  Select-Object VMHost, Name, DiskGroupType, DiskFormatVersion, IsMounted
```

Anything reported here as behind target still needs the corresponding
upgrade action (host remediation, guest Tools upgrade, vSAN disk-format
upgrade) – this script only surfaces the gap, it doesn't fix it.

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
- **Pre-upgrade snapshots** – delete once the upgrade is confirmed
  successful; leaving them attached causes performance degradation.
- General Day-N component removal/reinstall guidance –
  `VCF9-DeploymentPlanning/docs/16-remove-components.md`.

---

## Hardware addenda

| Hardware | Addendum |
| --- | --- |
| Dell VxRail | [VxRail Addendum](vxrail-addendum.md) – replaces Phase 7, plus VxRail-specific prechecks and post-upgrade validation |
