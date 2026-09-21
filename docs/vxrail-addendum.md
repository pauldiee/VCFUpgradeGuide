# VxRail Addendum

Extra steps for a **Dell VxRail** environment, layered **on top of** the
[Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) – not a replacement
for it (VxRail assumes SDDC Manager driving the fleet, so this addendum is
full-VCF only). Read that flow first; this doc only covers what is
different or additional because the hardware is VxRail. The non-hardware
workstreams (Aria → VCF fleet, Identity, Disaster Recovery, integrations)
are general – see the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
do not duplicate them here.

> **Status: draft.** Structure and the Dell process below are from a live
> VxRail 5.2.2 → VCF 9.1 planning cycle (planned against 9.1.0; **VCF 9.1.1
> went GA on 2026-09-03**). Re-confirm every version, build, and step against
> the current Dell KBs and the Broadcom matrix for your target build.

---

## Release-stream context

VCF on VxRail follows a **Dell-coordinated release stream** separate from the
standard VCF cadence – VxRail Manager and SDDC Manager have historically
interacted directly during cluster lifecycle operations, and VxRail-specific
VCF builds ship from Dell.

- **Supported versions:** Broadcom **KB 306446** ("Supported versions of
  VMware Cloud Foundation on VxRail").
- **Minimum source:** VCF 5.2 on VxRail 8.0.300.
- **Dell recommends:** VCF **5.2.2** on VxRail **8.0.361 or later** before
  starting the 9.1 upgrade.

---

## What changes in VCF on VxRail 9.x

The integration model changes – a brownfield 5.x → 9.x move is a **model
conversion, not a patch**.

| Area | 5.x model | 9.x model |
| --- | --- | --- |
| Software lifecycle | SDDC Manager interacts directly with VxRail Manager | SDDC Manager no longer interacts with VxRail Manager; standard VCF lifecycle management |
| Hardware lifecycle | VxRail Manager handles software **and** hardware/firmware | A new component (Dell-internal "Vx0 Manager" / "VxRail.next") handles hardware lifecycle and firmware – primary in the management domain, secondary alongside each workload-domain cluster |
| Hypervisor patching | vSphere Update Manager (VUM) baselines | **vSphere Lifecycle Manager (vLCM) images – mandatory.** Convert every baseline-managed cluster before the upgrade |
| Bundle stream | VxRail-specific VCF builds | Single VCF codebase across vendors; VxRail nodes treated like vSAN Ready Nodes |
| Dell engagement | Optional for routine upgrades | **Dell Professional Services (RPS) engagement expected** for the brownfield conversion |

**VxRail Manager → VxRail Operations Manager conversion.** The upgrade converts
the legacy VxRail Manager (VXM) appliance to the new VxRail Operations Manager
(VOM) architecture. This is out-of-family. During the conversion the vCenter
VxRail plugin UI is **briefly unavailable** while the management IP switches
from VXM to VOM – this is expected.

---

## Unsupported deployment types (VCF on VxRail 9.1)

Not supported for the 9.1 upgrade path – wait for a later release:

- Stretched clusters
- Dynamic nodes
- 2-node deployments
- Satellite node deployments

---

## The Dell RPS engagement

### Technical Consultation

Dell runs a **Technical Consultation** per SDDC before the upgrade. It
produces:

- Pre-check results (Dell's SOS and VCFverify tools, plus Broadcom's own
  TC-run health check) and a go / no-go.
- The **agreed code path** (source VCF + VxRail versions → target VCF + VxRail
  versions) and method (Sequential).
- A per-domain **upgrade plan** with current and target build numbers for
  every component.
- A **responsibility split** (see below).
- A rough time estimate.
- A checklist covering: number of workload domains / clusters / hosts;
  BOM compatibility; async-patched-site status; code download method
  (online / offline); stretched cluster; witness nodes; **NSX Federation**;
  SDDC Federation; **Aria enabled**; **Tanzu enabled**; RP4VMs enabled.

The consultation is **per site** – a two-site (primary + DR) estate needs a
consultation and plan for each, aligned so the DR pair moves in step.

### Responsibility split

Dell's upgrade order and who runs each step:

| # | Action | Owner |
| --- | --- | --- |
| 1 | Upgrade VCF Operations to 9.1 (required component; must be in place before the SDDC upgrade begins) | **Customer** |
| 2 | Upgrade SDDC Manager 5.2.x → 9.1 via the 5.2.x SDDC Manager UI | Dell RPS |
| 3 | Apply configuration updates in the 9.1 SDDC UI – Fleet LCM and VCF Management Services Platform; ensure unique FQDNs, static IPs, and forward / reverse DNS for all VCF components | **Customer** |
| 4 | In VCF Operations: configure the depot, download binaries, create the management-domain upgrade plan | **Customer** |
| 5 | Run update prechecks from VCF Operations / SDDC Manager | Dell RPS |
| 6 | In VCF Operations: upgrade NSX (Global Managers first where NSX Federation is used, then Local Manager), then vCenter | Dell RPS |
| 7 | In the vCenter VxRail plugin: upload the bundle, upgrade VxRail Manager and ESXi to 9.1 (VXM → VOM conversion) | Dell RPS |
| 8 | In VCF Operations: finalize the NSX upgrade (Edge and host components) | Dell RPS |
| 9 | Upgrade the vSphere Distributed Switch version | Dell RPS |
| 10 | Update the vSAN on-disk format version, if applicable | Dell RPS |

Then the same sequence for each workload domain.

Findings that trace to a **hardware fault, firmware limit, or Dell design
guidance** route to Dell for investigation – RPS does not own those items
directly. Track them the same as any other finding until Dell provides a
resolution or workaround.

### Credentials Dell needs before the window

SDDC Manager (vcf + root) · vCenter Server (administrator + root) · NSX-T
Manager (admin + root) · VxRail Manager (**mystic** + root) · ESXi node root ·
iDRAC root (or equivalent) · VMware Customer Connect account · Dell Support
account.

---

## Where this plugs into the general flow

| General ([Full VCF upgrade sequence](13-vcf-upgrade-sequence.md)) | On VxRail |
| --- | --- |
| Phase 7 – ESX / host-cluster upgrade | **Replaced** by the VxRail plugin bundle (ESXi + Dell Add-on drivers + Dell firmware + VXM → VOM). Do not use the generic per-host path or the online VxRail Manager UI. |
| Phase 5 / 6 – NSX Local Manager, vCenter | Driven from the SDDC Manager 9.1 UI / VCF Operations Fleet Management by Dell RPS, not the generic path. |
| Prerequisites – vLCM images | Hard requirement on VxRail: all baseline-managed clusters converted to vLCM images first. Full walkthrough: [VUM to vLCM images migration](15-vum-to-vlcm-migration.md#vcf-track-powershell-script-vcfbaselineclustertransitionps1) |
| Conditional – NSX Global Manager | Applies whenever the Dell checklist shows NSX Federation = Yes. |

The Aria → VCF fleet migration, the VIDM → Identity Broker transition, and the
Disaster Recovery convergence are **not** VxRail-specific – follow the
[Full VCF upgrade sequence](13-vcf-upgrade-sequence.md).

---

## References

- Dell KB **000478885** – "VxRail: How to perform an upgrade to VCF 9.1"
- Dell KB **000021470** – "VCF on VxRail: General Upgrade Information"
- Dell – "RPS General Procedure: VCF on VxRail Upgrade – Customer Preparation
  Guide"
- Broadcom KB **306446** – "Supported versions of VMware Cloud Foundation on
  VxRail"
