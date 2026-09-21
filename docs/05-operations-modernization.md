# Aria Operations → VCF Operations: in-place upgrade vs. fresh install

A companion to the [Overview](01-overview.md), expanding on
[Phase 1 – VCF Operations upgrade](13-vcf-upgrade-sequence.md#phase-1--vcf-operations-upgrade)
and the [standalone VVF manual upgrade path](14-standalone-vvf-upgrade.md#standalone-vvf-manual-upgrade--exact-steps).
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
| Network subnet compliance (see below) | Inherited as-is – an already-non-compliant layout stays non-compliant | Built compliant from the start, on a single subnet |
| Effort | Lower – one cluster, one upgrade | Higher – two clusters running in parallel during cutover, every adapter/integration re-registered |

Decide primarily on **whether historical metric/trend data needs to survive
the upgrade**. If yes, in-place is close to mandatory. If a clean start is
acceptable, fresh install removes the re-IP problem and lets the target
topology be built directly instead of converted into.

### Check the existing cluster's network topology before deciding

**Analytics cluster nodes are only supported on a single Layer 2 network
and IP subnet.** Per Broadcom TechDocs' [VMware Aria Operations Cluster
Node Networking Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/getting-started-with-vmware-aria-operations-8-18/preparing-for-installation/requirements/cluster-requirements/cluster-nodes-general-requirements/cluster-nodes-network-requirements.html):
*"Place analytics cluster nodes on same Layer 2 network and IP subnet. A
stretched Layer 2 or routed Layer 3 network is not supported."* Also:
*"Packet Round Trip Time between the analytics cluster nodes must be 5 ms
or lower"* and *"Network bandwidth between the analytics cluster nodes
must be one gbps or higher."* **There's no separate VCF 9-branded copy of
this specific page** – VCF Operations is Aria Operations rebranded at the
code level, and this is one of the places Broadcom's VCF 9 docs still
point back at the source product's own docs tree rather than forking a
copy. The 9.0-specific [VCF Operations 9.0 Sizing
Guidelines](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html)
(already in this doc's Sources) corroborates the latency figure directly –
*"< 5 ms"* general node-to-node latency – and adds a separate *"< 10 ms,
with possible occasional peaks up to 15 ms"* figure for datastore latency,
plus a per-cluster-size bandwidth table (15 Mbps Small up to 200 Mbps
Extra Large) rather than a single flat floor. Either way, this applies to
VCF Operations same as it did to Aria Operations – it isn't an
8.18-specific limit that goes away at 9.x.

If the **existing** cluster is already out of compliance with this –
nodes spread across different subnets, routed rather than switched between
them, or otherwise not meeting the latency/bandwidth figures above – that's
a strong signal toward **fresh install** rather than in-place: an in-place
upgrade carries the existing topology forward as-is, so an already
unsupported network layout stays unsupported (and a likely source of
cluster instability) straight through the upgrade. Fresh install sidesteps
this the same way it sidesteps re-IP – the new cluster's nodes are placed
correctly from the start, on a single compliant subnet, rather than
inheriting whatever the old cluster's network layout happened to be.
Check this **before** the historical-data-retention question above settles
the decision on its own – a cluster that needs fixing structurally may
still need to go fresh even if retaining trend data would otherwise argue
for in-place.

---

## Walkthrough A: in-place upgrade

Applies to Aria Operations 8.14+ (covers the 8.18.x line) going to VCF
Operations 9.1.x.

**1. Pre-upgrade**

1. Confirm the source build is on a supported direct-upgrade path to the
   target 9.1.x build (check the current VCF/vSphere Interoperability
   Matrix – some 8.18.x point releases skip straight to 9.1.1, others must
   land on an intermediate 8.18.x patch first).
2. Optionally run the Pre-Upgrade Readiness Assessment Tool (APUAT) –
   uploaded and installed the same way as any other PAK, against the
   **normal, online cluster**. Nothing about this step needs the cluster
   taken offline or brought online first, same as the real upgrade PAK
   below.
   - Download the **source-version-matched** Assessment Tool PAK from the
     Broadcom Support Portal – search "APUAT" or "VMware Aria Operations -
     Upgrade Assessment Tool". It's versioned to the build you're upgrading
     *from*, not the target.
   - Admin UI → **Software Update → Install a Software Update**, browse to
     the PAK, check "Install the PAK file even if it is already installed",
     leave "Reset Default Content" unchecked, **UPLOAD** (several minutes),
     accept the EULA, **NEXT**, then **INSTALL**.
   - The tool runs a one-time scan and self-deletes when finished – it
     doesn't alter anything in the system, so re-running it is harmless.
   - Retrieve the report: **Support → Support Bundles**, locate the
     most-recently-created bundle, download the ZIP, extract it, and open
     the HTML file inside.
   - Check two tabs before deciding whether to proceed: **System Validation
     Checks** (whether the system is upgrade-eligible at all – failures
     here are blocking) and **Removed/Disconnected Metrics** (dashboards,
     reports, management packs, alerts, and heat maps that reference
     metrics being deprecated in the target version, each with a link to a
     suggested replacement metric).
3. Take an **offline VM-level snapshot of every cluster node** (Primary,
   Replica, Data, Cloud Proxies) – deselect "Snapshot the virtual machine's
   memory".

**2. Apply the upgrade**

1. Admin UI → **Software Update → Install a Software Update**, upload the
   target-version Upgrade PAK.
2. If prompted, select "Install the PAK file even if it is already
   installed"; only select "Reset Default Content" if factory-shipped
   alerts/dashboards should be overwritten back to stock.
3. Monitor progress. The Admin UI restarts and the cluster automatically
   transitions Offline → Online during the update – this is expected, not a
   failure. Do **not** manually bring the cluster online first – install the
   PAK against the running cluster and let the update drive the Offline →
   Online transition itself. (The separate manual take-offline / bring-online
   sequence below applies only to the re-IP sub-procedure, not to applying
   the PAK.)
4. Confirm cluster health and that metrics are still flowing post-upgrade
   before moving on to the next fleet component.

**3. Deploy and register License Server, if not already present**

License Server is a required component for VCF 9.x licensing regardless of
path or Tier, and typically doesn't exist yet on an 8.18.x-only source –
see step 4 ("Deploy License Server") under
[Walkthrough B](#walkthrough-b-fresh-install) for the deployment and
connected/disconnected registration steps, identical regardless of which
walkthrough got VCF Operations to 9.1.x.

**4. Re-IP, only if the network is changing as part of the same window**

Manual and offline, run after the version upgrade completes:

1. Update DNS for the node(s) to the new IP **before** starting – forward
   and reverse resolution is mandatory for every node in the cluster.
2. Take the cluster offline (Admin UI → Cluster Status → Take Offline; wait
   for it to report Offline).
3. Update the network config on the VM itself (vSphere → Configure → vApp
   Options → IP / subnet / gateway / DNS).
4. Stop the CASA service (`service vmware-casa stop`), edit the node's
   config files (`casa.db.script`, `roleState.properties`,
   `persistence.properties`) to replace the old IP with the new one, restart
   CASA, then run the `vcopsConfigureRoles.py` script to reconcile the
   cluster's internal role/topology config.
5. Process nodes in strict order – **Primary → Primary Replica (if present)
   → Data nodes** – completing all sub-steps on one node before starting the
   next.
6. Bring the cluster back online.

---

## Walkthrough B: fresh install

**Not bound to VCF Management Services.** Deploying VCF Operations does not
require also deploying VCF Management Services – manual OVA deployment of
VCF Operations, standalone, without Management Services, is explicitly
supported for VVF 9.0/9.1 ("operating a standalone VVF infrastructure
without deploying VCF Management Services"). This is the same standalone
model the [manual upgrade path](14-standalone-vvf-upgrade.md#standalone-vvf-manual-upgrade--exact-steps)
already documents – it applies equally to a fresh VCF Operations deployment,
not just an in-place one.

**VCF Installer's automated flow is a separate, narrower route**, and not
generally the one this walkthrough follows – see [when it applies](#when-vcf-installer-is-the-better-fit-instead)
below. It can select HA mode for VCF Operations at initial deployment, but
only inside its fully automated bring-up flow, which assumes standardized
infrastructure (vDS, etc.) and does not support manual customization of
networking, cluster settings, or storage during that process.

**1. Deploy the Primary node**

1. In the vSphere Client, right-click the target inventory object →
   **Deploy OVF Template** → point it at the VCF Operations install OVA.
2. Step through the wizard: node name (no underscores or other
   nonstandard characters; must be unique per node in a multi-node
   cluster), compute/storage placement, network mapping.
3. Power on the VM, then browse to its FQDN or IP to reach the **initial
   setup wizard**:
   - Enter the Node Name and Node Address; set Current Cluster Role to
     Primary/new-cluster.
   - Set the admin password (minimum 15 characters, one uppercase, one
     lowercase, one digit, one special character).
   - Accept the default self-signed certificate, or load a custom one by
     browsing to the certificate file.
   - Leave the shared/virtual IP field blank unless a load-balanced VIP is
     being used for the cluster.
4. Finish the wizard and confirm the single-node cluster comes Online.

**2. Add a Data node, then activate HA against it**

HA is not a separate "deploy a Replica node" step – you deploy a **Data**
node first, then promote it to Replica through the admin interface:

1. Deploy a second appliance from the same OVA, with a static IP, following
   the same OVF wizard as step 1.
2. On the **Primary node's** admin interface (`https://<primary-fqdn-or-ip>/admin`),
   click **Add new Nodes**: enter the new node's name and IP address, set
   Current Cluster Role to **Data**, and supply the Primary's admin
   password.
3. Once the Data node has joined, click **Activate** under the **High
   Availability** section.
4. Select that Data node to serve as the Replica for the Primary, and
   confirm.
5. The cluster restarts to apply HA – wait for it to report **Online**
   again before doing anything else; this can take several minutes.

**3. Add further Data node(s) for capacity, if the target topology needs
more than Primary + Replica**

Repeat the "Add new Nodes" step above with Current Cluster Role set to
**Data**, one node at a time, letting each join fully complete before
starting the next.

**4. Deploy License Server**

License Server is a required component for VCF 9.x licensing regardless of
path or Tier – see [Full VCF upgrade sequence: Prerequisites –
Licensing](13-vcf-upgrade-sequence.md#prerequisites-and-architectural-guardrails).

1. In VCF Operations: **Manage → Licensing → Licenses & Registration →
   Manage → License Servers → Add License Server**, and copy the time-bound
   registration code it generates.
2. Download the License Server OVA from the Broadcom Support Portal.
3. Deploy it via **Deploy OVF Template** against the target cluster/host.
4. In the vApp properties step, set the appliance hostname and paste the
   registration key into the Unique Registration Key field – copy/paste
   only, to avoid case-sensitivity or auto-capitalization errors.
5. Power on and wait 5-10 minutes for the registration heartbeat to sync;
   confirm the appliance shows up under the License Servers list in VCF
   Operations.

**Registering VCF Operations + License Server with the VCF Business
Services console** ("licensing happy") is a separate step from deploying
the appliance itself, and is required regardless of Tier. Pick a mode based
on whether the environment has outbound internet access:

*Connected mode* (has internet access – recommended, simpler ongoing
upkeep):

1. In VCF Operations: **License Management → Registration** → in the
   connected-mode pane, click **Start Registration**. The VCF Business
   Services console opens in a new tab.
2. Log in to the console with Broadcom Support Portal credentials.
3. Select the **Site ID** to register this instance under, click Next.
4. Enter a unique display name for the VCF Operations instance, Save and
   Next.
5. Select licenses to add, Save and Next.
6. Review the summary, click **Generate Activation Code**, copy it, Finish.
7. Back in VCF Operations: **License Management → Registration** →
   connected-mode pane → **Enter Activation Code**, paste it, **Activate**.
8. Update licenses at least once every 6 months going forward – usage
   reporting is automated in this mode.

*Disconnected mode* (no internet access – manual file exchange, a heavier
but firewall-friendly path):

1. In VCF Operations: **Manage → Licensing → Licenses & Registration** →
   **Continue** on the Register & License pane.
2. On Select Connection Mode, choose **Disconnected**, Continue.
3. In the Download Registration File card, click **Download** and save the
   file.
4. From a computer with internet access, log in to the VCF Business
   Services console with Broadcom credentials, select the Site ID.
5. **Licensing → VCF Operations Registrations → New Registration**, import
   the registration file just downloaded.
6. Enter a unique name for the VCF Operations instance, Save.
7. Download the verification file from the console, import it back into
   VCF Operations, then download the confirmation file it produces and
   upload that back to the console – a two-way file exchange, not a single
   upload.
8. In the Add Licenses section, start the workflow for the relevant license
   server, download the license file from the console, and import it into
   VCF Operations.
9. Repeat the file exchange (report usage, pull an updated license file) at
   least once every 6 months (180 days) – there is no automatic heartbeat
   in this mode, it's a recurring manual task.

Confirm which mode fits the target environment's firewall policy before
committing – switching from disconnected to connected mode later is
possible but is its own documented procedure, not a toggle.

**5. Migrate content from the old cluster**

On the **old** cluster:

1. **Administration → Content Management → Export**, select Dashboards (and
   other content types as needed) – exclude out-of-the-box content unless
   it was customized.
2. Export **Configuration** and **Content** as separate exports.
3. Download the generated ZIP(s) from the Export tab.

On the **new** cluster:

1. **Administration → Control Panel → Content Management → Import**,
   browse to the exported ZIP, choose the desired conflict-resolution
   behavior, and import.
2. Import the **Configuration** export before the **Content** export – user
   and role information needs to exist first.
3. Confirm dashboards render fully (not stuck on the "still configuring"
   wrench icon) – that icon usually means an underlying View, Super Metric,
   or Custom Group referenced by the dashboard wasn't included in the
   export and needs rebuilding manually.

**6. Register data sources**

Register each vCenter as a data source – see
[Registering vCenter as a data source](#registering-vcenter-as-a-data-source-separate-from-the-fleet-attach)
below. This is independent of, and not a prerequisite for, attaching to the
fleet.

**7. Attach to the fleet, once it exists**

From VCF 9, one VCF Operations deployment manages one-or-more VCF
instances/fleets – you register an existing VCF instance *into* VCF
Operations (**Administration → Integrations → Add → VMware Cloud
Foundation**, pointing at SDDC Manager's FQDN), not the reverse. Building
VCF Operations standalone first and attaching SDDC Manager once the fleet
exists is a normal, documented pattern, not a workaround.

> **Constraint:** once a VCF 9.1 instance is part of a fleet, there is
> currently no supported way to relocate it to a different fleet / VCF
> Operations pairing afterward. Doesn't block building standalone ahead of
> time, but means the eventual fleet-to-Operations pairing should be
> planned to be correct the first time.

### When VCF Installer is the better fit instead

VCF Installer's automated bring-up is worth using directly, instead of this
manual walkthrough, when its prerequisites are already met:

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

If neither applies yet (no NSX, vCenter not at a qualifying build) but a
VCF Operations cluster is wanted ahead of the fleet build, Walkthrough B
above is the route.

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
- [Manual Upgrade Procedure for VMware Aria Operations via Admin UI](https://knowledge.broadcom.com/external/article/428747/manual-upgrade-procedure-for-vmware-aria.html)
- [Running the VMware Aria Operations 8.18 Pre-Upgrade Readiness Assessment Tool](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/getting-started-with-vmware-aria-operations-8-18/upgrade-backup-and-restore/before-upgrading-to-vrealize-operations-manager/running-the-vrops-8-x-pre-upgrade-readiness-assessment-tool.html)
- [Using the Pre-Upgrade Readiness Assessment Tool for VMware Aria Operations 8.18.x](https://knowledge.broadcom.com/external/article/369264/using-the-preupgrade-readiness-assessmen.html)
- [Install a Software Update on Aria Operations 8.18](https://knowledge.broadcom.com/external/article/434664/install-a-software-update-on-aria-operat.html)
- [Deploy VCF Operations Nodes](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/deployment/upgrading-cloud-foundation/preparing-your-vcf-9-management-components/preparing-to-upgrade-to-vmware-cloud-foundation/deploy-vcf-operations.html)
- [Aria Operations Content Management](https://www.brockpeterson.com/post/aria-operations-content-management)
- [Deploy a License Server](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/manual-adding-vcf-components-post-deployment/add-license-server.html)
- [Registering VCF Operations and a License Server with the VCF Business Services Console](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/register-vcf-operations.html)
- [Register VCF Operations in Connected Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/licensing/register-vcf-operations/register-vcf-operation-in.html)
- [Register VCF Operations in Disconnected Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/register-vcf-operations/register-vcf-operations-in-disconnected-mode.html)
- [Switch from Disconnected to Connected Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/switch-from-disconnected-to-connected-mode.html)
- [VMware Aria Operations Cluster Node Networking Requirements](https://techdocs.broadcom.com/us/en/vmware-cis/aria/aria-operations/8-18/getting-started-with-vmware-aria-operations-8-18/preparing-for-installation/requirements/cluster-requirements/cluster-nodes-general-requirements/cluster-nodes-network-requirements.html) – same-subnet requirement behind the fresh-vs-in-place topology check
