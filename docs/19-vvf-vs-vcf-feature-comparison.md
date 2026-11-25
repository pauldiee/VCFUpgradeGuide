# VVF vs VCF: what's included and what's not

Summarized from Broadcom's official [VMware Cloud Foundation 9.1.1 and
VMware vSphere Foundation 9.1.1: Feature Comparison & Upgrade
Paths](https://www.vmware.com/docs/vmware-cloud-foundation-9-1-feature-comparison-and-upgrade-paths)
whitepaper (revision dated **Sep 30, 2026**), read row by row from the
PDF's own tables. The source is a ~200-row matrix; this doc keeps every
row where VVF and VCF **differ**, and collapses the rows where they
don't. Go to the PDF for the full list of shared features.

Applies to the VCF-vs-VVF licensing decision itself – not the standalone
vSphere track, which has neither entitlement.

**About the third column.** The whitepaper compares three offerings:
VVF, **VCF Edge** (*"an optimized configuration of VMware Cloud
Foundation tailored for edge use cases"*) and VCF. In the 9.1.1 tables
the VCF Edge column matches the VCF column on every row, so the tables
below show VVF vs VCF only. Read "VCF" as "VCF or VCF Edge".

**9.1.2 changes the picture in three places** (release notes, 24 Nov
2026), not yet in the whitepaper: NSX can be deployed in VVF as the
platform for vDefend ([Networking](#nsx-in-vvf-from-912-the-vdefend-platform)),
vSAN Object Storage is GA ([Compute and storage](#compute-and-storage)),
and vSphere Configuration Profiles manage ESX host configuration. The
tables below are still the 9.1.1 whitepaper; the notes under them carry the
9.1.2 changes.

**Legend:** ✓ included · – not included · **Add-on** needs a separately
purchased Advanced Service, even on that tier · bracketed numbers are the
whitepaper's footnotes, quoted in [Footnotes that matter](#footnotes-that-matter).

---

## At a glance

| Component | VVF | VCF |
| --- | --- | --- |
| vSphere (ESX, vCenter, vLCM) | ✓ | ✓ |
| vSAN | ✓ | ✓ |
| vSphere Kubernetes Service (VKS) and Supervisor | ✓ (fewer Supervisor services, see below) | ✓ |
| VCF Operations | ✓ **limited** (see [VCF Operations](#vcf-operations)) | ✓ |
| **Log Management** | ✓ **full** (see [Log Management](#log-management)) | ✓ |
| Lifecycle via VCF Operations fleet management | – (*"VVF customers utilize vLCM"*) | ✓ |
| VCF Installer | ✓ | ✓ |
| NSX (overlay, routing, Edge, VPCs) | – (from 9.1.2: security platform for a vDefend purchase, see [Networking](#nsx-in-vvf-from-912-the-vdefend-platform)) | ✓ |
| VCF Operations for networks | – | ✓ |
| VCF Automation | – | ✓ |
| Private AI Services | – | ✓ (Private AI Services marked [6], [10]) |

The whitepaper's own one-liners: VCF *"delivers integrated components,
including vSphere, vSphere Kubernetes Service, VCF Operations, VCF
Operations for networks, VCF Operations fleet management, VCF Automation,
vSAN, and NSX"*; VVF *"delivers some VCF capabilities or limited versions
thereof, including vSphere, vSphere Kubernetes Service, VCF Operations and
vSAN."*

This matches the track split in [`docs/01-overview.md`](01-overview.md#confirm-which-track-applies):
VVF has no fleet management layer, which is why the
[standalone VVF upgrade](14-standalone-vvf-upgrade.md) is a manual vLCM
procedure rather than the [VCF phase sequence](13-vcf-upgrade-sequence.md).

---

## Log Management

**Log Management is fully included in VVF.** Every log row in the
whitepaper is ticked for all three offerings, so a VVF customer does not
need VCF to keep (or gain) centralized logging. This matters for the
[Log Management migration](11-log-management-migration.md): it applies to
VVF fleets as much as VCF ones.

| Feature | VVF | VCF |
| --- | --- | --- |
| Log Management | ✓ | ✓ |
| Logs Alerting | ✓ | ✓ |
| Logs Query API | ✓ | ✓ |
| Logs Scheduled dashboard reports | ✓ | ✓ |
| Logs Partitioning | ✓ | ✓ |
| Logs Content Pack support | ✓ | ✓ |
| Audit events across vCenter, vSphere, vSAN, and NSX | ✓ | ✓ |

---

## VCF Operations

VVF gets VCF Operations, but a "limited version". This is the full list
of VCF Operations rows from the whitepaper, so the gap is visible in one
place.

**In VVF:**

| Feature | VVF | VCF |
| --- | --- | --- |
| VCF Installer | ✓ | ✓ |
| License Management (IPv4, IPv6) | ✓ | ✓ |
| Global inventory | ✓ | ✓ |
| Identity and Access Management, SSO (vSphere interface) | ✓ | N/A |
| GPU & vGPU monitoring | ✓ | ✓ |
| VCF Health and Diagnostics | ✓ | ✓ |
| Storage Operations (vSAN) | ✓ | ✓ |
| Visualization (alerts, dashboards, views, reports, heat maps, super metrics, relationship mapping) | ✓ | ✓ |
| Metric visualization using PromQL | ✓ | ✓ |
| Performance Monitoring and Analytics | ✓ | ✓ |
| Troubleshooting with guided remediation | ✓ | ✓ |
| Cost Management and Optimization (service and data center costs, reclamation, planning) | ✓ | ✓ |
| Custom Profiles for VMs | ✓ | ✓ |
| Data Protection and Recovery (integrated Live Cyber Recovery and Live Site Recovery) | ✓ | ✓ |
| Service Discovery and Application Dependency Mapping | ✓ | ✓ |
| Infrastructure Management Packs (SDDC, compute, storage, network, K8s) | ✓ | ✓ |
| Supervisor Cluster monitoring (metrics and dashboard) | ✓ | ✓ |
| VKS cluster monitoring | ✓ | ✓ |
| VCF Operations orchestrator | ✓ | ✓ |

**VCF only:**

| Feature | VVF | VCF |
| --- | --- | --- |
| Lifecycle Management | – (vLCM instead) | ✓ |
| Certificate Management | – | ✓ |
| Password Management | – | ✓ |
| 3rd-party password vault integration (OIDC) | – | ✓ |
| Centralized Tag Management | – | ✓ |
| Identity and Access Management, SSO (VCF Operations interface) | – | ✓ |
| VCF AI Assistant | – | ✓ [17] (Tech Preview) |
| Real-time monitoring | – | ✓ |
| Real-time predictive capacity management (what-if, right-sizing, workload optimization) | – | ✓ |
| VKS Observability (real-time) | – | ✓ |
| Out-of-the-box discovery, monitoring and troubleshooting for packaged applications | – | ✓ |
| App & Management Packs (databases, middleware, app management) | – | ✓ |
| Application Monitoring (Telegraf agent) | – | ✓ |
| Prometheus Management Pack Builder, PromQL API | – | ✓ |
| Security Operations (SecOps) | – | ✓ |
| Compliance Management with remediation (regulatory baselines, PCI, custom templates, vSphere hardening) | – | **Add-on** (Advanced Cyber Compliance) |
| Configuration Drift Management (deprecated) | – | **Add-on** (Advanced Cyber Compliance) |

Two things in this table are easy to misread:

- **SSO is split by interface.** VVF gets SSO at the **vSphere** interface;
  VCF gets it at the **VCF Operations** interface, and the vSphere-interface
  row is marked **N/A for VCF** (not for VVF). A VVF customer does not get
  fleet-level SSO, which is also why the
  [Identity Broker migration](03-identity-broker-migration.md) is VCF only.
- **Orchestrator appears twice.** "VCF Operations orchestrator" is ticked
  for VVF in the VCF Operations section, while "Workflow Orchestration
  (VCF Operations orchestrator)" in the VCF Automation section is VCF
  only. The whitepaper doesn't explain the split; treat orchestrator use
  on VVF as something to confirm with the account team.

---

## Compute and storage

Nearly all compute, storage and business-continuity rows are in both:
vLCM, Live Patching, vCenter Quick Patching, DRS, HA, FT, vMotion,
vSphere Replication, Memory Tiering, vGPU, vSAN ESA/OSA, stretched and
2-node clusters, File Services, encryption, and so on. The rows that
differ:

| Feature | VVF | VCF |
| --- | --- | --- |
| Storage Service, Network Service (Supervisor) | ✓ [2] limited to VM Service and VKS | ✓ |
| Regional Harbor Registry Service | – | ✓ |
| ArgoCD Operator | – | ✓ |
| Secret Store Service | – | ✓ |
| IaaS Policy Service | – | ✓ |
| VKS multi-cluster lifecycle management | – | ✓ |
| Confidential Computing [15] | – | ✓ |
| DPU support and dual DPU support | – | ✓ |
| vSAN cyber recovery clusters | – | ✓ [15] |
| vSAN Object Storage | – | ✓ [17] (Tech Preview; GA in 9.1.2, see below) |
| Host Profiles, Auto Deploy | ✓ | ✓ [3] not integrated with fleet management |
| External storage (VMFS on FC, NFS v3) | ✓ | ✓ as principal **or** supplemental |
| External storage (VMFS on iSCSI / FCoE / NVMe, NFS v4.1) | ✓ | ✓ supplemental only |

The external-storage rows reflect VCF's principal/supplemental storage
model: of the external array types, only VMFS on FC and NFS v3 can be
principal storage in VCF. VVF has no such distinction.

**What 9.1.2 changes here** (TechDocs, read 2026-11-24):

- **vSAN Object Storage is GA.** The [vSAN 9.1.2.0 release
  notes](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/vsan-9-1-2-0-release-notes.html)
  list *"vSAN Object Storage General Availability"*: *"S3-compatible object
  storage on a vSAN Express Storage Architecture (ESA) cluster"*. Known
  issue worth knowing up front: *"If you are using VMware Avi Load
  Balancer and would like to deploy and use vSAN Object Storage, please
  contact Broadcom Support."* The release notes don't say whether it moves
  into VVF; until the whitepaper is revised, treat it as VCF only.
- **vSphere Configuration Profiles manage ESX hosts, next to Host
  Profiles.** [vCenter 9.1.2.0 release
  notes](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/vcenter-9-1-2-0-release-notes.html):
  when you enable them on an existing cluster, attached Host Profiles
  *"are not detached and you can continue using them"*, and *"You can
  switch from using vSphere Host Profiles to enabling and using vSphere
  Configuration Profiles at any time, but the change is irreversible."*
  Evaluate on a test cluster first.

---

## Networking

VVF networking is the **vSphere Distributed Switch** feature set; NSX is
VCF only, at every level.

| Feature | VVF | VCF |
| --- | --- | --- |
| VDS, LACP, load-based teaming, NIOC, private VLAN, MAC learning, BPDU guard, guest VLAN tagging, VLAN-backed networking, L2 multicast | ✓ | ✓ |
| Port Mirroring, NetFlow/IPFIX, Packet Capture | ✓ | ✓ |
| Container networking with Antrea [16] | ✓ | ✓ |
| Quality of Service | ✓ NIOC | ✓ NIOC & NSX |
| Virtual networking (overlay), Spoofguard, L3 multicast | – | ✓ |
| Enhanced Datapath (incl. for DPUs) | – | ✓ |
| IPv4/IPv6 routing, dynamic routing (OSPFv2/BGP/BFD), VRF, EVPN | – | ✓ |
| NAT, L2/L3 VPN, NSX Edge bridge, DNS/DHCP/IPAM | – | ✓ |
| Container networking with NCP [16] | – | ✓ |
| Policy, tagging and grouping; multi-tenancy with Projects; VPCs | – | ✓ |
| Manager/Controller clustering, Federation, NSX Edge (VM and bare metal), automated host prep | – | ✓ |
| Traceflow, Live Traffic Analysis | – | ✓ |

**Load balancing** has three separate rows, worth reading carefully:

| Feature | VVF | VCF |
| --- | --- | --- |
| Foundational Load Balancing (a Supervisor included service) | ✓ | ✓ |
| Layer 4 load balancing for vSphere Supervisor (VM Service, vSphere Pods, VKS) [11] [12] | ✓ | ✓ |
| Load balancing for VCF infrastructure components (VCF appliances) [12] | – | ✓ |

Footnote [12] puts a deadline on the built-in VCF load balancing, see
[the gotcha below](#upgrade-gotcha-built-in-vcf-load-balancing-is-being-retired).

### NSX in VVF from 9.1.2: the vDefend platform

The table above says NSX is VCF only. From 9.1.2 that is no longer the
whole story, but it is also not "full NSX in VVF". TechDocs, read
2026-11-24, not tested:

- The [NSX 9.1.2.0 release
  notes](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/nsx-9-1-2-0-release-notes.html)
  add *"NSX Entitlement in VVF"*: *"This feature lets users deploy VMware
  NSX and vDefend directly in a VMware vSphere Foundation (VVF)
  environment"*. The restored standalone NSX lifecycle *"also supports NSX
  platform for vDefend virtual patching, a feature available to customers
  who purchase VVF and vDefend."* Standalone means: install NSX without
  the full-stack VCF Installer, upgrade it to 9.1.2 without converging, and
  operate it from NSX Manager.
- The [vDefend 9.1 Edition
  Summary](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-1/vdefend-feature-and-edition-guide/vdefend-feature-guide-edition-summary.html)
  (updated 2026-11-24): vDefend *"can be purchased as add-ons with a VMware
  Cloud Foundation or VMware vSphere Foundation 9.1.2 purchase"*.
- The vDefend entitlement tables
  ([Distributed Firewall](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-1/vdefend-feature-and-edition-guide/vdefend-feature-guide-entitlement/vdef-feature-guide-distributed-firewall-adv-threat-prevention.html),
  [Gateway Firewall](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-1/vdefend-feature-and-edition-guide/vdefend-feature-guide-entitlement/vdef-feature-guide-gateway-firewall-adv-threat-prevention.html))
  split the base features. *"Provided by VCF/VVF License"*: security tags,
  grouping and Traceflow. *"Provided by VCF License"* only: SpoofGuard and
  every Edge and routing feature (Active/Standby Edge, distributed and
  static routing, BFD, BGP, ECMP, VRFs, EVPN, OSPF, NAT, L2 and L3 VPN,
  QoS). The firewall features themselves come from the vDefend licence.

So for a VVF customer, NSX 9.1.2 is the security platform for a vDefend
purchase (distributed firewall and the other vDefend features); overlay
networking, routing, Edge services, NAT and VPN stay VCF only.

---

## VKS and VCF Cloud Services

| Feature | VVF | VCF |
| --- | --- | --- |
| VKS (cluster scalability, fast deploy, node pool placement) | ✓ | ✓ |
| VM Service: import VMs without changing the network | ✓ | ✓ |
| Harbor Image Registry Service, Container Service | ✓ | ✓ |
| Storage and Data Services | – | ✓ |
| Network Services (dual-network support for VKS, Supervisor via DGTW) | – | ✓ |
| Private AI Services | – | ✓ |
| GitOps Integration | – | ✓ |
| Supervisor Services: multi-cluster zones and cluster decommission | – | ✓ |
| Secret Service | – | ✓ |
| External DNS, Cert Manager | – | ✓ |

---

## Entirely VCF only

Whole sections of the whitepaper with no VVF tick at all:

- **VCF Automation** – self-service catalog and IaaS, private cloud
  services, blueprints and IaC, Git integration, Terraform provider, VKS
  multi-cluster management, governance and policies, tenant management,
  content management, network and security automation. Several rows are
  scoped to the "Org for All Apps" or "Org for VM Apps" org types
  (footnotes [5] to [7]).
- **VCF Operations for networks** – network visibility and
  troubleshooting for vSphere and NSX, virtual and physical flows,
  flow analytics, application discovery, physical device integration,
  path visibility, network map, intents. Its Avi and vDefend integrations
  additionally need those add-ons.
- **Private AI** – model store and runtime, multi-tenant model sharing,
  data indexing and retrieval, agent builder, MCP, vector databases, deep
  learning VM templates.

---

## Advanced Services (add-ons)

Per footnote [13], *"Advanced services are available for separate
purchases and are not included in the core VMware Cloud Foundation or
VMware vSphere Foundation offerings."* So a ✓ here means "can be bought
for this tier", not "included".

| Add-on | Available for VVF | Available for VCF |
| --- | --- | --- |
| Additional Storage Capacity – vSAN | ✓ | ✓ |
| Site Recovery Manager | ✓ | ✓ |
| Live Recovery Cloud | ✓ | ✓ |
| Load Balancing | ✓ | ✓ |
| Advanced Cyber Compliance (ACC): compliance enforcement, on-prem cyber and disaster recovery, policy-based VPC connectivity, confidential computing | – | ✓ |
| Advanced Security | – | ✓ |
| Application Services | – | ✓ |
| Data Services | – | ✓ |
| Network Observability | – | ✓ |
| Business Operations | – | ✓ |
| Identity Security | – | ✓ |

Note **Any-to-vSAN Replication** is in all three tiers but footnote [14]
says it *"Requires VMware Site Recovery Manager (SRM) License"* – relevant
for the [Disaster Recovery](02-disaster-recovery.md) prep.

---

## Upgrade paths from older products

The whitepaper's last section maps previous SKUs to the current ones.
Useful when a customer asks "what do we land on?":

| Previous products | Recommended solution |
| --- | --- |
| vSphere Enterprise Plus, Enterprise, for Desktop, or Scale-Out | VVF |
| vSphere + vROps / Aria Suite Standard / vRCU Standard | VVF |
| vCloud Suite Standard (Aria Suite Standard + vSphere Enterprise Plus) | VVF |
| vSphere + vSAN (no NSX, no Aria) | VCF, **or** VVF + vSAN add-on |
| vSphere + vSAN + Aria, or vSphere + vSAN + NSX, or all four | VCF |
| vSphere + Aria Suite Enterprise / vRCU Enterprise | VCF |
| vSphere + vROps + vRA, Aria Suite Advanced, or vRCU Advanced | VCF |
| vCloud Suite Enterprise or Advanced | VCF |
| Any combination including NSX (networking/security path) | VCF + Firewall |
| VCF Enterprise, Advanced, Standard, or Starter | VCF + Firewall |

---

## Upgrade gotcha: built-in VCF load balancing is being retired

Quoted verbatim from footnote [12]: *"It is recommended that customers
requiring general-purpose or advanced load balancing capabilities should
purchase Avi Load Balancer. Customers who need additional time to migrate
from existing VCF load balancing functionality to Avi may continue using
full VCF load balancing capabilities until **May 30, 2027**, provided they
have purchased the required Avi licenses."* It refers to Broadcom KB
439411. If a fleet still relies on the legacy built-in VCF load balancer,
that's a hard external deadline to plan around, independent of any
ESXi/vCenter upgrade timeline – see [Avi + License Hub
upgrade](09-avi-license-hub-upgrade.md) if Avi is (or will be) in use.

---

## Extending VVF to full VCF

If a standalone VVF fleet is being extended into full VCF as part of the
upgrade project (rather than staying VVF), the tables above explain *why*
certain prerequisites exist – NSX requires VDS, so a VSS-based VVF
cluster has to migrate first: see [VSS to VDS
migration](08-vss-to-vds-migration.md). VVF *can* also be brought under
Fleet Management (via the VCF Installer) without changing the entitlement
comparison above – see [`docs/01-overview.md`](01-overview.md#confirm-which-track-applies).

---

## Footnotes that matter

Quoted from the whitepaper's footnote list (only the ones referenced in
the tables above):

- **[2]** *"Denotes features that are limited to the support of VM Service and VKS."*
- **[3]** Features *"compatible with VCF but"* not *"integrated with VCF
  Operations fleet management"* (the source reads "but t integrated", a
  typo for "but not").
- **[5] / [6] / [7]** Available in both Org for All Apps and VM Apps / in
  Org for All Apps / in Org for VM Apps (VCF Automation org types).
- **[10]** *"Requires PAIF-N add-on."*
- **[11]** *"Ingress / Gateway API provided by Contour Ingress Controller / Supervisor Service."*
- **[12]** Built-in VCF load balancing until May 30, 2027 (quoted in full
  [above](#upgrade-gotcha-built-in-vcf-load-balancing-is-being-retired)).
- **[13]** Advanced Services are separate purchases (quoted [above](#advanced-services-add-ons)).
- **[14]** *"Requires VMware Site Recovery Manager (SRM) License."*
- **[15]** *"Requires VCF Advanced Cyber Compliance (Advanced Services Add-on)."*
- **[16]** *"Support for Antrea will be provided for VMware VKS only. Support for NCP will be provided for VMware vSphere Supervisor, and Tanzu Elastic Runtime only."*
- **[17]** *"Tech Preview"*

---

## Sources

- [VMware Cloud Foundation 9.1.1 and VMware vSphere Foundation 9.1.1: Feature Comparison & Upgrade Paths](https://www.vmware.com/docs/vmware-cloud-foundation-9-1-feature-comparison-and-upgrade-paths) – Broadcom, revision dated Sep 30, 2026 – the full feature-by-feature matrix this doc summarizes, read from the PDF's tables (pages 3 to 21)
- 9.1.2.0 release notes for [NSX](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/nsx-9-1-2-0-release-notes.html), [vSAN](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/vsan-9-1-2-0-release-notes.html) and [vCenter](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-2-0-release-notes/vcenter-9-1-2-0-release-notes.html), and the vDefend 9.1 [Edition Summary](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/vdefend/vdefend-firewall/9-1/vdefend-feature-and-edition-guide/vdefend-feature-guide-edition-summary.html) and entitlement tables (all read 2026-11-24) – the 9.1.2 notes on NSX in VVF, vSAN Object Storage and Configuration Profiles
- Broadcom KB 439411 – Avi licensing and the VCF built-in load-balancer migration deadline (May 30, 2027), referenced by the whitepaper's footnote [12]
