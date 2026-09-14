# Aria Operations → VCF Operations: in-place upgrade vs. fresh install

A companion to the [Overview](01-overview.md), expanding on
[Phase 1 – VCF Operations upgrade](01-overview.md#phase-1--vcf-operations-upgrade)
and the [standalone VVF manual upgrade path](01-overview.md#standalone-vvf-manual-upgrade--exact-steps).
Applies whenever there is an existing Aria Operations instance to carry
forward into VCF 9 – decide this **before** committing to a phase count, since
it changes whether a re-IP procedure, a content migration, or neither is on
the critical path.

---

## The two paths

**In-place upgrade** (Aria Operations 8.18.x → VCF Operations 9.1.x
directly) keeps everything – configuration *and* historical
metrics/trend data – but carries forward any accumulated cluster cruft
(orphaned adapters, stale content) and, if a network change is needed during
the upgrade, requires a manual node-by-node re-IP procedure (below) on top of
the upgrade itself.

**Fresh install** (deploy a new VCF Operations 9.1.x cluster and migrate
content across) gives a clean start and sidesteps re-IP entirely, but does
**not** carry historical metrics/trend data across – only configuration
content transfers. Confirmed working in practice: dashboards exported from
an 8.18.x cluster via Content Management import cleanly into a fresh 9.1.x
cluster. Content Management export/import is confirmed to cover dashboards,
dashboard sharing, custom groups, and super metrics; coverage of
views/reports/alert-symptom-recommendation definitions and policies is
likely but not independently confirmed – verify per object type before
relying on it for anything not explicitly listed here.

| | In-place upgrade | Fresh install + content import |
|---|---|---|
| Historical metrics/trend data | Preserved | **Lost** – stays on the old cluster |
| Configuration (dashboards, groups, super metrics, …) | Preserved automatically | Migrated selectively via Content Management export/import |
| Legacy cluster cruft | Carried forward | Left behind |
| Re-IP, if the network changes | Required as a separate manual procedure | Not needed – deploy directly at the target address |
| Topology | Must convert on the existing nodes | Can build the target topology (HA, node count) directly |
| Effort | Lower – one cluster, one upgrade | Higher – two clusters running in parallel during cutover, every adapter/integration re-registered |

Decide primarily on **whether historical metric/trend data needs to survive
the upgrade**. If yes, in-place is close to mandatory. If a clean start is
acceptable, fresh install removes the re-IP problem and lets the target
topology be built directly instead of converted into.

---

## Re-IP procedure (in-place path only)

Supported, documented, but manual and offline – applies to Aria Operations
8.14+ (covers the 8.18.x line):

1. Update DNS for the node(s) to the new IP **before** starting – forward and
   reverse resolution is mandatory for every node in the cluster.
2. Take the cluster offline (Admin UI → Cluster Status → Take Offline; wait
   for it to report Offline).
3. Update the network config on the VM itself (vSphere → Configure → vApp
   Options → IP / subnet / gateway / DNS).
4. Stop the CASA service (`service vmware-casa stop`), edit the node's config
   files (`casa.db.script`, `roleState.properties`,
   `persistence.properties`) to replace the old IP with the new one, restart
   CASA, then run the `vcopsConfigureRoles.py` script to reconcile the
   cluster's internal role/topology config.
5. Process nodes in strict order – **Primary → Primary Replica (if present)
   → Data nodes** – completing all sub-steps on one node before starting the
   next.
6. Bring the cluster back online.

---

## Fresh install: deployment method and topology

**Not bound to VCF Management Services.** Deploying VCF Operations does not
require also deploying VCF Management Services – manual OVA deployment of
VCF Operations, standalone, without Management Services, is explicitly
supported for VVF 9.0/9.1 ("operating a standalone VVF infrastructure
without deploying VCF Management Services"). This is the same standalone
model the [manual upgrade path](01-overview.md#standalone-vvf-manual-upgrade--exact-steps)
already documents – it applies equally to a fresh VCF Operations deployment,
not just an in-place one.

**VCF Installer's automated flow is a separate, narrower route.** VCF
Installer's own deployment wizard can select HA mode for VCF Operations at
initial deployment, but only inside its fully automated bring-up flow, which
assumes standardized infrastructure (vDS, etc.) and does not support manual
customization of networking, cluster settings, or storage during that
process. It also comes in two forms with different prerequisites:

- **Greenfield (new fleet/instance)** – VCF Installer deploys a brand-new
  vCenter itself; no existing/upgraded vCenter is required.
- **Converging an existing vCenter** – the vCenter must already meet a
  version bar before VCF Installer's converge workflow will run against it:
  vCenter 9.0+ to converge to VCF 9.0.0; vCenter 8.0 U3+ is acceptable for
  converging to 9.0.1/9.0.2 **only if** it already has an existing NSX
  registration at 4.2.1+ – otherwise it still needs upgrading first. ESX
  hosts carry an equivalent gate (9.0+ for 9.0.0; 8.0 U1+ acceptable for
  9.0.1/9.0.2 scenarios). VCF Installer does not upgrade vCenter for you as
  part of convergence – the manual upgrade happens first, then Installer
  orchestrates NSX / SDDC Manager / workload-domain creation once the
  vCenter already qualifies.

**Route when neither automated form fits** (no NSX yet, vCenter not at a
qualifying build, and a standalone-ahead-of-the-fleet deployment is wanted):
manual OVA deployment throughout.

1. Deploy the Primary node via OVA.
2. Run the documented manual HA setup wizard ("Configure a VCF Operations
   Cluster for High Availability", filed under advanced architectures in
   Broadcom's docs) to add a Replica node. This is a manual, post-deployment
   step regardless of whether VCF Installer or OVA was used to stand up the
   Primary.
3. Add Data node(s) for capacity, one at a time – let each join fully
   complete before starting the next.
4. Deploy License Server alongside it. License Server is a required
   component for VCF 9.x licensing regardless of path or Tier – see
   [Overview: Prerequisites – Licensing](01-overview.md#prerequisites).
5. Import dashboards/content from the old cluster via Content Management
   export/import.

**Attaching to the fleet later.** From VCF 9, one VCF Operations deployment
manages one-or-more VCF instances/fleets – you register an existing VCF
instance *into* VCF Operations (Administration → Integrations → Add →
VMware Cloud Foundation, pointing at SDDC Manager's FQDN), not the reverse.
Building VCF Operations standalone first and attaching SDDC Manager once the
fleet exists is a normal, documented pattern, not a workaround.

> **Constraint:** once a VCF 9.1 instance is part of a fleet, there is
> currently no supported way to relocate it to a different fleet / VCF
> Operations pairing afterward. Doesn't block building standalone ahead of
> time, but means the eventual fleet-to-Operations pairing should be
> planned to be correct the first time.

---

## Registering vCenter as a data source (separate from the fleet attach)

Don't conflate this with attaching SDDC Manager (above) – a fresh VCF
Operations cluster needs each vCenter registered individually as a data
source before it collects anything from them, regardless of whether/when
that cluster is later attached to a fleet.

**Prerequisites:**

- A cloud proxy already deployed and network-reachable to the vCenter
  instance.
- vCenter credentials with at least Read access at datacenter/vCenter level,
  plus **"Performance > Modify intervals"** permission for guest metrics.
- Log management appliance deployed, if log collection from this vCenter is
  wanted.

**Procedure** (Operate → Administration → Integrations → Accounts tab →
Add → vCenter):

1. Enter a display name/description (include the IP for easy
   identification as a convention).
2. Enter the vCenter **FQDN**, not IP – *"vCenter instances configured using
   IP address are not included in VCF accounts. If you want the vCenter
   instance to be part of the VCF account, enter the FQDN."*
3. Select or create the associated Physical Data Center.
4. Add credentials, and optionally separate Action Credentials for running
   actions.
5. Select the Cloud Proxy/Group that will manage this account.
6. Toggle Activate for Operational Actions / Log Collection / Network and
   Flow as needed; expand Advanced Settings for collector, discovery, and
   event-change options.
7. Click **Validate Connection**, review the presented certificate against
   the vCenter's actual certificate, and accept.
8. After the account is added, open its context menu and click **Start
   Collecting**.

Collection then proceeds on a standard 5-minute cycle; initial collection
for a large environment can take more than one cycle to fully populate.

**For a fleet with multiple vCenters** (the common case for a convergence
engagement with several existing vCenter instances), each one is registered
as its own account through this same flow – there is no bulk-register step.

---

## Continuous Availability vs. plain HA – don't conflate them

Both are **opt-in, advanced-architecture** configurations in VCF 9
Operations, not defaults – Broadcom files both under "Manual Deployment and
Configuration of Components for Advanced Architectures." They solve
different problems and have different minimum topologies:

- **HA (Replica node)** – single-site failover pair: Primary + Replica (+
  Data node(s) for capacity). Protects against loss of one node.
- **Continuous Availability (CA)** – multi-fault-domain resilience: needs
  three separate fault domains (Primary fault domain with ≥1 Primary + ≥1
  Data node, a mirrored Replica fault domain, and a Witness fault domain),
  each fault domain able to be a different workload domain, availability
  zone, or region. Adds FD-to-FD latency requirements (~≤10ms) and
  witness-node sizing that HA alone does not need.

A 3-node cluster spread across 3 sites over L3 *looks like* the textbook
minimum CA topology, but confirm CA is actually configured (not just a
node/site count that happens to resemble it) before designing an upgrade or
downscale procedure around CA-specific assumptions – node/site count alone
is not proof of CA.

---

## Removing a node – data loss

Verbatim from Broadcom's documentation:

> "When you remove a node, you lose data that the node had collected unless
> you are running in high availability (HA) mode. HA protects against the
> removal or loss of one node."

Without HA, removing a Data node loses whatever metrics/objects it held –
there is no documented rebalance/redistribution alternative. Practical
notes for a non-HA removal:

- Cluster must be in a clean Online/Offline state – never mid expand/shrink;
  contact support instead of forcing it if it's in a failed state.
- Take a snapshot/backup first.
- Removal itself, for a Data or Remote Collector node, is one call:
  `curl -ik -u 'admin:password' -X DELETE https://<primary_node_IP>/casa/deployment/slice/<node_to_remove_IP>`
- Re-check sizing on the surviving node(s) against the full object/metric
  count before committing – a downscale concentrates the same workload onto
  fewer nodes.

---

## Sources

- [Change the IP Address of Aria Operations 8.14 or later Deployment](https://knowledge.broadcom.com/external/article/336690/change-the-ip-address-of-aria-operations.html)
- [Manually removing a node from the Aria Operations cluster](https://knowledge.broadcom.com/external/article/318826/manually-removing-a-node-from-the-aria-o.html)
- [Manual deployment of VCF Operations in a vSphere Foundation 9.0, 9.1 environment](https://knowledge.broadcom.com/external/article/423051/manual-deployment-of-vcf-operations-in-a.html)
- [Configure a VCF Operations Cluster for High Availability](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-and-configuration-of-components-for-advanced-architectures/run-the-setup-wizard-to-create-an-ha-node.html)
- [Configure VCF Operations Cluster for Continuous Availability](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-and-configuration-of-components-for-advanced-architectures/configure-vcf-operations-cluster-for-continuous-availability.html)
- [Start a New VCF Fleet or a New VCF Instance Deployment by Using the VCF Installer Deployment Wizard](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/deploy-a-new-vcf-fleet-or-a-new-vcf-instance.html)
- [Converging a vCenter Instance and ESX Hosts](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/converging-your-existing-vsphere-infrastructure-to-a-vcf-or-vvf-platform-/supported-scenarios-to-converge-to-vcf/converge-your-existing-vcenter-instance-and-esx-hosts.html)
- [VCF Operations 9.0 Sizing Guidelines](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html)
- [Configuring a vCenter Account in VCF Operations](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/connect-to-data-sources/vsphere/configuring-a-vcenter-server-cloud-account-in-vrealize-operations.html)
