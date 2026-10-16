# Overview

General guidance for planning a **VMware Cloud Foundation (VCF) or vSphere
Foundation (VVF) upgrade** – applicable regardless of underlying hardware.
Hardware/HCI-specific extra steps (currently: **Dell VxRail**, see
[VxRail Addendum](vxrail-addendum.md)) are layered on top as their own
addendum, not baked into either track's flow, so the core guidance stays
reusable across engagements.

> **Status: draft.** Per-phase procedure detail, IP counts, and version
> numbers in the linked track docs are transcribed from the
> [VCF Upgrade Planner](https://vmware.github.io/vcf-upgrade-planner/) and
> the supplementary guides and **must be re-confirmed verbatim against
> Broadcom TechDocs** (and against your actual target build) before being
> treated as authoritative. Sources: [`reference/sources.md`](../reference/sources.md).

---

## Contents

- [Confirm which track applies](#confirm-which-track-applies)
- [Confirm a supported upgrade path](#confirm-a-supported-upgrade-path)
- [Pin a target build](#pin-a-target-build)
- [Where to go next](#where-to-go-next) –
  [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) ·
  [Standalone VVF upgrade](14-standalone-vvf-upgrade.md)
- [Customer data hygiene](#customer-data-hygiene)

---

## Confirm which track applies

This whole guide assumes one of two situations, and the phases differ
enough between them that they're written up as two separate docs rather
than one shared phase list:

- **Full VCF** – the fleet is driven through **VCF Management Services /
  Fleet Management** (SDDC Manager, VCF Operations Fleet Management, the
  License Server). That layer is **mandatory for full VCF**. →
  [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md).
- **Standalone VVF** – VMware vSphere Foundation with **no VCF Management
  Services layer**: compute, storage, networking and admin all run through
  native vSphere management interfaces, and the fleet is patched with
  **standard vSphere lifecycle mechanisms** (vLCM against vCenter/ESXi
  directly) instead of SDDC-Manager-driven phases (verified against
  Broadcom TechDocs, ["Deploying VMware vSphere Foundation 9.1 Without VCF
  Management
  Services"](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/deploy-vmware-vsphere-foundation-using-the-deployment-wizard/deploying-vmware-vsphere-foundation-9-1-without-vcf-management-services.html),
  2026-09-08). VVF *can* be fleet-managed too (deployed/upgraded through
  the VCF Installer) – in that case the full-VCF track applies unmodified.
  →  [Standalone VVF upgrade](14-standalone-vvf-upgrade.md).

Confirm which applies **before** running the planner or committing to a
phase count – it changes whether SDDC Manager and VCF Management Services
exist at all for that engagement. The site's `/vcf/` and `/vvf/` landing
pages route to the docs relevant to each.

---

## Confirm a supported upgrade path

The **[VCF Upgrade Planner](https://vmware.github.io/vcf-upgrade-planner/)** is
the first stop regardless of track. Feed it your current deployment
(vSphere vs VCF), installed components and their **exact** versions, your
goal, and a target build; it returns a phase-by-phase plan, the
networking/resource requirements, and an add-on compatibility pre-check.
Updated for **9.1.1**, it also marks **safe stopping points** (where the
upgrade can pause between change windows) and exports the plan for change
management tools such as Jira or ServiceNow ([VCF blog, 2026-10-13](https://blogs.vmware.com/cloud-foundation/2026/10/13/customer-favorite-capabilities-accelerating-your-path-to-vcf-9-1-1/)).

**Aim for 9.1.1, not 9.0 – the support dates.** vSphere 8.0 and the VCF 5.x
stack reach **End of General Support on 2027-10-11**. VCF 9.0's ends **earlier,
on 2027-09-17**, so stepping to 9.0 buys no time; 9.1.1 extends general
support to **August 2028** ([VCF blog, 2026-10-13](https://blogs.vmware.com/cloud-foundation/2026/10/13/customer-favorite-capabilities-accelerating-your-path-to-vcf-9-1-1/); support model:
[VCF 9 support model and release cadence](https://blogs.vmware.com/cloud-foundation/2025/07/16/vmware-cloud-foundation-9-ushers-in-new-support-model-and-release-cadence/)).

Supported **source** versions for a 9.1 upgrade (confirm on the release
notes – [Upgrade Sequence to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-0-0-release-notes/upgrade-sequence-to-91.html)):

- **VCF 5.2.x / vSphere Foundation 5.2.x** – Broadcom calls this the
  **skip-level** path.
- **VCF 9.0.x / vSphere Foundation 9.0.x** – the **fleet-lifecycle
  transition** path.
- vSphere 8 + Aria Operations 8

> **The source patch level matters – per component, not just SDDC Manager.**
> Broadcom qualifies the 9.1 upgrade **from a specific source version** for
> each product, and a patch **released after a target build** often has no
> path to it – it would upgrade *backwards* ("back in time"), which is
> unsupported. **9.1.1 reopens most of these paths**: its BOM is newer than
> the recent 8.x / 5.2.x / 9.0.2 security patches (KB 448135; Broadcom's
> [VCF blog of 2026-10-13](https://blogs.vmware.com/cloud-foundation/2026/10/13/customer-favorite-capabilities-accelerating-your-path-to-vcf-9-1-1/) names vSphere 8.0U3j and 8.0U3k, VCF 9.0.2
> EP2 and VCF 5.2.4). Upgrade Path tool, "Hide Patch Releases" unticked,
> **checked 2026-10-16**:
>
> | Source | Reaches 9.1.0.x | Reaches 9.1.1.x |
> | --- | --- | --- |
> | vCenter / ESX 8.0 U3j, U3k | no | **yes – only target** |
> | vCenter / ESX 8.0 U3i and earlier U3 | yes | yes |
> | vCenter 9.0.2.0100 | 9.1.0.0300 only | yes |
> | ESX 9.0.2.0100 | 9.1.0.0200 only | yes |
> | SDDC Manager 5.2.4.0 | no | **yes – only target** |
> | SDDC Manager 5.2.3.0, 5.2.2 | yes | yes |
> | SDDC Manager 9.0.2.0100 | no | yes |
> | NSX 4.2.4, 4.2.4.1 | no | **yes – only target** |
> | VCF Operations 8.18.7 | no | **yes – only target** |
> | VCF Operations 8.18.6 | yes | yes |
> | VCF Operations 8.18.5 | yes | **no** – 9.1.0.x (or 9.0.2) first |
> | VCF Operations 9.0.2.0200 | 9.1.0.0300 / 0400 only | yes |
> | Operations for Networks 6.14.3 | no | **yes – only target** |
> | Operations for Networks 6.14.1, 6.14.2 | yes | yes |
>
> Two things changed since the earlier checks (2026-09-04 / 09-15): SDDC
> Manager 5.2.3.0 and Operations for Networks 6.14.1 now reach every 9.1.0.x
> build, and Operations for Networks 6.14.3 now has a 9.1.1 path. The blog
> calls one source "VCF 9.0.2 EP2"; the matrix lists only 9.0.2.0100 (late
> July 2026) for vCenter, ESX and SDDC Manager, so match on the **build
> number**, not the EP name. **vCenter** detail and the standalone procedure:
> [vCenter manual GUI upgrade](07-vcenter-manual-upgrade.md).
> **Applying "the latest patch" as preparation can strip the qualified path**,
> and the next out-of-band security patch can close a path that is open today
> – re-check the matrix right before the change window.

Check each component in the **[Broadcom Product Interoperability
Matrix](https://interopmatrix.broadcom.com/)** before committing to a date:

- **Upgrade Path** tool – source version → target build, per product. Untick
  "Hide Patch Releases" to see the patch-level rows.
- **Interoperability** tool – "does product A version X work with product B
  version Y" (for example Protection and Recovery vs. the running vCenter /
  ESX / VCF Operations).

The matrix moves. Re-run every check when a new point release ships (see
[Pin a target build](#pin-a-target-build)).

---

## Pin a target build

VCF 9.1 shipped as patch builds **9.1.0.0, 9.1.0.0100, 9.1.0.0200,
9.1.0.0300, 9.1.0.0400**; **VCF 9.1.1 went GA on 2026-09-03**, adding newly
supported source patch levels and its own target build. If an engagement
calls for "9.1.1":

- **Re-verify everything against the matrix** for the 9.1.1 target. A point
  release re-qualifies **both** the supported *source* versions and the
  *target* builds – it is not "a smaller step" on top of a 9.1.0 plan. Target
  builds, per-component upgrade paths, and the effective versions all
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

---

## Where to go next

- **[Full VCF upgrade sequence](13-vcf-upgrade-sequence.md)** – the 9-phase
  spine, prerequisites, conditional phases, post-upgrade validation, and
  cleanup for a fleet driven through VCF Management Services.
- **[Standalone VVF upgrade](14-standalone-vvf-upgrade.md)** – the 6-step
  manual procedure for VVF with no VCF Management Services layer.
- **[Field notes](04-field-notes.md)** – known issues and gotchas from real
  upgrades, keep it open alongside whichever track applies.
- **[VxRail Addendum](vxrail-addendum.md)** – Dell VxRail-specific extra
  steps on top of the full-VCF sequence.

---

## Customer data hygiene

This repo is **public**. Never commit real customer names, IPs, hostnames,
or credentials – use generic placeholders. Per-engagement working files
(filled checklists, real upgrade logs) belong outside the repo entirely,
in separate per-engagement storage.

**Customer data is never used with Claude on this repo, period, no
exceptions.** No real customer names, IPs, hostnames, credentials, or
other identifying details are ever entered into a Claude session while
working on this repo – not in chat text, not in a screenshot.
