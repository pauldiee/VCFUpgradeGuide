# Reference sources

Pinned, authoritative source material for the general VCF upgrade guidance in
`docs/`. Broadcom TechDocs and KBs are the source of truth; blog posts and the
planner tool are supplementary orientation only.

> **Verbatim rule.** Before any version number, IP-count, or ordered step from
> these pages lands in `docs/`, re-fetch the specific TechDocs page and quote
> the literal table rows / notes / footnotes – summarised fetches drop
> footnotes and conditions. See `MEMORY.md` → "Quote TechDocs verbatim".

_Last reviewed: 2026-08-27 (against VCF 9.1.0.0). Re-check on each patch line._

---

## 1. Broadcom TechDocs – authoritative

### Upgrade guide tree

| Page | Covers |
| --- | --- |
| [Deployment, Convergence, and Upgrade](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment.html) | Top of the 9.1 deployment/upgrade doc tree |
| [Upgrading to VMware Cloud Foundation 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html) | Master upgrade guide – fleet-level + management-domain components, prerequisites, approach |
| [Deploy VCF Management Services and License Server as Part of VCF Upgrade to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/deploy-vcf-management-services.html) | New 9.1 mandatory component: Management Services cluster + headless License Server; IP/DNS requirements |
| [Upgrade ESX to 9.1 (from 5.2 mgmt domain)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-the-management-domain-to-vmware-cloud-foundation-5-2/upgrade-esxi-for-vmware-cloud-foundation-5-2-1.html) | ESX host upgrade step, rolling maintenance mode |
| [Upgrade vSphere Distributed Switch Versions](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-the-management-domain-to-vmware-cloud-foundation-5-2/upgrade-vsphere-distributed-switch-versions.html) | Post-upgrade vDS version bump |
| [VMware Cloud Foundation 9.1 (product landing)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1.html) | Release notes, BOM, doc index |

### Release notes / sequence

| Page | Covers |
| --- | --- |
| [Upgrade Sequence to 9.1 (9.1.0.0 release notes)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-0-0-release-notes/upgrade-sequence-to-91.html) | Official statement of the strict component upgrade sequence; supported source versions |

### Supported source versions (per release notes, verify verbatim)

- VCF 5.2.x / vSphere Foundation 5.2.x
- VCF 9.0.x / vSphere Foundation 9.0.x
- vSphere 8 + Aria Operations 8

### Component-specific upgrade docs

| Page | Covers |
| --- | --- |
| [Upgrade Avi Load Balancer to VCF 9.1](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html) | Avi / NSX ALB upgrade in the VCF sequence |

---

## 2. Broadcom Knowledge Base

| Article | Covers |
| --- | --- |
| [KB 440630 – Upgrade Sequence and Related Issues for VCF and vSphere Foundation 9.1](https://knowledge.broadcom.com/external/article/440630/upgrade-sequence-and-related-issues-for.html) | Mandatory sequence + rolled-up known issues per component (License Server connect failures, Fleet Mgmt Appliance replacement, Identity Broker consolidation, cert SAN issues, import failures). Living document – re-check. |
| [KB 408127 – Converge workflow source-version requirement](https://knowledge.broadcom.com/) | VMware Live Site Recovery / vSphere Replication must be at **9.0.2.2 or later** for the Converge workflow onto the combined Protection and Recovery appliance |
| [KB 313905 – Build numbers and versions of VMware Live Site Recovery / SRM](https://knowledge.broadcom.com/external/article/313905/) | Maps SRM / VLSR build numbers to versions – needed to place a running DR pair against the Converge floor |
| [KB 306446 – Supported versions of VMware Cloud Foundation on VxRail](https://knowledge.broadcom.com/external/article/306446/) | The VCF-on-VxRail support matrix; terminates at the highest VxRail-brownfield-supported VCF version |
| VCF 9.1.0.0 release notes – "What's new" (VCF Operations / identity) | Script-based migration of users and groups from VMware Identity Manager to Identity Broker |

### Disaster Recovery / Protection and Recovery

| Page | Covers |
| --- | --- |
| [Convergence and Upgrade (VCF Protection and Recovery 9.1 installation guide)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/protection-and-recovery/9-1/protection-and-recovery-installation/setting-up-vmware-live-site-recovery-overview/convergence-and-upgrade.html) | The combined appliance; "convergence" for VLSR 9.0.2.3 and earlier; prerequisites, upgrade order, per-site Converge procedure, what is preserved |
| "Migrating VMware Identity Manager to Identity Broker" (VCF 9.1 identity guide) | The users/groups migration script; what it carries vs. what is rebuilt by hand |

### Dell VxRail

| Article | Covers |
| --- | --- |
| Dell KB **000478885** – "VxRail: How to perform an upgrade to VCF 9.1" | The VxRail plugin bundle step; VxRail Manager → VxRail Operations Manager conversion |
| Dell KB **000021470** – "VCF on VxRail: General Upgrade Information" | General VCF-on-VxRail upgrade information |
| Dell – "RPS General Procedure: VCF on VxRail Upgrade – Customer Preparation Guide" | The Dell RPS engagement: Technical Consultation, responsibility split, prerequisites |

---

## 3. Interoperability matrix + VCF Upgrade Planner (tools)

| Resource | Notes |
| --- | --- |
| [Broadcom Product Interoperability Matrix](https://interopmatrix.broadcom.com/) | **Upgrade Path** tool (source version → target build, per product; untick "Hide Patch Releases" for patch rows) and **Interoperability** tool (does A work with B). The authority for per-component source floors and cross-product compatibility. Moves over time – re-check per point release. |
| [VCF Upgrade Planner (hosted)](https://vmware.github.io/vcf-upgrade-planner/) | Interactive scenario planner → VCF 9.1: pick current env (vSphere / VCF) + installed products + versions + goal → phased workflow, networking/resource requirements, PDF export |
| [vmware/vcf-upgrade-planner (GitHub)](https://github.com/vmware/vcf-upgrade-planner) | Source. `docs/compat-data.json` (product + version catalogue) and per-scenario phase files. **Not modelled:** current SRM version data (link-only / stale), VIDM vs. Identity Broker interop, VxRail (link-only). |

Goal options the planner offers (VCF source): create new 9.1 fleet; expand
fleet by upgrading current instance; upgrade a workload domain within an
instance. Destination: 9.1.0.0 patch levels (…0400 as of review date).

---

## 4. Supplementary walkthroughs (NOT authoritative)

Useful for orientation and gotchas; do not cite as the procedure.

| Post | Covers |
| --- | --- |
| [Modernizing Infrastructure: VCF 5.2.x → 9.1 Upgrade Guide](https://blogs.vmware.com/cloud-foundation/2026/06/05/modernizing-infrastructure-vmware-cloud-foundation-5-2-x-to-9-1-upgrade-guide/) | 8-step orchestrated sequence (Operations → Cloud Proxy metrics → SDDC Manager → Management Services → NSX mgmt plane → vCenter → ESX → NSX Edges); guardrails: vCenter root pw 15–20 chars, lowercase FQDNs, TLS syslog port 1514, vCLS deactivated by default |
| [Modernizing Infrastructure: VCF 9.0.x → 9.1 Upgrade Guide](https://blogs.vmware.com/cloud-foundation/2026/07/28/modernizing-infrastructure-vmware-cloud-foundation-9-0-x-to-9-1-upgrade-guide/) | Ordered path: VCF Operations + Cloud Proxy → SDDC Manager → deploy Management Services + License Server → license transfer → NSX Global Manager (federated only) → NSX Manager + vCenter → ESX + vSAN witness → NSX Edge + finalize. Post: VMware Tools 13.1, VM compat, vSAN on-disk format, vSAN File Service |
| [VCFA 9.0 → 9.1 Upgrade: Precheck and Execution Stages (deep dive)](https://blogs.vmware.com/cloud-foundation/2026/07/27/modernizing-infrastructure-a-deep-dive-into-the-vmware-cloud-foundation-automation-9-0-to-9-1-upgrade-precheck-and-execution-stages/) | VCF Automation-specific precheck + execution detail |
| [How to Upgrade to VMware Cloud Foundation 9.1](https://blogs.vmware.com/cloud-foundation/2026/06/18/how-to-upgrade-to-vmware-cloud-foundation-9-1/) | High-level overview / entry point |
| [Angry Admin – 9.0.2 → 9.1 practical runbook notes](https://angrysysops.com/2026/05/27/upgrading-vmware-cloud-foundation-from-9-0-2-to-9-1-practical-runbook-notes/) | Field notes, third-party |

---

## Consolidated sequence – from the VCF Upgrade Planner

Driven through the planner on 2026-08-27 for the engagement shape:
**Deployment = VCF · Current env = VCF 5.2 + Dell VxRail (HCI) · Goal = Create
New VCF 9.1 Fleet · Target = 9.1.0.0400**. The planner's phase list *is* its
authoritative sequence; each phase links out to the matching TechDocs page
(the §1 URLs) for the actual procedure.

### Add-on compatibility gate (planner pre-check)

Source patch matters. Against target **9.1.0.0400** the planner reports:

| Source | Result |
| --- | --- |
| VCF **5.2.2** | ✅ supported – can upgrade directly to 9.1.0.0400 |
| VCF 5.2.1 | ❌ "Upgrade Path Not Supported" |
| VCF 5.2.3.0 | ❌ not offered / unsupported |
| VCF 5.2.4.0 | ❌ "No Destination Available … wait for a future VCF 9.1.x" |

VxRail source versions the planner recognises: 8.0.300 / 8.0.310 / 8.0.361 /
8.0.380. Planner target builds: 9.1.0.0, .0100, .0200, .0300, .0400 – there
is **no "9.1.1"** in the tool; the engagement's "VCF 9.1.1" must be pinned to
a concrete 9.1.0.0x00 build. **Confirm the customer's exact 5.2.x patch –
if it is not 5.2.2, the direct path may not exist yet.**

### Core sequence (core components only) – 9 phases / 10 steps

Each phase is a **safe stopping point** (pause, validate, resume).

1. **VCF Operations** upgrade (the fleet-managing instance). Deploy Cloud
   Proxy (1 node / 1 IP). VCF Operations must be licensed within 90 days;
   License Server is deployed in Phase 3.
2. **SDDC Manager** upgrade.
3. **Deploy VCF Management Services** cluster **+ License Server**. Needs a
   **/28 CIDR minimum**, 12 IPs minimum (30 recommended); FQDNs for Fleet
   component service, Instance component service, VCF services runtime,
   Identity Broker, License server. VCF services runtime uses internal range
   **198.18.0.0/15** – must not overlap the mgmt network (changeable to
   240.0.0.0/15 or 250.0.0.0/15 only via JSON spec at deploy time). MS nodes:
   Small = 4 nodes × 12 vCPU / 24 GB / 3 TB; License server 1 × 2 vCPU / 4 GB / 12 GB.
4. **VCF Automation** upgrade. New instance; existing FQDN + node IPs
   auto-transferred as VIPs; external LB config unchanged. Automation must
   sit on the Management Cluster before VCF can upgrade it. (8.18.x → 9.1.)
5. **NSX Local Manager(s)** upgrade – check the Product Interoperability Matrix first.
6. **vCenter** upgrade – via VCF Operations → Fleet Management. Replace
   Integrated Windows Authentication with another IdP first. Documented RDU
   rollback: shut down target vCenter → stop RDU → roll back the 8.0 vCenter
   Workspace ONE broker precheck change → reboot.
7. **Dell VxRail** upgrade – planner defers entirely to Dell: "Reach out to
   Dell on steps and services." Pre-checks and Solve procedures vary by
   hardware/version; do **not** use the online VxRail Manager UI / vCenter
   plugin path. → feeds `docs/vxrail-addendum.md`.
8. **NSX Finalize**.
9. **Effective versions at 9.1.0.0400** (reference): vCenter **9.1.0.0300**,
   ESX/vSphere **9.1.0.0200**, NSX Local Manager **9.1.0.0200**; SDDC Manager
   **9.1.0.0400**, VCF Operations **9.1.0.0400**, VCF Automation **9.1.0.0200**.

### How optional components extend the sequence – 15 phases / 17 steps

Selecting SRM, Avi, HCX, NSX Federation, vSphere Supervisor, VCF Operations
for Logs, and vSAN File Service expands the plan to:

1. VCF Operations upgrade
2. **Disaster Recovery Products** – SRM / vSphere Replication upgrade
3. **Upgrade Avi Load Balancer + Deploy License Hub** – License Hub 2.0
   appliance: 1 mgmt IP + a 2-contiguous-IP pool; Default size 1 × 6 vCPU / 12 GB / 256 GB
4. SDDC Manager upgrade
5. Deploy VCF Management Services + License Server
6. VCF Automation upgrade
7. **VMware HCX** upgrade
8. **NSX Global Manager** upgrade – Federation only; all sites on compatible
   versions, connectivity between sites, **before** Local Managers
9. NSX Local Manager(s) upgrade
10. vCenter upgrade
11. Dell VxRail
12. **NSX Edge & NSX Finalize** (Edge nodes now explicit, after ESX/VxRail)
13. **Post-Infrastructure Products** – Log Management: **no in-place upgrade**,
    deploy fresh
14. **vSAN File Service** upgrade
15. Effective versions at 9.1.0.0400

### Guardrails called out by the supplementary guides (still verify)

vCenter root password 15–20 chars · strictly lowercase forward/reverse DNS ·
TLS syslog on port 1514 · vCLS deactivated by default · post-upgrade: VMware
Tools 13.1, VM hardware compatibility, vSAN on-disk format, vDS version.

> The planner phase list is authoritative for **ordering and conditionality**.
> For each phase's actual steps, IP counts, and version rows, still open the
> linked TechDocs page and quote it verbatim before it lands in `docs/`.
