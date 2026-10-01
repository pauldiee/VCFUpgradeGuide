# Avi Load Balancer + License Hub upgrade

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
expanding on its [Conditional phases table's Avi + License Hub
row](13-vcf-upgrade-sequence.md#conditional-phases-optional-components): two separate
components that travel together because License Hub licenses Avi.

Applies whenever **Avi Load Balancer (NSX Advanced Load Balancer)** is in
use. **Position: after Disaster Recovery Products, before SDDC Manager** –
ahead of the core NSX / vCenter / host tier. In Broadcom's 9.1
[upgrade order](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html)
it is step 5, *"Upgrade to Avi Load Balancer 32.1.1"*, footnoted
*"Component is not part of the VCF SKU"*.

---

## Avi Load Balancer

> **Hard blocker: Avi 32.1.1 is the minimum for VCF 9.1.** Per Broadcom:
> *"Avi Load Balancer must be upgraded to version 32.1.x before upgrading
> NSX Manager / vCenter to VCF version 9.1."* Upgrade Avi first, not as an
> afterthought. (VCF 9.1.1's new Avi features need **32.1.3**, per the
> [Avi for VCF 9.1.1 release notes](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/release-notes/vmware-avi-load-balancer-for-vcf-911-release-notes.html).)

### Which procedure applies

Broadcom's
[Upgrade Avi Load Balancer](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html)
chapter covers VCF **5.2.x → 9.1** and **9.0 → 9.1**, and *"is applicable
only for Avi Controllers deployed using SDDC Manager."* That is the normal
case for a fleet coming from 5.2 or 9.0. For the upgrade mechanics it
points to the general
[Avi Upgrade Guide](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-administration-guide/nsx-advanced-load-balancer-controller-operations/upgrade-and-patches/upgrade-guide.html)
(Controller and Service Engine groups), summarized below.

On 9.1, a Controller deployed **from VCF Operations** has its lifecycle
owned by VCF Operations (certificates, service accounts, registration).
Broadcom does not yet document a separate upgrade flow for that case. See
[Open items](#open-items-to-confirm).

### Supported source versions

From Broadcom's
[Checklist for Upgrade to 32.1.x](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-release-notes/checklist-for-upgrade-to-32-1-x.html):

| Running | To 32.1.1 | To 32.1.2 | To 32.1.3 |
| --- | --- | --- | --- |
| 22.1.4 – 22.1.7 | Yes | Yes | Yes |
| 30.1.1 – 30.1.2 | Yes | Yes | Yes |
| 30.2.1 – 30.2.7 | Yes | Yes | Yes |
| 31.1.1 – 31.1.2 | Yes | Yes | Yes |
| 31.2.1 – 31.2.2 | Yes | Yes | Yes |
| **31.2.3** | **No** | **No** | Yes |
| 32.1.1 | – | Yes | Yes |
| 32.1.2 | No | – | Yes |

- *"The minimum upgradable version is 22.1.4."* Anything older needs an
  intermediate hop to a 22.1.x release first.
- **31.2.3 can only go to 32.1.3**, which is newer than VCF 9.1's 32.1.1
  minimum.
- The Broadcom Interoperability Matrix's Upgrade Path view has almost no
  Avi data (only 32.1.1 / 32.1.2 → 32.1.3, checked 2026-10-01). Use the
  checklist above, not the matrix.

### Two traps before you start

> **Trap 1 – a UI upgrade can roll the Controller *back*
> ([KB 456265](https://knowledge.broadcom.com/external/article/456265), AV-294942).**
> *"On an Avi Controller version 32.1.1 through 32.1.3 which has been
> upgraded from a previous Avi version, a subsequent upgrade or patch
> operation initiated via the UI may result in a rollback to the previous
> version, resulting in config rollback and traffic disruption."* Example
> from the KB: 30.2.7 → 32.1.2, then a UI upgrade to 32.1.3 lands back on
> **30.2.7**. The first hop to 32.1.x is not affected, and neither is a
> fresh 32.1.x deployment. **Every later upgrade or patch on 32.1.x must
> be run from the CLI or API.** That includes the upgrade *to* 32.1.4,
> which carries the fix (as do the 32.1.2-2p3 and 32.1.3-2p1 patches).

> **Trap 2 – legacy licenses get 90 days.** From 32.1.1, 25-character serial
> keys and YAML licenses are deprecated. After the upgrade they work for
> *"a strict grace period of 90 days"*, which *"overrides any existing
> validity dates"*. Have the new subscription license file in place, through
> [License Hub](#license-hub) or directly via the Avi Cloud Console,
> before that runs out. **Upgrades are also blocked if the Controller only
> has the built-in Eval/Trial license.**

### Prerequisites

From the VCF 9.1 Avi upgrade chapter's
[pre-upgrade checks](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1/performing-pre-upgrade-checks.html)
and the 32.1.x checklist:

- **Inventory:** Controller and Service Engine versions, plus the SDDC
  Manager, vCenter, NSX and ESX versions.
- **One VPC-enabled cloud at most.** *"Starting with Avi Load Balancer
  version 31.2.1, the Controller supports a maximum of one cloud with VPC
  enablement."* Consolidate, or disable VPC on the other clouds, before
  the upgrade.
- **Integration healthy:** NSX Cloud green, Tier-1 segments / VPCs syncing
  with VRFs in place, no major active alerts. IPAM pools have free
  addresses (only when Avi IPAM serves the VIPs, not for VIPs inside
  VPCs). DNS profile working.
- **Controller sizing:** *"Controllers will fail to upgrade if they are in
  the Essentials flavor (less than 6 cores or 32 GB of memory)."* Also
  check the enforced system limits; exceeding them blocks the upgrade.
- **Review the vCenter / NSX roles** of the Avi service accounts.
- **`allow_unauthenticated_nodes` must be `false`.** Upgrading to 32.1.2
  or later fails while it is enabled.
- **Custom external health monitors:** scripts using `pymssql` or
  `cx_Oracle` must move to `mssql-python` / `oracledb`.
- **Mandatory full configuration backup**
  ([Backup and Restore](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-administration-guide/nsx-advanced-load-balancer-controller-operations/backup-and-restore-of-avi-vantage-configuration.html)).
- **Images:** download the target, any intermediate hops and the rollback
  image from the Broadcom Support portal. Verify the checksums and upload
  them to the Controller. Upload works from the cluster leader only, and
  the Controller needs disk space for several images.
- **Coming from VCF 5.2.1:** vRealize Automation must be on 8.18.1 Patch 3
  and migrated to the new architecture first (KB 403314).
- **Change control:** agree on a maintenance window and rollback criteria,
  and warn stakeholders of brief control-plane disruption.

### Procedure

Order: **Controller first, then the Service Engine groups.** They can be
upgraded together ("System") or separately. SE groups may stay on the old
version for a while and be done group by group.

1. **Prechecks only (optional, safe outside the window).** CLI:

   ```
   upgrade controller image_ref <image-name> prechecks_only
   ```

   This runs the full precheck list without upgrading anything. It is not
   available in the UI; from 31.1.1 the UI offers **Pre-check Only** and
   **Dry Run** options instead.
2. **Upload the image:** **Administration → Controller → Software →
   Upload From Computer** (the `.pkg` file).
3. **Upgrade.** In the UI: **Administration → Controller → Update**,
   select the image, **UPGRADE**, and tick **Upgrade All Service Engine
   Groups** for a system upgrade. **But see
   [Trap 1](#two-traps-before-you-start):** on a Controller that is already
   on an upgraded 32.1.x, use the CLI instead, for example:

   ```
   upgrade system image_ref <image-name>
   ```

   The CLI stops at `UPGRADE_PRE_CHECK_WARNING` when prechecks return
   warnings. Review them with
   `show upgrade status detail filter pre_check_status`, then rerun with
   `skip_warnings`. Errors cannot be skipped.
4. **SE groups separately (if not done as a system upgrade):**
   **Administration → Controller → SEG Update**, select the group(s),
   **UPGRADE**.

> **Untested:** the CLI commands above are quoted from Broadcom's Avi
> Upgrade Guide (generic examples, run on older releases there). They have
> not been run in this repo's labs against 32.1.x.

**Data-plane impact.** SEs in a group upgrade one at a time. That is
non-disruptive for virtual services in Elastic HA Active-Active, in N+M
scaled to two or more SEs, and in legacy Active-Standby. It **is
disruptive** for virtual services placed on a single SE in N+M buffer
mode. Long-lived connections on SEs can drop during scale-in. During a
system upgrade, virtual service and VIP configuration is blocked until all
SEs are upgraded.

### After the upgrade: Controller configuration for 9.1

From
[Configuring the Controller Post Avi Upgrade](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1/configuring-the-avi-controller-post-avi-upgrade.html):

- **Certificate verification.** Create a PKI profile with the vCenter CA
  certificates and set it as the **Truststore PKI Profile** (**Administration
  → System Settings → EDIT → Access**). A management-domain Controller
  needs the management vCenter CA; a workload domain needs both the
  management and the workload vCenter CA. Then tick **Verify Certificates**
  on the NSX / vCenter clouds.
- **Service account role.** An Avi service account created as **Network
  Admin** in NSX (from VCF 5.2.3) must become **Enterprise Admin**. Do this
  through the domain's configuration-drift check in SDDC Manager, after the
  VCF management components are upgraded.
- **Auto onboarding.** From 32.1.1, the NSX cloud's **Auto Onboarding** flag
  registers Avi with NSX Manager (recommended). From 32.1.3, the Controller
  also imports its certificates into the NSX trust store itself.
- **VCF Automation discovery.** The Controller needs an NSX cloud in VPC
  mode whose **NSX URL matches the NSX Manager registered in VCF
  Automation**. If VCF Automation uses a hostname and the cloud uses an IP,
  change the cloud to the hostname. Discovery only works once the
  management stack is on 9.1, and *"All workload domains ... must be
  upgraded to VCF version 9.1 before Avi is discovered."*
- **Coming from 5.2.1:** unless the cloud connector already uses an FQDN,
  switch the NSX Manager address from IP to FQDN and use the
  `svc-<avi-host-name>-<nsx-hostname>` service-account format
  ([Validating VCF Post Upgrade](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1/validating-avi-load-balancer-and-vcf-post-upgrade/validating-vcf-post-upgrade.html)).
- **After every component upgrade,** check configuration drift in SDDC
  Manager, vCenter and NSX Manager.

**Later, once the whole stack is on 9.1 (9.0 → 9.1 only):** Supervisor
namespaces created before the upgrade keep their original default SE
group. To move one to a specific SE group, patch it from the VCF CLI
([procedure](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/update-the-service-engine-group-for-existing-namespaces-after-an-upgrade.html)):
`kubectl patch svns <namespace> -n <project> --type merge -p
'{"spec":{"segName":"<new-seg-name>"}}'` (untested here).

**Known issue on the way to 9.1.1 (ANSIX-4485):** during a 9.x → 9.1.1
upgrade, the `nsxt-alb` account can get locked out by a burst of HTTP 401
errors while an internal token expires. It stays locked after a valid
token is issued. Broadcom's fix is the *Avi account lockout and AKO
failures* troubleshooting guide, per the
[Avi for VCF 9.1.1 release notes](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/release-notes/vmware-avi-load-balancer-for-vcf-911-release-notes.html).

### Before moving on

Broadcom's
[post-upgrade checks](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1/validating-avi-load-balancer-and-vcf-post-upgrade/validating-avi-load-balancer-post-upgrade.html),
condensed. *"Do not proceed with upgrading VCF until all the issues are
solved."*

- **Controller:** cluster **HA active**, no critical alarms, no unexpected
  failovers. UI / API reachable, licensing valid.
- **Service Engines:** all on the target version, none degraded or
  disconnected, anti-affinity rules honored.
- **Integration:** NSX Cloud **green**, Tier-1 / VPC and segment
  inventory accurate (all VRF contexts present). IPAM allocates a test VIP;
  DNS updates work.
- **Data plane:** all virtual services respond, pool members healthy,
  TLS / WAF / GSLB policies applied, logs and analytics flowing.
- **Golden backup:** export a new configuration backup, labelled with
  version and date.

Repeat the integration checks after vCenter / NSX are upgraded, then for
each workload domain (VIP and pool health, GSLB, WAF, SE placement).
Separately, VCF Automation only discovers the Controllers after the NSX
finalize step.

### Rollback

From the Avi
[Rollback](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-administration-guide/nsx-advanced-load-balancer-controller-operations/upgrade-and-patches/rollback.html)
page and the VCF 9.1
[Rollback Procedure](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/update-the-service-engine-group-for-existing-namespaces-after-an-upgrade/roll-back-procedure.html):

- **Three scopes:** **System** (Controller and all SE groups, *disruptive*),
  **Controller** only (non-disruptive), or some or all **SE groups**
  (non-disruptive).
- System and Controller rollback reboot the Controller and restore the
  previous version's configuration. **Configuration changes made after the
  upgrade are lost.**
- Roll back on critical failures that can't be fixed quickly, data-plane
  outages or broken integrations, and **within the change window**.
  *"Rollback is not possible once the VCF upgrade is complete."* In
  practice, decide before the NSX / vCenter phases start, because those
  need Avi on 32.1.x anyway.

---

## License Hub

License Hub licenses **vDefend and Avi** subscription license files
(replacing the 25-character keys). Never scope it on the strength of the
Security Services Platform alone.

> **License Hub is not the License Server.** The **License Server** is
> deployed automatically at bring-up /
> [Phase 3](13-vcf-upgrade-sequence.md#phase-3--deploy-vcf-management-services--license-server)
> and licenses the VCF *fleet*. **License Hub** is a separate Day-N
> appliance for vDefend / Avi.

**Deploying it** is covered in the companion repo, not repeated here:
[License Hub – Deployment Guide (VCF9-DeploymentPlanning)](https://vcf-planning.hollebollevsan.nl/docs/15-license-hub/).
It walks through
[the full sequence](https://vcf-planning.hollebollevsan.nl/docs/15-license-hub/#the-full-sequence-start-to-finish),
the [2.0 standalone OVA](https://vcf-planning.hollebollevsan.nl/docs/15-license-hub/#license-hub-20-standalone-ova)
and the older [5.1.2 SSP Installer flow](https://vcf-planning.hollebollevsan.nl/docs/15-license-hub/#license-hub-512-ssp-installer-flow).
Pointing the upgraded Controller at the hub (**Administration → Licensing**,
*Cloud Licensing* or *On-prem License Hub*, then onboarding the Controller
as an endpoint with its full-chain certificate) is in the Avi guide's
[Licensing section](https://vcf-planning.hollebollevsan.nl/docs/14-avi-load-balancer/#licensing).

**How it relates to the Avi upgrade.** From
[License Management for Avi Load Balancer](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/build-and-deploy-avi-91/license-management-for-avi-load-balancer.html):

- **Order of work:** upgrade the entitlement to the subscription format in
  the Broadcom Support Portal, deploy License Hub and register it with the
  Avi Cloud Console, allocate the license there, then assign the license
  file to the Controller from License Hub.
- **Connected vs. disconnected.** In connected mode, *"Avi Controllers that
  cannot run a License Hub can connect and register directly to the Avi
  Cloud Console"*, and Controllers already registered there before the
  upgrade *"continue to work seamlessly"*. **Disconnected (air-gapped)**
  environments use License Hub: export usage files, upload them to the Avi
  Cloud Console, and import the newly signed license files.
- **Usage reporting:** usage must be reported **every 180 days**, and each
  report unlocks the next 180-day license increment.

Versions:

- **License Hub 2.0** (2026) ships as a **single standalone OVA** (~11 GB),
  listed under the **Avi Load Balancer** download page → *Primary
  Downloads*. It no longer uses the Security Services Platform Installer /
  `.tar` flow. **There is no 5.1.2 → 2.0 upgrade path** – a fresh 2.0
  deployment.
- **License Hub 5.1.2** (older, if that is what is installed): three VMs
  (installer / controller / worker), roughly **9 IPs** in two pools
  (installer 1, nodes 4, services 4) whose **node and service pools cannot
  be changed after deployment**, two FQDNs.
- **Confirm which version applies** before re-using any 5.1.2 IP-pool /
  FQDN guidance – the 2.0 single-OVA deploy prompts for different inputs.

---

## Open items to confirm

- **Upgrading a Controller that VCF Operations deployed on 9.1** (for
  example 32.1.1 → 32.1.4): Broadcom's 9.1 chapter only covers
  SDDC-Manager-deployed Controllers. Confirm whether VCF Operations drives
  the upgrade or it stays a manual Avi upgrade, and how KB 456265's
  CLI-only workaround fits in.

---

## Sources

| Source | Used for |
| --- | --- |
| [Upgrading to VMware Cloud Foundation 9.1.x](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation.html) | Position in the order (step 5), not-in-VCF-SKU footnote |
| [Upgrade Avi Load Balancer (Avi for VCF 9.1)](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html) and its child pages (pre-upgrade checks, workflow, post-upgrade configuration, validation, SE group update, rollback) | Scope, prerequisites, post-upgrade configuration, validation, rollback criteria |
| [Checklist for Upgrade to 32.1.x](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-release-notes/checklist-for-upgrade-to-32-1-x.html) | Supported source versions, 90-day legacy license grace period, blockers |
| [KB 456265](https://knowledge.broadcom.com/external/article/456265) | UI-triggered upgrade rollback on 32.1.x (AV-294942) |
| [Avi Upgrade Guide (32.1)](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer/32-1/vmware-avi-load-balancer-administration-guide/nsx-advanced-load-balancer-controller-operations/upgrade-and-patches/upgrade-guide.html), Upgrade Overview, Prerequisites, UI procedures, Rollback | Controller / SE group mechanics, prechecks, data-plane impact, rollback scopes |
| [Avi for VCF 9.1.1 Release Notes](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/release-notes/vmware-avi-load-balancer-for-vcf-911-release-notes.html) | 32.1.3 for 9.1.1 features, ANSIX-4485 lockout |
| [License Management for Avi Load Balancer (9.1)](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/build-and-deploy-avi-91/license-management-for-avi-load-balancer.html) | License transition order, connected vs. disconnected, 180-day reporting |
| Broadcom Product Interoperability Matrix, Upgrade Path (Avi Load Balancer, checked 2026-10-01) | Confirms the matrix has almost no Avi path data |
