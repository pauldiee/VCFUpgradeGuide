# Identity: VIDM / Workspace ONE Access → VCF Identity Broker

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md).
VCF 9 replaces **VMware
Identity Manager (VIDM)** / Workspace ONE Access with **VCF Identity Broker
(VIDB)** as the fleet identity layer. This is a distinct workstream, not a
step in the core upgrade sequence – run it **after** the core upgrade, in
parallel with the Aria → VCF component migration.

Applies whenever VIDM / Workspace ONE Access is present (typically because the
Aria / operations stack authenticates through it).

---

## 9.0.x source: Identity Broker network transition (before Phase 1)

A **different, unrelated prerequisite** for fleets already on VCF 9.0.x
(where Identity Broker already exists, rather than being freshly deployed
from VIDM): if that existing **Identity Broker 9.0.x sits on an NSX
overlay** network, the VCF Operations upgrade ([Phase 1](13-vcf-upgrade-sequence.md#phase-1--vcf-operations-upgrade))
**fails outright** unless it is first moved to the VCF management network.

- **Condition.** Only applies if Identity Broker is on an NSX overlay. If it
  is already on the VCF management network, skip this.
- **Procedure.** Deploy a new Identity Broker on the management network,
  reusing the **existing certificate and FQDN**; re-point DNS to it.
- **Impact.** Service-disruptive – plan its own maintenance window, separate
  from the main upgrade window, and do it **before** Phase 1 starts.

> **Status: documented (read 2026-11-02).** The script-based migration from
> the 9.1.0.0 release notes is documented in
> [Migrating VMware Identity Manager to Identity Broker](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/managing-identity-and-access-using-vcf-single-sign-on/migrating-vmware-identity-manager-to-vcf-identity-broker.html). See
> [Scripted migration](#scripted-migration) below. The **Access Control group
> import** remains an alternative for groups only.

---

## The short version

- **No in-place upgrade for VIDM.** Identity Broker 9.1 is deployed fresh as
  part of **VCF Management Services**, "only in the first VCF instance" of the
  fleet, as the HA **instance** type. It can be added to other instances
  later. An embedded Identity Broker only comes into play with a 9.0.x
  source ([Full VCF upgrade sequence,
  Phase 3](13-vcf-upgrade-sequence.md#phase-3--deploy-vcf-management-services--license-server)).
  VIDM is not consumed by VCF 9.
- **Parallel run.** Identity Broker is an *additional* authentication source
  alongside VIDM and each component's native auth. Keep VIDM running until
  every component that uses it has been re-pointed.
- **Users and groups can be brought across.** The upstream identity source
  (AD / LDAP / SAML IdP) itself is unchanged – only the broker layer moves.
- **Everything else is rebuilt by hand.**

---

## Scripted migration

Broadcom's scripts export users and groups from VIDM, import them into
Identity Broker, and switch the identity source of VCF Operations, the VCF
Automation provider and the NSX **Local** Managers
([Migrating VMware Identity Manager to Identity Broker](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/managing-identity-and-access-using-vcf-single-sign-on/migrating-vmware-identity-manager-to-vcf-identity-broker.html)).

- **Source:** VIDM 3.3.7 GA, or 3.3.7 with the latest patch.
- **Target:** Identity Broker 9.1, **instance** deployment type, with the
  AD / LDAP directory already configured on it.
- **One VIDM tenant per export.** Several tenants means several runs.
- **Not migrated:** identity provider configurations ("must be configured
  manually in identity broker"), OAuth clients, sync settings (compared and
  shown only).
- **Not supported in Identity Broker:** VIDM local accounts, MFA with AD.
- **NSX Global Manager:** "Migration is not supported for Global Manager
  NSX." Configure it by hand.
- **VCF Automation:** VM Apps organizations keep their VIDM OIDC connection
  after the upgrade. Provider Management and the Organization Portal move
  with a separate procedure
  ([Migrate VCF Automation Authentication from VMware Identity Manager to VCF Identity Broker](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9/migrate-vcf-automation-single-sign-on-configuration-from-vmware-identity-manager-to-vcf-identity-broker.html);
  [Configure Authentication for the VCF Automation Organization Portal](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9/migrate-vcf-automation-single-sign-on-configuration-from-vmware-identity-manager-to-vcf-identity-broker/configure-authentication-for-the-vcf-automation-organization-portal.html)).
  See [docs/26](26-aria-automation-to-vcf-automation-upgrade.md).

Order that follows from the prerequisites: directory on Identity Broker
first, then the script per tenant, then the VCF Automation procedure, NSX
Global Managers by hand, OAuth clients regenerated, VIDM retired last.
Not run on a build in this repo.

---

## What does NOT carry – rebuild on Identity Broker

- The directory / identity-provider connection (AD / LDAP / OIDC).
- Federation / SAML to the upstream IdP.
- End-user authentication policies and MFA configuration.
- Custom branding.
- Workspace ONE Access-specific flows (for example Aria Automation CCI).
- Role and scope assignments – re-mapped after the user/group import.

---

## Prerequisites

- Identity Broker 9.1 deployed (comes with VCF Management Services).
- The upstream identity source (AD / LDAP / SAML IdP) reachable.
- VIDM still running – it is the import source.
- The account doing the work has **'All Objects' scope** in VCF Operations
  (Administration → Control Panel → Access Control → User Accounts / User
  Groups).
- Only for a **9.0.x source**: if the fleet has an **embedded** Identity
  Broker and an HA cluster is wanted, that is a *separate* migration. An
  upgrade from 5.2 deploys the instance type directly – see
  [Do not confuse](#do-not-confuse-embedded--instance).

---

## Procedure

### 1. Configure Identity Broker against the upstream IdP

Re-create the directory / IdP connection on Identity Broker pointing at the
same AD / LDAP / SAML IdP that VIDM fronts today. Push the configuration to
**vCenter and NSX first** and test SSO login there before touching the Aria /
VCF Automation tier.

### 2. Import the VIDM user groups

VCF Operations → **Administration → Control Panel → Access Control → User
Groups** tab → the ellipsis next to **ADD** → **Import** → source = **VMware
Identity Manager**.

| Field | Value |
| --- | --- |
| Import From | the configured VIDM source |
| Domain Name | the domain to import from |
| Search Prefix | a search string, then **Search** |

Select the groups (or the header check box for all) → **Next** → **Finish**.
Groups already imported do not appear in the list. **After import, edit each
group and assign a role and a scope** – imported groups have neither.

Supported import sources on the same dialog: VMware Identity Manager, VMware
Single Sign-On, Active Directory, LDAP.

### 3. Re-point the components

For each component still authenticating through VIDM – vCenter, NSX, VCF
Operations, VCF Automation – switch the identity source to Identity Broker,
re-map role assignments, and re-test login.

### 4. ELM break (if applicable)

Deactivate Enhanced Linked Mode once **every vCenter in the ring is on 9.1** –
the Identity Broker SSO model requires it.

### 5. Retire VIDM

Once every component logs in through Identity Broker and nothing depends on
VIDM, decommission the VIDM appliance(s). Review VIDM-fronted integrations,
runbooks, and monitoring hooks for retarget or removal.

---

## Do not confuse: embedded → instance

A **separate** migration – "Migration of Identity Broker Embedded to Identity
Broker Instance" – moves a vCenter-embedded Identity Broker to the three-node
HA cluster. It is not the VIDM → VIDB transition. If the upgrade deployed an
embedded Identity Broker and HA is wanted, that migration is its own step.

---

## Known issues

Seen on real upgrades – full detail in
[Field notes → Identity Broker / VCF SSO](04-field-notes.md#identity-broker--vcf-sso):

- **Encryption-key desync** between Identity Broker and the vCenter database
  (`mac check in GCM failed`, `401 invalid_client` on the token call) –
  fix is KB 377519 (`recover_ws1b.sh` + `Rotate_WS1B_secrets.sh`).
- **NTP clock skew** on the Identity Broker expires SAML tokens
  (`InvalidTimingException`); fix NTP first, but it alone will not clear a
  key-desync.
- **ELM drift** after breaking Enhanced Linked Mode – check the SDDC Manager
  API for drift status and re-run drift remediation; the management vCenter
  is the one that tends to hold out.

---

## Open items to confirm

- Whether a **clustered** VIDM 3.3.7 source needs anything extra for the
  migration script. The page lists no clustering limitation.
- Whether the directory can be **synced** (SCIM / JIT provisioning / LDAP
  sync) rather than imported once.

---

## Sources

- VCF 9.1.0.0 release notes: "What's new" (VCF Operations / identity) – The "script-based migration of data from VMware Identity Manager to identity broker" statement.
- [Migrating VMware Identity Manager to Identity Broker](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/managing-identity-and-access-using-vcf-single-sign-on/migrating-vmware-identity-manager-to-vcf-identity-broker.html) – The migration scripts: scope, source/target versions, limitations.
- [Migrate VCF Automation Authentication from VMware Identity Manager to VCF Identity Broker](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9/migrate-vcf-automation-single-sign-on-configuration-from-vmware-identity-manager-to-vcf-identity-broker.html) – Provider Management and Organization Portal.
- [Deploy VCF Management Services and License Server as Part of VCF Upgrade to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/deploy-vcf-management-services.html) – No VIDM upgrade path; Identity Broker deployed with Management Services; embedded vs. appliance handling.
- [Import User Groups From Source](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/infrastructure-operations/-configuring-administration-settings/managing-user-access-control/access-control-overview/access-control-user-groups-tab/import-user-groups-from-source.html) – The VCF Operations Access Control group-import procedure (source: VMware Identity Manager).
- [Upgrade to Identity Broker 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-identity-broker.html): Upgrading an existing **9.0.x** Identity Broker to 9.1 – a different path.
- KB 424497: Group mapping and user search issues in VCF Operations with Identity Broker – Known issues after cut-over.
- KB 433807: Set up VCF Identity Broker and VCF Logs in VMware Cloud Foundation 9.0 – Base Identity Broker setup.
