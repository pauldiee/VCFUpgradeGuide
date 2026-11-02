# Aria Automation to VCF Automation 9.1.1 upgrade (with an external Orchestrator)

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
expanding on its [Phase 4 – VCF Automation
upgrade](13-vcf-upgrade-sequence.md#phase-4--vcf-automation-upgrade-if-vcf-automation--aria-automation-is-present).

Applies whenever an **Aria Automation 8.18.x** instance exists – typically
multi-tenant, often with an **external Aria Orchestrator** appliance
integrated into one or more tenants. **VCF only:** in Broadcom's 9.1
[upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html)
the upgrade of Aria Automation to VCF Automation 9.1 is step 9 and the
Orchestrator follows as step 10. The
[vSphere Foundation 9.1 upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1.html)
has no Automation step. It does list *Aria Operations Orchestrator* as its
own step 2, so the [Orchestrator section](#the-external-orchestrator)
below also applies to a standalone Orchestrator on VVF.

> **Evidence level.** Built from Broadcom TechDocs, the 9.1.1.0 VCF
> Automation release notes and KB articles, all read on **2026-10-30**. The
> steps have **not been run on a build in this repo**. Where Broadcom does
> not say, this page says so under [Open items](#open-items-to-confirm)
> instead of guessing.

---

## How the upgrade works

The upgrade is **blue-green**. VCF Operations provisions a new VCF
Automation instance on a dedicated VCF services runtime while the old
instance stays active. When the upgrade completes, the source Automation
nodes shut down automatically.

The path from 8.18.x has two stages, both in VCF Operations:

1. **Import** the Aria Automation 8.x instance (from the legacy Aria Suite
   Lifecycle) into VCF Operations Fleet Management. *"Legacy instances
   managed by VMware Aria Suite Lifecycle cannot be upgraded directly."*
   ([KB 433806](https://knowledge.broadcom.com/external/article/433806))
2. **Upgrade** it from **Build → Lifecycle → VCF Management → Upgrade**.

The Orchestrator is **not** part of that upgrade. An external Orchestrator
is upgraded separately, after Automation – see
[The external Orchestrator](#the-external-orchestrator).

Broadcom's
[sequence rule](https://knowledge.broadcom.com/external/article/440630)
for 9.1 is that VCF Operations is upgraded first, then the in-place Aria
Automation upgrade follows. Aria Suite Lifecycle and VMware Identity
Manager are decommissioned afterwards, as a Day 2 task.

---

## Prerequisites

Everything below comes from the TechDocs page
[Perform the Upgrade to VCF Automation 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9/upgrade-to-vcf-automation.html)
unless another source is given.

### Source and sequence

- Aria Automation is **8.18.1 or later** and has been imported and
  integrated into VCF Operations.
- Aria Operations is at least **8.18.6** for a 9.1.1.x target (Broadcom's
  *Upgrade VCF Operations to 9.1* page). A practitioner write-up also names
  Aria Suite Lifecycle **8.18 Patch 6** for the import; that figure is
  **not confirmed** in TechDocs here. Confirm both against your own path in
  the [Interoperability Matrix](https://interopmatrix.broadcom.com).
- A single-node **extra-large** 8.18.x instance must first be scaled to a
  3-node cluster.
- Cloud accounts used by the Automation integration are healthy in VCF
  Operations.
- Data Services Manager has its own upgrade guidance. Read it first.

### Blockers

[KB 389563](https://knowledge.broadcom.com/external/article?articleNumber=389563)
(written for 9.0, so verify for 9.1.1):

- **NSX-V, NSX-T Manager Mode**, or a VCF cloud account with an underlying
  NSX-T Manager Mode cloud account: *"you must not upgrade to VCFA 9 until a
  migration plan is in place."*
- **Avi Load Balancer cloud accounts** are not supported in VCF Automation
  9.0, so such an environment *"must be prevented from upgrading."*
- The article also lists features that change or are missing in 9.x:
  Virtual Private Zones and provider image management, adding VMware Cloud
  Director as a cloud account, the Cloud Consumption Interface, and the
  Kubernetes (TKG and TMC) integrations.

### Binaries and depot

- A configured software depot.
- For 8.18.x to 9.1.x: the 9.1.x **install binary for VCF Automation**, plus
  the 9.1.x install binary for the **Migration Service Engine**.
- Use the latest available binaries. The 9.1.1 release notes hold the
  dependencies.
- **Order:** upgrade VCF Automation to 9.1.1 **before** patching the
  Migration Service Engine to 9.1.1, otherwise the patch hangs at
  `vmsp_upgrade`
  ([KB 455559](https://knowledge.broadcom.com/external/article/455559)).

### Network and DNS

| Item | Requirement |
| --- | --- |
| IP addresses (9.1.0.400 and later) | **5 unique IPs** on the same network as the current Automation nodes, contiguous or not. Three go to the 9.1 nodes, two are buffer. Covers 9.1.1 ("9.1.0.400 and later"); no /29 needed |
| IP addresses (9.1.0.0 to 9.1.0.300) | A dedicated **CIDR with 8 addresses** (a /29) on the same network |
| New FQDN | One for the **VCF services runtime**, no capital letters, resolving to an IP **outside** the dedicated pool, so a sixth address. Same network not stated, but the obvious choice. Internal only |
| Automation UI FQDN | Reused; moves to the 9.1 instance automatically |
| External load balancer | No configuration change |
| Internal CIDR | Default `198.18.0.0/15`; use `240.0.0.0/15` or `250.0.0.0/15` if it overlaps |
| DNS | Stable on the 8.18.x side during the upgrade. A known failure otherwise: [KB 441333](https://knowledge.broadcom.com/external/article/441333) |

From Aria Automation 8.18.x the existing node IPs become the VIPs of the 9.1
instance. You cannot reuse the services runtime CIDR and FQDN for VCF
management services.

### Certificates, FIPS and trust

- The Automation certificate is **reused**. Its SAN must contain the FQDNs
  and IPs of all Automation nodes.
- VCF Automation 9.x enforces **FIPS 140-2** on external integration
  endpoints. The precheck can block IPAM endpoints with *skip certificate
  check* on, Aria Operations endpoints, and plain LDAP.
- The **truststore is not migrated**, so some endpoints fail TLS after the
  upgrade. Read [KB 425489](https://knowledge.broadcom.com/external/article/425489)
  first; follow-up in [KB 447667](https://knowledge.broadcom.com/external/article/447667).
- **Leaf certificate only.** If the web certificate carries extra
  certificates in its chain, the import can silently fail and deploy an
  empty, greenfield VCF Automation instance while the UI shows *completed*
  ([KB 441811](https://knowledge.broadcom.com/external/article/441811/upgrade-to-vcf-automation-9x-from-aria-a.html)).

### Accounts

The wizard asks for one password, set on both `vmware-system-user` and the
admin account. At least 15 characters with an uppercase letter, a lowercase
letter, a digit and one of `@ ! # $ % ? ^`; no dictionary word and no part
of the user name.

---

## Run the upgrade

1. In VCF Operations go to **Build → Lifecycle → VCF Management → Upgrade**.
2. Next to the VCF Automation instance click **Configure**.
3. On *Parameters*, enter the CIDR (9.1.0.0 to 9.1.0.300) or IP pool
   (9.1.0.400 and later), the runtime FQDN and the password. Finish the
   summary.
4. Click **Run Prechecks**, open *Precheck details*, fix every failure and
   run again.
5. Click **Upgrade** and follow it under *Tasks*.
6. After success the old nodes shut down. Delete them only when you no
   longer need a way back.

**If it fails:** Broadcom's documented retry is to delete the failed
instance in VCF Operations, import the 8.x instance again and trigger the
upgrade again
([KB 402057](https://knowledge.broadcom.com/external/article/402057/how-to-retrigger-a-failed-vcf-automation.html)).

---

## Tenants and organizations

- **Existing organizations are mapped automatically to VM Apps
  organizations.** They are not converted to All Apps.
  ([Integrate VCF Operations orchestrator with VCF Automation for VM Apps](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-of-components-to-complete-your-vcf-platform/download-and-deploy-the-vco-va/integrate-vcf-operations-orchestrator-with-vcf-automation-for-vm-apps.html))
- This applies to all organizations, not only the default provider
  organization. The provider side needs its own **authentication
  migration** after the upgrade: Provider Management and the Organization
  Portal.
- **Do not delete VMware Identity Manager.** It remains an authentication
  source for VCF Automation 9.1. Aria Suite Lifecycle 8.x stops managing
  VCF Automation after the upgrade.
- For multi-tenant setups, organization hostnames carry the tenant
  identifier as a subdomain, and non-default tenants need DNS records.
- **Public cloud (AWS, Azure, GCP)** is deprecated and off by default in VM
  Apps organizations. From Aria Automation 8.18.x it can only be
  re-enabled **after** the upgrade
  ([KB 448993](https://knowledge.broadcom.com/external/article/448993)).

What Broadcom does **not** state: whether projects, user assignments and
resources (cloud accounts, zones, profiles, image mappings) are all carried
over per tenant, and there is no per-object list. Treat a per-tenant
comparison as the acceptance test: record projects and members, cloud
accounts, zones, profiles, image and flavor mappings, templates, catalog
items and subscriptions before the upgrade, and compare before the old
nodes are deleted. See [Open items](#open-items-to-confirm).

---

## The external Orchestrator

An external Orchestrator is a separate appliance, upgraded **after** the
Automation upgrade. Per Broadcom: *"Any external Automation Orchestrator
instances must be upgraded after first upgrading VMware Aria Automation
8.x"* to VCF Automation. Their integrations then appear in the matching VM
Apps organizations, and *"existing Automation Orchestrator integrations and
their content are preserved as-is."*

### Prerequisites

- Source is Aria Automation Orchestrator **8.18.1 or later**. Check the
  [Interoperability Matrix](https://interopmatrix.broadcom.com).
- **8.18.1 U3, U4 or U5:** the upgrade package may not recognize those
  patch versions. Broadcom's TechDocs point to KB 429226; the 9.0.x
  variant of the problem and its workaround are in
  [KB 428938](https://knowledge.broadcom.com/external/article/428938/vcf-operations-orchestrator-upgrade-from.html).
- A **VM snapshot** of every Orchestrator VM, **without memory**. Memory
  snapshots are not supported.
- If the Orchestrator authenticates against vSphere SSO, the credentials of
  the user that registered it (see `vracli vro authentication`).
- **Version match:** VCF Automation and VCF Operations Orchestrator must
  match to the subminor digit (both 9.1.1.x), because Provider Management
  needs the `vcfa_api` token scope.

### Upgrade

From the TechDocs page
[Upgrade to VCF Operations Orchestrator 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-a-standalone-or-clustered-vrealize-orchestrator-8-0-1-deployment-with-iso-image.html)
(ISO method):

1. Download the ISO. Connect the CD-ROM of the appliance VM with
   *Connect At Power On* and mount the ISO. In a cluster, do this on
   **all nodes**.
2. Log in as root and mount the drive (`blkid`, then
   `mount /dev/<device> /mnt/cdrom`).
3. On **one** node run
   `vracli upgrade exec -y --repo cdrom://` (from 8.18.1; from 9.0 or later
   it is `vracli upgrade exec -y --profile lcm --repo cdrom://`).
4. The appliance reboots. Follow progress with
   `vracli upgrade status --follow`; it can show a false failure.
5. Validate with `vracli version`, the vco-app pods Running
   (`kubectl get pods -n prelude -w | grep -E 'vco|orchestration-ui'`) and
   `curl -k https://<orchestrator-fqdn>/vco/api/healthstatus`.

### Connect it to the tenant

In the VM Apps organization (**Infrastructure → Integrations**) the
integration appears after the Automation upgrade. Check that:

- it points to the right host and shows healthy;
- **data collection** has run, so the workflows show up under
  *Orchestrator → Library → Workflows*;
- the **Orchestrator Workflow Designer** role is assigned to the right
  users.

For a **new** integration Broadcom documents setting the authentication
provider on the appliance, per organization, and redeploying the pods:

```bash
vracli vro authentication set -p tm -u <org-admin> -hn https://<vcfa-fqdn> --tenant <org>
/opt/scripts/deploy.sh
```

Whether this has to be repeated after an upgrade is **not documented**;
Broadcom only says integrations are preserved as-is. After the upgrade,
check with `vracli vro authentication`, and run the set command above per
VM Apps organization only if it does not point to VCF Automation for that
organization. **Untested.** See [Open items](#open-items-to-confirm).

### Known issues

| Issue | Where |
| --- | --- |
| Policies created in Orchestrator 8 may no longer start automatically; manual runs work. New or duplicated policies in 9.x work | [KB 446432](https://knowledge.broadcom.com/external/article/446432/automated-orchestrator-policies-fail-to.html) |
| Orchestrator logs fill the appliance disk after an upgrade from 8.18.x (no log deletion policy) | [KB 458715](https://knowledge.broadcom.com/external/article/458715) |
| `vco-app` pod does not start after 8.18.1 to 9.0.0 | [KB 407487](https://knowledge.broadcom.com/external/article/407487/vcoapp-pod-does-not-start-after-upgrade.html) |
| After upgrading a standalone Orchestrator no authentication provider is configured (fixed in 9.0.1) | [KB 407495](https://knowledge.broadcom.com/external/article/407495/after-upgrading-standalone.html) |
| Import of an Aria Automation 8.18.x with a **standalone** Orchestrator into VCF Operations can end in `LCMLEGACYMIGRATION15114` | [KB 404646](https://knowledge.broadcom.com/external/article/404646) |
| Custom Day-2 actions intermittently disappear in VM Apps organizations upgraded from 8.18.1 | [KB 454245](https://knowledge.broadcom.com/external/article/454245) |
| Classic-tenant Orchestrator endpoint records may be remapped wrongly, so the embedded integration is not shown as Embedded. **Not fixed** ("working on fix for upcoming release", checked 2026-11-02). The published SQL workaround also rewrites **external** endpoints, so it is not safe when an external Orchestrator is integrated | [KB 443720](https://knowledge.broadcom.com/external/article/443720) |

---

## Before moving on

- Portal reachable at its original FQDN, every tenant present as a VM
  Apps organization, and projects, users and cloud accounts compared with
  the situation before.
- Provider Management and Organization Portal authentication migrated.
- Orchestrator on the same 9.1.1.x build as Automation, integrations
  healthy and workflows collected.
- A deployment from an existing blueprint per tenant, and one catalog item
  or extensibility subscription that calls an external Orchestrator
  workflow.
- Your own workflows, packages, resource elements and configuration
  elements checked by hand. Check custom forms with drop-downs filled by
  Orchestrator actions with extra care.
- Aria Suite Lifecycle and VMware Identity Manager decommissioned **only
  now**, as a Day 2 task.

---

## Open items to confirm

Not answered by the Broadcom documentation read on **2026-10-30**. Put
these to Broadcom Support, or test on a copy first:

1. Are **projects, user assignments and resources** retained in full per
   tenant? Is there a list of what is not migrated?
2. After the upgrade, must the **authentication of an external
   Orchestrator be set again per tenant**, or is it carried over?
3. ~~Is **KB 443720** fixed?~~ Answered 2026-11-02: not fixed yet; do not
   apply the workaround in a tenant with an external Orchestrator.
4. Are there **known incompatibilities** for workflows, packages,
   configuration elements and custom plug-ins from Orchestrator 8.18 to
   9.1.1? Broadcom only states that content is preserved and that versions
   must match.

---

## Sources

- [Perform the Upgrade to VCF Automation 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9/upgrade-to-vcf-automation.html)
- [Upgrade to VCF Operations Orchestrator 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-a-standalone-or-clustered-vrealize-orchestrator-8-0-1-deployment-with-iso-image.html)
- [Integrate VCF Operations orchestrator with VCF Automation for VM Apps](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-of-components-to-complete-your-vcf-platform/download-and-deploy-the-vco-va/integrate-vcf-operations-orchestrator-with-vcf-automation-for-vm-apps.html)
- [VCF Automation 9.1.1.0 Release Notes](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/release-notes/vmware-cloud-foundation-9-1-1-0-release-notes/vcfautomation-9-1-1-0-release-notes.html)
- [Upgrading to VMware Cloud Foundation 9.1.x](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html) and the [vSphere Foundation 9.1 upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-your-vsphere-foundation-to-9-1.html)
- [KB 441811](https://knowledge.broadcom.com/external/article/441811/upgrade-to-vcf-automation-9x-from-aria-a.html) (certificate chain, greenfield deploy)
- [KB 440630](https://knowledge.broadcom.com/external/article/440630) (upgrade sequence for 9.1), [KB 433806](https://knowledge.broadcom.com/external/article/433806) (import and upgrade), [KB 389563](https://knowledge.broadcom.com/external/article?articleNumber=389563) (prechecks), [KB 443720](https://knowledge.broadcom.com/external/article/443720), [KB 455559](https://knowledge.broadcom.com/external/article/455559), [KB 402057](https://knowledge.broadcom.com/external/article/402057/how-to-retrigger-a-failed-vcf-automation.html)
