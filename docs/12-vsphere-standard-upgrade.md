# Standalone vSphere upgrade (no VCF or VVF entitlement)

This is the **plain vSphere** track: no VCF, no VMware vSphere Foundation
(VVF) entitlement, just vCenter and ESXi under a standard vSphere license.
It exists as its own entry point because a reader in this situation should
not have to wade through the [Overview](01-overview.md)'s full VCF-fleet
phase list to find the two or three steps that actually apply to them.

---

## The procedure is the same one documented for standalone VVF

There is **no separate Broadcom-documented upgrade procedure for plain
vSphere** distinct from the standalone-VVF path. Broadcom's own scenario
for this exact situation – ["Upgrading vSphere 8 and Optionally vSAN and
Aria Operations 8 to
9.1"](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1/upgrade-to-91-from-vsphere-8-and-aria-8-environments(1).html)
– is scoped explicitly to *"plain vSphere, optionally vSAN and Aria
Operations"*, with no SDDC Manager, NSX, or other Aria components in the
picture, and it is the same 6-step sequence already written up in the
Overview doc's ["VVF: confirm whether VCF Management Services is even in
scope"](01-overview.md#vvf-confirm-whether-vcf-management-services-is-even-in-scope)
section.

That includes the one piece of licensing infrastructure this track cannot
skip either way: Broadcom states plainly that *"VCF Operations and the
license server components are required to license all 9.1.x
environments"* – there is no documented path that upgrades to 9.1.x
without a License Server, VCF/VVF entitlement or not.

**Follow the [standalone-VVF manual upgrade
steps](01-overview.md#vvf-confirm-whether-vcf-management-services-is-even-in-scope)**
– the 6 phases (Aria/VCF Operations, License Server, vCenter, ESX hosts,
vSAN on-disk format, vSAN File Service) apply to this track verbatim.

---

## Where to go next

- **vCenter upgrade** – full manual GUI/CLI walkthrough, including the
  vCenter-specific back-in-time compatibility check:
  [vCenter manual GUI upgrade](07-vcenter-manual-upgrade.md).
- **Disaster recovery** – if SRM or vSphere Replication is in use, converge
  to VCF Protection and Recovery *before* the upgrade:
  [Disaster Recovery](02-disaster-recovery.md) (already scoped to VCF,
  VVF, or pre-9 vSphere).
- **Identity** – if vCenter is still on Integrated Windows Authentication,
  migrate to AD-over-LDAPS first:
  [IWA to LDAPS migration](06-iwa-ldaps-migration.md) (vCenter-level,
  applies regardless of VCF/VVF entitlement).
- **Post-upgrade validation** – the general
  [Post-upgrade validation](01-overview.md#post-upgrade-validation)
  checklist applies here too, minus anything SDDC-Manager- or
  NSX-specific.

Landing on plain vSphere 9.1 is a **stable end state**, not a step toward
something else – nothing here requires ever adding VVF or VCF Management
Services, though either remains a Day-N option if requirements grow into
them.

Broadcom reference: [Upgrading vSphere 8 and Optionally vSAN and Aria
Operations 8 to
9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1/upgrade-to-91-from-vsphere-8-and-aria-8-environments(1).html).
