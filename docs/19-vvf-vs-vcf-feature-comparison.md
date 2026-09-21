# VVF vs VCF: what's included and what's not

Summarized from Broadcom's official [VMware Cloud Foundation 9.1.1 and
VMware vSphere Foundation 9.1.1: Feature Comparison & Upgrade
Paths](https://www.vmware.com/docs/vmware-cloud-foundation-9-1-feature-comparison-and-upgrade-paths)
whitepaper (Sep 03, 2026) – the authoritative, current source. That
document is a ~200-row table covering every feature; this doc pulls out
the categories that actually change an upgrade or track decision, not a
line-by-line reproduction. Go to the source PDF for the full matrix.

Applies to the VCF-vs-VVF licensing decision itself – not the standalone
vSphere track, which has neither entitlement.

---

## The headline difference

**VCF** is the full-stack private-cloud platform: vSphere, vSAN, **NSX**,
**VCF Operations**, **VCF Operations for Networks**, **VCF Automation**,
and Fleet Management, as a single SKU.

**VVF** delivers vSphere, vSAN, and a **limited version of VCF
Operations** – no NSX, no VCF Automation, no Fleet Management. This
matches what [`docs/01-overview.md`](01-overview.md) already documents
operationally: VVF is patched with standard vSphere lifecycle mechanisms
(vLCM directly against vCenter/ESXi) instead of SDDC-Manager-driven
phases, because there's no Fleet Management layer underneath it to drive
those phases.

---

## Entirely VCF-only (not available in VVF at all)

- **NSX** – the whole software-defined networking layer: Manager/Controller
  clustering, Federation, dynamic routing (OSPF v2 / BGP / BFD), VRF,
  EVPN, NAT, L2/L3 VPN, DNS/DHCP/IPAM via NSX, NSX Edge (VM and bare-metal),
  Traceflow, live traffic analysis. VVF's networking tops out at plain
  vSphere Distributed Switch features (VLAN-backed networking, NIOC QoS,
  LACP, private VLAN, port mirroring, NetFlow/IPFIX) – no NSX overlay at
  all, at any tier.
- **VCF Automation** – the entire self-service IaaS / cloud-management
  layer: Self-Service Catalog, blueprints, tenant management, private
  cloud services, network & security automation, workflow orchestration.
- **VCF Operations for Networks** – network visibility, flow analytics
  (virtual and physical), NSX + underlay topology, network assessment
  reports.
- **Private AI Services** – model store/runtime, vector databases, data
  indexing/retrieval, AI agent builder, MCP.
- **Fleet Management / Lifecycle Management through VCF Operations** –
  per the whitepaper's own footnote, *"VVF customers utilize vLCM"*
  instead.
- Several **VCF Operations** capabilities specifically: Certificate
  Management, Password Management, 3rd-party password vault integration
  (OIDC), Centralized Tag Management, real-time monitoring, Security
  Operations (SecOps), Telegraf application monitoring, Prometheus
  Management Pack Builder, and Identity/SSO **via the VCF Operations
  interface itself** – VVF's row for this is listed as **N/A**, not just
  "not included"; VVF only gets SSO at the vSphere-interface level.

---

## Present in both, but with a caveat worth knowing

- **Host Profiles / Auto Deploy** – full support in VVF. In VCF, the
  whitepaper marks these with a footnote: *"compatible with VCF but not
  integrated with VCF Operations fleet management."* Present, but not
  part of Fleet Management's automated day-2 lifecycle – don't assume a
  VCF fleet's Host Profile remediation behaves the same as it would
  standalone.
- **Storage Service / Network Service** in VVF are marked *"limited to
  the support of VM Service and VKS"* – narrower than the VCF version,
  not the full-featured equivalent.
- **Site Recovery Manager, Live Recovery Cloud, and (basic) Load
  Balancing** appear as available under *both* VVF and VCF – but they're
  **Advanced Services add-ons**, purchased separately, not included in
  either core SKU. Same story for **Avi Load Balancer** and **vDefend**
  (NSX Firewall network segmentation) under VCF – both require their own
  separate add-on even though the base platform is VCF.

---

## Actionable gotcha for an upgrade project: built-in VCF load balancing is being retired

Quoted verbatim from the whitepaper's footnote [12]: *"It is recommended
that customers requiring general-purpose or advanced load balancing
capabilities should purchase Avi Load Balancer. Customers who need
additional time to migrate from existing VCF load balancing functionality
to Avi may continue using full VCF load balancing capabilities until
**May 30, 2027**, provided they have purchased the required Avi
licenses."* Per Broadcom KB 439411. If a fleet is still on the legacy
built-in VCF load balancer, that's a hard external deadline to plan
around, independent of any ESXi/vCenter upgrade timeline – see [Avi +
License Hub upgrade](09-avi-license-hub-upgrade.md) if Avi is (or will
be) in use.

---

## Extending VVF to full VCF

If a standalone VVF fleet is being extended into full VCF as part of the
upgrade project (rather than staying VVF), the licensing tables above
explain *why* certain prerequisites exist – NSX requires VDS, so a
VSS-based VVF cluster has to migrate first: see [VSS to VDS
migration](08-vss-to-vds-migration.md). VVF *can* also be brought under
Fleet Management (via the VCF Installer) without changing the underlying
entitlement comparison above – see [`docs/01-overview.md`](01-overview.md#confirm-which-track-applies).

---

## Sources

- [VMware Cloud Foundation 9.1.1 and VMware vSphere Foundation 9.1.1: Feature Comparison & Upgrade Paths](https://www.vmware.com/docs/vmware-cloud-foundation-9-1-feature-comparison-and-upgrade-paths) – Broadcom, Sep 03, 2026 – the full feature-by-feature matrix this doc summarizes
- Broadcom KB 439411 – Avi licensing and the VCF built-in load-balancer migration deadline (May 30, 2027), referenced by the whitepaper's footnote [12]
