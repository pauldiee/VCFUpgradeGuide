# VCF Operations sizing and scaling (9.1)

How big each VCF Operations node size is on 9.1, how to tell whether the
current size still fits, and how to **scale up** (bigger nodes) or **scale
out** (more nodes) afterwards. Applies to **VCF and VVF**. It complements
[Aria Operations → VCF Operations](05-operations-modernization.md), which
covers getting to 9.1 in the first place.

Typical moments to come here:
- before an Aria Operations 8.18 → VCF Operations 9.1 upgrade, to check
  the existing cluster still fits its size;
- after an upgrade or import that added vCenters, hosts or VMs;
- when VCF Operations is slow, or objects or metrics are near the limits
  below.

---

## Where 9.1 sizing lives

For 9.1.x, Broadcom no longer publishes a separate sizing KB. Its sizing
index ([KB 324340](https://knowledge.broadcom.com/external/article/324340))
points **9.1.x** to **VMware Configuration Maximums**
([configmax.broadcom.com](https://configmax.broadcom.com/), product *VCF
Operations*). The 9.0 equivalent was
[KB 397782](https://knowledge.broadcom.com/external/article/397782/vcf-operations-90-sizing-guidelines.html).
For a sizing based on your own object and metric counts, use the
[VCF Operations Sizing Estimator](https://vcfopssizer.broadcom.com/).

---

## Node sizes (Configuration Maximums, VCF Operations 9.1)

Captured from Configuration Maximums, VCF Operations 9.1.0. There is no
separate 9.1.1 release of these values.

| Size | vCPU | RAM (GB) | Max objects, single node | Max metrics, single node | Max objects per node in a cluster | Max metrics per node in a cluster | Max nodes | Max objects per cluster |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Extra Small | 2 | 8 | 700 | 140,000 | – | – | 1 | 700 |
| Small | 4 | 16 | 10,000 | 1,600,000 | 6,000 | 1,400,000 | 2 | 12,000 |
| Medium | 8 | 32 | 30,000 | 5,000,000 | 17,000 | 4,000,000 | 8 | 136,000 |
| Large | 16 | 48 | 44,000 | 8,000,000 | 36,000 | 6,000,000 | 16 | 576,000 |
| Extra Large | 24 | 128 | 100,000 | 20,000,000 | 88,000 | 15,000,000 | 12 | 1,056,000 |

- **Per-node limits drop once you add nodes.** A single Medium node takes
  30,000 objects, but in a cluster each Medium node takes 17,000. Size a
  cluster on the *per node in a cluster* columns.
- **Memory can be raised** to a maximum per size (Extra Small 16 GB,
  Small 32, Medium 64, Large 96, Extra Large 256 GB).
- **vCPU:** *"1 vCPU to 1 physical core at scale maximums"* – don't
  overcommit CPU on hosts running nodes near their limits.
- **Latency:** at most **5 ms** between data nodes, and datastore latency
  at most **10 ms**.
- **Extended cluster** maximums (Continuous Availability) are about 10%
  higher than the plain cluster figures, e.g. Medium 149,600 objects.

**Cloud proxies** (collectors) have their own sizes:

| Cloud proxy | vCPU | RAM (GB) | Max objects | Max vCenter adapters per collector |
| --- | --- | --- | --- | --- |
| Small | 2 | 8 | 16,000 | 25 |
| Standard | 4 | 32 | 80,000 | 100 |
| Unified, Small | 4 | 16 | 16,000 | 25 |
| Unified, Standard | 8 | 48 | 80,000 | 100 |

The 9.1 *Add a Cloud Proxy* page sizes the unified proxies by VM count:
Small *"Up to 16,000 VMs"*, Standard *"Between 16,000 to 80,000 VMs"*.

The disk size per node is not in Configuration Maximums. For whole
management-domain sizing (VCF Operations together with vCenter, NSX,
VCF Automation and the rest), see the companion repo's
[Management Domain Sizing & Fit Check](https://vcf-planning.hollebollevsan.nl/docs/04-sizing/).
Its VCF Operations vCPU and RAM figures match the table above.

---

## Does the current size still fit?

Compare the real object and metric counts with the table above.
Configuration Maximums says where to find the metric figure: *"go to the
Cluster Management page in VCF Operations and view the adapter instances
of each node at the bottom of the page … The sum of these metrics is what
is estimated."* (The overall metric count on that page also includes
metrics VCF Operations creates itself, so it reads higher.)

- **Near the per-node limits:** scale up (bigger node) or scale out (more
  data nodes), below.
- **Planning an upgrade:** check this before the
  [Phase 1](13-vcf-upgrade-sequence.md#phase-1--vcf-operations-upgrade)
  window, so the upgrade doesn't land on an already overloaded cluster,
  and run the Sizing Estimator with the counts for the target version.
- **Many vCenters or remote sites:** look at the collectors as well. Each
  size supports a maximum number of vCenter adapters per collector, so
  more cloud proxies may fit better than bigger analytics nodes.

---

## Which scaling option each model supports

From Broadcom's
[VCF Operations Models](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/vmware-cloud-foundation-concepts/vcf-operations.html):

| Model | Nodes | Scale up | Scale out |
| --- | --- | --- | --- |
| **Simple** | 1 | Yes | Yes. *"Can be scaled-out to be highly available."* |
| **High Availability** | Primary, Replica, Data | All nodes | *"with additional data nodes"* |
| **Continuous Availability** | Node pairs across two availability zones, plus a witness | All nodes | With additional data nodes |

---

## Scale up: bigger nodes

From
[Scaling VCF Management Components](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/scale-out-vrealize-suite-products.html):

1. Log in to VCF Operations as a user with the **Administrator** role.
2. **Build → Lifecycle → VCF Management**, select **VCF Operations**.
3. **Actions → Scale**.
4. Select the node size: **XS, Small, Medium, Large, XL**.
5. Optionally, add disk space (GB) to **every** node in the cluster. Use
   **Advanced Datastore Configuration** to choose where the extra disk is
   placed on each node.
6. Review the summary and click **Scale**. Follow it on the **Tasks** tab.

For a **Continuous Availability** cluster, start the scale-up from the
VCF Operations administrator interface **in the primary fault domain**.

> **Downtime:** *"During the process, the nodes are restarted and services
> are not available during the downtime."* Plan a window.

> **Take a new backup afterwards.** *"Rolling back to a backup created
> before scale up will revert the cluster to its earlier size and
> permanently delete data from the node added during scale up."*

The same **Build → Lifecycle → VCF Management → Actions → Scale** flow
also scales VCF Operations for Networks (platform or collector nodes),
Log Management (size and number of replicas), the VCF services runtime
(size, plus extra IPs for the node pool), VCF Automation, Identity Broker
and Real-time Metrics.

---

## Scale out: more nodes

From
[Add Nodes in VCF Operations and VCF Operations for networks](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/scale-up-vrealize-suite-products.html).
For VCF Operations you add **replica** or **data** nodes.

> **Update the certificate first.** The VCF Operations certificate must
> include the FQDN (and IP) of every node you are about to add. *"If you
> do not update the certificate prior to performing the scale-out
> operation, the lifecycle management process will fail."* Regenerate it
> under **Manage → Fleet Management → Certificates → VCF Management**
> (VCF Operations, TLS Certificate): **Generate CSRs** with the new FQDNs
> and IPs in the SAN, have it signed, then **Import Certificates**. If
> nodes were already added without this, follow
> [KB 430384](https://knowledge.broadcom.com/external/article/430384).

1. Create DNS records (forward and reverse, lowercase) for the new node.
2. Log in to VCF Operations as an **Administrator**,
   **Build → Lifecycle → VCF Management**, select **VCF Operations**.
3. **Actions →** the **Node Management** action.
4. Select the node type (**replica** or **data**), enter the new node's
   FQDN, the VCF Operations admin password and a password for the new
   node.
5. Confirm the certificate already covers the new FQDN, then click
   **ADD**.

**Without fleet lifecycle (standalone VVF), use the Admin UI.** KB 430384
states that adding nodes through *Build → Lifecycle → VCF Management →
Components* and through the **VCF Operations Admin UI** are *"equally
valid"*. The Admin UI steps, including turning a Data node into the
Replica for HA, are in
[Walkthrough B, steps 2–3](05-operations-modernization.md#2-add-a-data-node-then-activate-ha-against-it).
The certificate rule applies to both methods.

**Collectors scale out too.** Add a cloud proxy under **Build →
Lifecycle → VCF Management → VCF Operations → Actions → Add cloud proxy**
(FQDN, size, admin password, a password for the proxy, VCF instance).
Then point the integration at it: **Operate → Administration →
Integrations → Accounts → VMware Cloud Foundation** → the VCF instance →
**Edit** → **Cloud Proxy / Group** → **Validate Connection** → **Save**
([Add a Cloud Proxy](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/deploy-the-cloud-proxy.html)).
In the HA model, Broadcom notes cloud proxies are *"expanded to a
collector group manually"*.

---

## Scaling back

There is no scale-down action. Removing a node is a separate procedure
with a data-loss risk outside HA: see
[Removing a node – data loss](05-operations-modernization.md#removing-a-node--data-loss).
Don't confuse HA with Continuous Availability when planning node counts:
see [Continuous Availability vs. plain HA](05-operations-modernization.md#continuous-availability-vs-plain-ha--dont-conflate-them).

---

## Sources

- [VMware Cloud Foundation (VCF) Operations Sizing Guidelines (KB 324340)](https://knowledge.broadcom.com/external/article/324340) – 9.1.x sizing lives in Configuration Maximums.
- VMware Configuration Maximums, VCF Operations 9.1.0 ([configmax.broadcom.com](https://configmax.broadcom.com/)) – node sizes, object and metric limits, latency, cloud proxy sizes.
- [VCF Operations Sizing Estimator](https://vcfopssizer.broadcom.com/) – sizing from your own counts.
- [VCF Operations Models (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/vmware-cloud-foundation-concepts/vcf-operations.html) – which model supports which scaling.
- [Scaling VCF Management Components (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/scale-out-vrealize-suite-products.html) – scale-up procedure, downtime, backup warning.
- [Add Nodes in VCF Operations and VCF Operations for networks (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/scale-up-vrealize-suite-products.html) – scale-out procedure, certificate prerequisite.
- [Add a Cloud Proxy (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/fleet-management/configuring-management-components/using-vcf-management-services-to-perform-day-n-actions/deploy-the-cloud-proxy.html) – collector scale-out.
- [KB 430384](https://knowledge.broadcom.com/external/article/430384) – certificate remediation after adding nodes; Admin UI is an equally valid method.
