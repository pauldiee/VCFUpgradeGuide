# Disaster Recovery: SRM / vSphere Replication → VCF Protection and Recovery

A companion to the [Overview](01-overview.md). If Site Recovery Manager (SRM)
/ vSphere Replication is present, plan this as its own workstream **before**
the core upgrade – the current DR release is not supported on the upgraded
vCenter, so any order that upgrades vCenter first leaves the environment
unprotected.

For a two-site (protected + recovery) estate, both sites' DR components move
**in step** – do not upgrade one site's vCenter while the other site is still
on the old DR release.

---

## Target: VCF Protection and Recovery

From 9.1.0.0 the recovery manager, vSphere Replication, and vSAN replication
ship as a **single combined appliance**. SRM is renamed **VMware Live Site
Recovery (VLSR)**.

## Convergence

"Convergence" is the Broadcom path for VLSR **9.0.2.3 and earlier** onto the
combined appliance. The Converge workflow requires the source to be at
**9.0.2.2 or later** (Broadcom KB 408127) – a site on an earlier 9.0.2.x
needs an interim patch first. Versions 9.0.3 and later use a normal in-place
update instead.

## Bridge version – why DR goes first

Protection and Recovery 9.1.0.02xx is supported on vCenter and ESX at **8.0
U3, 9.0, and 9.1** (not 8.0 U2 or earlier). It runs on the pre-upgrade
vCenter *and* the upgraded vCenter, so converging DR to it before the core
upgrade keeps protection continuous. Confirm the exact supported set in the
interoperability matrix for your build – **VCF 9.1.1 (GA 2026-09-03) ships
its own Protection and Recovery build** with its own qualified vCenter / ESX
set.

## Enhanced vSphere Replication is a prerequisite

For VCF 9 it is the only supported site-to-site configuration; the appliance
will not install against a site still on legacy replication (unsupported past
vSphere Replication 9.0.2.2). Per site, ahead of the convergence:

1. Permit outbound **TCP 32032** on every ESX host carrying replicated
   datastore traffic.
2. Define **Enhanced Replication Mappings** in the Site Recovery interface,
   per protected site pair.
3. Convert every legacy VM replication to Enhanced settings – **per VM**, via
   the Site Recovery UI or the REST API (Broadcom ships a Python sample for
   large estates).

## Convergence procedure

Per site; run on the protected site first, then the recovery site.

1. **Pre-work.** Full backup of the Protection and Recovery database;
   configuration export via the Import/Export tools; record Site Pair advanced
   settings; all recovery plans **Ready**, all protection groups and VMs
   **OK**; custom certificates on SHA1 / SHA256 thumbprints (no MD5); have
   vCenter SSO admin credentials for both sites.
2. **Deploy** the Protection and Recovery 9.1 appliance on **both** vCenter
   sites; enable SSH on all legacy appliances; ensure the new appliance can
   reach them.
3. In the **Protection and Recovery Appliance Management Interface** →
   **Converge Legacy Appliances** → enter the vCenter and legacy-appliance
   credentials → select the services → run the configuration wizard.
4. **Repeat** on the recovery site.
5. **After.** The legacy appliances power off and their IPs / FQDNs move to
   the single appliance; clean up firewall rules and DNS; reinstall storage
   replication adapters (SRA) and re-register any VASA provider; re-verify the
   site pairing.

## What convergence preserves

Advanced settings, datastore groups, protection groups, inventory mappings,
recovery plans, per-VM IP customizations, custom roles and permissions, custom
alarms, test-plan history, and certificates – **for objects in a valid state
only**.

## Post-core check

After the core upgrade, re-test a recovery plan against the converged
Protection and Recovery appliance (see [Overview](01-overview.md) → Post-upgrade
validation).

---

## Open items to confirm

- The **exact supported vCenter / ESX set** for the target Protection and
  Recovery build, from the interoperability matrix.
- Whether the running DR pair is at or above the **9.0.2.2** Converge floor
  (map builds via KB 313905); if not, plan the interim patch.
- The **DR monitoring integration** inside VCF Operations (VLSR dashboards /
  alerts) is only supported once VCF Operations is on 9.x – expect a gap
  between the DR convergence and the VCF Operations upgrade. DR protection
  itself is unaffected.

---

## Sources

| Reference | Covers |
| --- | --- |
| [Convergence and Upgrade (VCF Protection and Recovery 9.1 installation guide)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/protection-and-recovery/9-1/protection-and-recovery-installation/setting-up-vmware-live-site-recovery-overview/convergence-and-upgrade.html) | The combined appliance; convergence for VLSR 9.0.2.3 and earlier; prerequisites, order, per-site Converge procedure, what is preserved |
| Broadcom KB 408127 | Converge workflow source-version requirement (VLSR / vSphere Replication 9.0.2.2 or later) |
| Broadcom KB 313905 | Build numbers and versions of VMware Live Site Recovery / SRM |
| [Broadcom Product Interoperability Matrix](https://interopmatrix.broadcom.com/) | Protection and Recovery vs. vCenter / ESX / VCF Operations |
