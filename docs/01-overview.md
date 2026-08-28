# Overview

General guidance for planning a **VMware Cloud Foundation (VCF) upgrade** –
pre-upgrade checks, the upgrade sequence, and post-upgrade validation –
applicable regardless of underlying hardware. Hardware/HCI-specific extra
steps (currently: **Dell VxRail**, see [VxRail Addendum](vxrail-addendum.md))
are layered on top as their own addendum, not baked into this flow, so the
core guidance stays reusable across engagements.

> **Status: draft.** The phase *ordering and conditionality* below is
> verified against the [VCF Upgrade Planner](https://vmware.github.io/vcf-upgrade-planner/)
> (run 2026-08-27, target build 9.1.0.0400). Per-phase procedure detail, IP
> counts, and version numbers are transcribed from the planner and the
> supplementary guides and **must be re-confirmed verbatim against Broadcom
> TechDocs** (and against your actual target build) before being treated as
> authoritative. Sources: [`reference/sources.md`](../reference/sources.md).

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
  – [Disaster Recovery in detail](#disaster-recovery-products-in-detail)
  · [Identity Broker migration](02-identity-broker-migration.md) (own doc)
- [Post-upgrade validation](#post-upgrade-validation)
- [Cleanup / decommission](#cleanup--decommission)
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
> path to any 9.x build yet**. Observed against 9.1.0.0x00: SDDC Manager 5.2.2
> upgrades directly but 5.2.3.0 / 5.2.4.0 do not; VCF Operations 8.18.6
> upgrades directly but **8.18.7 has no 9.x path**; Operations for Networks
> 6.14.1 reaches 9.1.0.0100 but not 9.1.0.0200, and 6.14.3 has no 9.x path.
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

VCF 9.1 ships as patch builds: **9.1.0.0, 9.1.0.0100, 9.1.0.0200,
9.1.0.0300, 9.1.0.0400** (as of 2026-08-27). **VCF 9.1.1 is not yet released
but is expected imminently** – it will add newly supported source patch
levels and a new target build. If an engagement calls for "9.1.1":

- Until 9.1.1 is GA, plan against the latest **9.1.0.0x00** build.
- Once 9.1.1 is GA, **re-verify everything against the matrix**. A point
  release re-qualifies **both** the supported *source* versions and the
  *target* builds – it is not "a smaller step" on top of a 9.1.0 plan. Target
  builds, per-component upgrade paths, and the effective versions below all
  change.

Do not carry a loose "9.1.1" into a runbook; always resolve it to a concrete
build number.

> **A component can force the wait.** If a running component sits at a patch
> level with no path to 9.1.0 (for example VCF Operations 8.18.7), and rolling
> it back would lose data (historical metrics), the whole engagement may have
> to wait for the point release that adds that path. Check this early.

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

- **Unified Cloud Proxy.** 9.1 collects for VCF Operations, Operations for
  Logs, and the SDDC Manager / VCF Management integration from a **single**
  Cloud Proxy appliance (1 node, 1 IP) in the first VCF Instance. **Legacy
  8.18 vRealize Operations Cloud Proxies do not upgrade in place** into the
  unified model – deploy the new proxy and reconfigure the collection paths
  from SDDC Manager alongside this phase.
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

Upgrade **vCenter** via **VCF Operations → Fleet Management**. Two gotchas:

- **Replace Integrated Windows Authentication** on vCenter with another IdP
  configuration before upgrading.
- **RDU (reduced-downtime upgrade) rollback**, if it fails: shut down the
  target vCenter → run the script to stop the RDU → roll back the 8.0
  vCenter Workspace ONE broker precheck change → reboot vCenter.

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
Edge upgrade + finalize happen together here – see conditional phases.)*

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
| **Disaster Recovery Products** | before the core (ahead of SDDC Manager) | Converge SRM / vSphere Replication to **Protection and Recovery** – see [detail below](#disaster-recovery-products-in-detail) |
| **Upgrade Avi Load Balancer + Deploy License Hub** | after DR Products, before SDDC Manager | License Hub 2.0 appliance: 1 management IP + a pool of **2 contiguous IPs**; Default size 1 node / 6 vCPU / 12 GB / 256 GB |
| **VMware HCX** | after VCF Automation | Upgrade HCX before the NSX/vCenter/host tier |
| **NSX Global Manager upgrade** | before NSX Local Manager | **NSX Federation only.** All sites on compatible versions; inter-site connectivity required; **must precede** Local Manager upgrade |
| **NSX Edge & NSX Finalize** | replaces the plain "NSX finalize", after the host phase | Edge nodes upgraded last, after ESX/host kernels, then finalize |
| **Post-Infrastructure Products → Log Management** | after NSX finalize | **No in-place upgrade path** – deploy fresh Log Management services |
| **Operations for Networks** (vRNI / Aria Operations for Networks) | with the operations tier | Upgrade-path is version-gated – e.g. 6.14.1 reaches 9.1.0.0100 but not 9.1.0.0200 directly, and the newest 6.14.x may have no 9.x path. Collector nodes are version-locked to the platform – redeploy / re-pair |
| **vSAN File Service** | after Log Management | Upgrade vSAN File Service |

Re-run the planner with the real component list for the authoritative
insert points.

### Disaster Recovery Products in detail

If Site Recovery Manager (SRM) / vSphere Replication is present, plan this as
its own workstream **before** the core upgrade – the current DR release is not
supported on the upgraded vCenter, so any order that upgrades vCenter first
leaves the environment unprotected.

**Target: VCF Protection and Recovery.** From 9.1.0.0 the recovery manager,
vSphere Replication, and vSAN replication ship as a **single combined
appliance**. SRM is renamed **VMware Live Site Recovery (VLSR)**.

**Convergence.** "Convergence" is the Broadcom path for VLSR **9.0.2.3 and
earlier** onto the combined appliance. The Converge workflow requires the
source to be at **9.0.2.2 or later** (Broadcom KB 408127) – a site on an
earlier 9.0.2.x needs an interim patch first. Versions 9.0.3 and later use a
normal in-place update instead.

**Bridge version – why DR goes first.** Protection and Recovery 9.1.0.02xx is
supported on vCenter and ESX at **8.0 U3, 9.0, and 9.1** (not 8.0 U2 or
earlier). It runs on the pre-upgrade vCenter *and* the upgraded vCenter, so
converging DR to it before the core upgrade keeps protection continuous.
Confirm the exact supported set in the interoperability matrix for your build.

**Enhanced vSphere Replication is a prerequisite.** For VCF 9 it is the only
supported site-to-site configuration; the appliance will not install against a
site still on legacy replication (unsupported past vSphere Replication
9.0.2.2). Per site, ahead of the convergence:

1. Permit outbound **TCP 32032** on every ESX host carrying replicated
   datastore traffic.
2. Define **Enhanced Replication Mappings** in the Site Recovery interface,
   per protected site pair.
3. Convert every legacy VM replication to Enhanced settings – **per VM**, via
   the Site Recovery UI or the REST API (Broadcom ships a Python sample for
   large estates).

**Convergence procedure** (per site; run on the protected site first, then the
recovery site):

1. Pre-work: full backup of the Protection and Recovery database; configuration
   export via the Import/Export tools; record Site Pair advanced settings; all
   recovery plans **Ready**, all protection groups and VMs **OK**; custom
   certificates on SHA1/SHA256 thumbprints (no MD5); have vCenter SSO admin
   credentials for both sites.
2. Deploy the Protection and Recovery 9.1 appliance on **both** vCenter sites;
   enable SSH on all legacy appliances; ensure the new appliance can reach
   them.
3. In the Protection and Recovery Appliance Management Interface →
   **Converge Legacy Appliances** → enter the vCenter and legacy-appliance
   credentials → select the services → run the configuration wizard.
4. Repeat on the recovery site.
5. After: the legacy appliances power off and their IPs/FQDNs move to the
   single appliance; clean up firewall rules and DNS; reinstall storage
   replication adapters (SRA) and re-register any VASA provider; re-verify the
   site pairing.

Convergence preserves advanced settings, datastore groups, protection groups,
inventory mappings, recovery plans, per-VM IP customizations, custom roles and
permissions, custom alarms, test-plan history, and certificates – **for
objects in a valid state only**.

Broadcom reference: "Convergence and Upgrade" (VCF Protection and Recovery 9.1
installation guide); KB 313905 (VLSR / SRM build numbers).

### Identity: VIDM / Workspace ONE Access → VCF Identity Broker

VCF 9 replaces VMware Identity Manager (VIDM) / Workspace ONE Access with
**VCF Identity Broker (VIDB)**. It is **not an in-place upgrade** – Identity
Broker ships fresh with VCF Management Services (Phase 3), and the transition
is a distinct workstream run **after** the core upgrade: parallel-run,
bring users/groups across, rebuild the directory / IdP connection, federation,
MFA policies and branding by hand, re-point the components, then retire VIDM.

Full procedure, prerequisites, and what does / does not carry:
**[Identity Broker migration](02-identity-broker-migration.md)**.

---

## Post-upgrade validation

- **Component builds** – every component on its expected build (Phase 9 table).
- **VMware Tools** – upgrade guests to **13.1**.
- **VM hardware compatibility** – bump VM compatibility where appropriate.
- **vSAN on-disk format** – upgrade the on-disk format version.
- **vSAN File Service** – upgrade if in use.
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
