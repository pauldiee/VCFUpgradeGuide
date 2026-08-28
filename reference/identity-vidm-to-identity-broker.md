# Reference: VIDM / Workspace ONE Access → VCF Identity Broker

Detail behind the [Identity section](../docs/01-overview.md#identity-vidm--workspace-one-access--vcf-identity-broker)
of the overview. VCF 9 replaces VMware Identity Manager (VIDM / Workspace ONE
Access) with **VCF Identity Broker (VIDB)** as the fleet identity layer.

> **Status: partial.** The 9.1.0.0 release notes state "Support for
> script-based migration of data from VMware Identity Manager to identity
> broker", but Broadcom has not published a prominent standalone procedure for
> it. What is documented is the **Access Control group import** (below). Treat
> the "script" as a thing to confirm against the current 9.1 identity guide or
> a KB before relying on it.

---

## The short version

- **No in-place upgrade for VIDM.** Identity Broker 9.1 is deployed fresh as
  part of **VCF Management Services** (overview Phase 3). VIDM is not consumed
  by VCF 9.
- **Parallel run.** Identity Broker is an *additional* authentication source
  alongside VIDM and each component's native auth. Keep VIDM running until
  every component that uses it has been re-pointed.
- **Users and groups can be brought across.** The upstream identity source
  (AD / LDAP / SAML IdP) itself is unchanged – only the broker layer moves.
- **Everything else is rebuilt by hand.**

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
- If the upgrade produced an **embedded** Identity Broker and an HA cluster is
  wanted, that is a *separate* migration – see
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

## Open items to confirm

- The **script-based migration** from the 9.1.0.0 release notes: its name,
  where it runs, whether it does more than the Access Control group import,
  and whether a **clustered** VIDM 3.3.x source is supported.
- Whether the directory can be **synced** (SCIM / JIT provisioning / LDAP
  sync) rather than imported once.

---

## Sources

| Reference | Covers |
| --- | --- |
| VCF 9.1.0.0 release notes – "What's new" (VCF Operations / identity) | The "script-based migration of data from VMware Identity Manager to identity broker" statement |
| [Deploy VCF Management Services and License Server as Part of VCF Upgrade to 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/deploy-vcf-management-services.html) | No VIDM upgrade path; Identity Broker deployed with Management Services; embedded vs. appliance handling |
| [Import User Groups From Source](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/infrastructure-operations/-configuring-administration-settings/managing-user-access-control/access-control-overview/access-control-user-groups-tab/import-user-groups-from-source.html) | The VCF Operations Access Control group-import procedure (source: VMware Identity Manager) |
| [Upgrade to Identity Broker 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-identity-broker.html) | Upgrading an existing **9.0.x** Identity Broker to 9.1 – a different path |
| KB 424497 – Group mapping and user search issues in VCF Operations with Identity Broker | Known issues after cut-over |
| KB 433807 – Set up VCF Identity Broker and VCF Logs in VMware Cloud Foundation 9.0 | Base Identity Broker setup |
