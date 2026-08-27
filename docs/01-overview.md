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

> **The source patch level matters.** The planner's add-on pre-check rejects
> some patch levels outright. For the VCF **5.2 → 9.1** path against target
> **9.1.0.0400**, at time of writing only **5.2.2** has a supported *direct*
> path – 5.2.1 is rejected, and 5.2.3.0 / 5.2.4.0 return "no destination
> available, wait for a future 9.1.x". Always re-run the planner with the
> customer's real patch before committing to a date.

### Pin a target build

VCF 9.1 ships as patch builds: **9.1.0.0, 9.1.0.0100, 9.1.0.0200,
9.1.0.0300, 9.1.0.0400** (as of 2026-08-27). **VCF 9.1.1 is not yet released
but is expected imminently** – it will add newly supported source patch
levels and a new target build. If an engagement calls for "9.1.1":

- Until 9.1.1 is GA, plan against the latest **9.1.0.0x00** build and treat
  the 9.1.1 move as a later, smaller step.
- Once 9.1.1 is GA, **re-run the planner** – the supported-source matrix and
  the effective component versions below will change.

Do not carry a loose "9.1.1" into a runbook; always resolve it to a concrete
build number.

### Framing: "Create New VCF 9.1 Fleet"

For a **5.2.x source**, the planner labels the 5.2 → 9.1 upgrade **"Create
New VCF 9.1 Fleet"**. This is still an in-place upgrade of your existing
environment – the wording reflects that 9.x introduces the *fleet* construct
(VCF Operations manages a fleet of VCF instances) and the new **VCF
Management Services** layer, which 5.2 did not have. A 9.0.x source instead
uses "Expand existing VCF Fleet by upgrading the current instance".

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
| **Licensing** | VCF Operations must be licensed within **90 days** of upgrade; the License Server is deployed during Phase 3 |

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

Upgrade the **VCF Operations instance that manages the fleet** first. Deploy
the **Cloud Proxy** (1 node, 1 IP) and update the SDDC adapter collector
group so metrics continuity is preserved. On a 5.2.x source this is the
transition **from Aria Operations** (via vRSLCM) to VCF Operations 9.1.

**Before moving on:** VCF Operations reachable and healthy; metrics still
flowing through the Cloud Proxy.

### Phase 2 – SDDC Manager upgrade

Upgrade **SDDC Manager** to the target build.

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

## Conditional phases (optional components)

When optional components are present the planner expands the plan (example:
SRM + Avi + HCX + NSX Federation + vSphere Supervisor + VCF Operations for
Logs + vSAN File Service → **15 phases / 17 steps**). The inserts and where
they slot into the core spine:

| Inserted phase | Position | Notes |
| --- | --- | --- |
| **Disaster Recovery Products** | after Phase 1 (VCF Operations) | Upgrade **SRM / vSphere Replication** early |
| **Upgrade Avi Load Balancer + Deploy License Hub** | after DR Products, before SDDC Manager | License Hub 2.0 appliance: 1 management IP + a pool of **2 contiguous IPs**; Default size 1 node / 6 vCPU / 12 GB / 256 GB |
| **VMware HCX** | after VCF Automation | Upgrade HCX before the NSX/vCenter/host tier |
| **NSX Global Manager upgrade** | before NSX Local Manager | **NSX Federation only.** All sites on compatible versions; inter-site connectivity required; **must precede** Local Manager upgrade |
| **NSX Edge & NSX Finalize** | replaces the plain "NSX finalize", after the host phase | Edge nodes upgraded last, after ESX/host kernels, then finalize |
| **Post-Infrastructure Products → Log Management** | after NSX finalize | **No in-place upgrade path** – deploy fresh Log Management services |
| **vSAN File Service** | after Log Management | Upgrade vSAN File Service |

Re-run the planner with the real component list for the authoritative
insert points.

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
- **Backups** – re-verify image-based/file-based backups run clean against
  the upgraded components.
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
