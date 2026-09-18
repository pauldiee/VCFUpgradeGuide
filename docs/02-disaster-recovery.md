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

## Licensing

VMware Live Site Recovery (VLSR) / vSphere Replication / vSAN Data Protection
is licensed separately from core VCF/VVF:

- **Advanced Cyber Compliance (ACC)** – a paid **VCF Advanced Service** that
  covers the full VLSR + vSphere Replication + vSAN Data Protection bundle
  for VCF environments.
- **Standalone Site Recovery Manager license** – for customers who want DR
  without the cyber-recovery add-on capabilities; available for VCF, VVF, or
  pre-9 vSphere.

Ask **who is driving the DR spend** before assuming ACC is in scope – it is a
commercial decision, not a technical default.

**Capacity is per protected VM, on both sites.** The same license number is
required on both ends of the pair: one-way protection of 100 VMs needs a
100-VM license installed on **both** vCenter A and vCenter B; bidirectional
protection of 100 VMs each way needs a **200-VM** license on both sides.

**Where it's applied.** Not entered into the Protection and Recovery
appliance directly – it rides the same mechanism as the rest of VCF 9.1
licensing. Register VCF Operations and a **License Server** with the VCF
Business Services Console, then add the ACC (or standalone SRM) subscription
capacity to that License Server and assign it from there. This is the same
License Server deployed in the full-VCF sequence's
[Phase 3](13-vcf-upgrade-sequence.md#phase-3--deploy-vcf-management-services--license-server) –
DR licensing is not a separate appliance.

**Legacy license conversion is automatic.** An existing perpetual / legacy
SRM license key converts on activation – no manual re-entry: *"When you
activate VMware Live Site Recovery your existing Site Recovery Manager
license is converted to VMware Live Site Recovery license. You are no longer
required to provide Site Recovery Manager license key."* A customer already
on a **legacy SRM subscription can keep running it until the term ends** and
only needs to purchase ACC (or the standalone SRM SKU) at renewal, or sooner
if they want the newer cyber-recovery capabilities before then.

## Post-core check

After the core upgrade, re-test a recovery plan against the converged
Protection and Recovery appliance (see [Full VCF upgrade sequence →
Post-upgrade validation](13-vcf-upgrade-sequence.md#post-upgrade-validation)).

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
- **When in the convergence procedure the ACC / SRM license must be
  assigned** (before deploying the 9.1 appliance vs. after) – no
  authoritative source found yet; confirm against the account's actual SPD /
  entitlement before this goes into a customer runbook. See [Licensing](#licensing).

---

## Sources

| Reference | Covers |
| --- | --- |
| [Convergence and Upgrade (VCF Protection and Recovery 9.1 installation guide)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/protection-and-recovery/9-1/protection-and-recovery-installation/setting-up-vmware-live-site-recovery-overview/convergence-and-upgrade.html) | The combined appliance; convergence for VLSR 9.0.2.3 and earlier; prerequisites, order, per-site Converge procedure, what is preserved |
| Broadcom KB 408127 | Converge workflow source-version requirement (VLSR / vSphere Replication 9.0.2.2 or later) |
| Broadcom KB 313905 | Build numbers and versions of VMware Live Site Recovery / SRM |
| [Broadcom Product Interoperability Matrix](https://interopmatrix.broadcom.com/) | Protection and Recovery vs. vCenter / ESX / VCF Operations |
| [VMware Live Site Recovery Licensing (TechDocs)](https://techdocs.broadcom.com/us/en/vmware-cis/live-recovery/live-site-recovery/9-0-4/about-vmware-live-site-recovery-installation-and-configuration/overview/srm-licensing.html) | Advanced Cyber Compliance vs. standalone SRM license; per-VM capacity counting; legacy SRM key auto-conversion |
| [Add a License to VCF Operations and License Server](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/add-a-license-to-vcf-operations.html) / [License Server Overview](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/license-server-overview.html) | How ACC / SRM subscription capacity is registered and assigned via the VCF License Server |
| [Purchasing a Subscription for VMware Live Recovery (Broadcom KB 428834)](https://knowledge.broadcom.com/external/article/428834/purchasing-a-subscription-for-vmware-liv.html) | ACC as a VCF advanced service; standalone SRM option for VVF / pre-9 vSphere |
