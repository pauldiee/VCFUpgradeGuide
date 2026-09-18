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

Supported **source** versions for a 9.1 upgrade (confirm on the release
notes – [Upgrade Sequence to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-0-0-release-notes/upgrade-sequence-to-91.html)):

- **VCF 5.2.x / vSphere Foundation 5.2.x** – Broadcom calls this the
  **skip-level** path.
- **VCF 9.0.x / vSphere Foundation 9.0.x** – the **fleet-lifecycle
  transition** path.
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
> 9.1.0.0200, and 6.14.3 has no 9.x path. **vCenter itself hits the identical
> pattern**: 8.0 U3j and later has no path to any 9.1.0.x or 9.0.x build, and
> the only 9.x target is 9.1.1.0 (KB 448135, Upgrade Path tool, checked
> 2026-09-15) – see [vCenter manual GUI upgrade](07-vcenter-manual-upgrade.md)
> for the full detail and the standalone-path procedure.
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
