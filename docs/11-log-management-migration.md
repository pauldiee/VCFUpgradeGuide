# Log Management migration (Post-Infrastructure Products)

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
expanding on its [Conditional phases table's Log Management
row](13-vcf-upgrade-sequence.md#conditional-phases-optional-components).

**Position: after NSX finalize**, inside the post-infrastructure /
operations products run – **after Operations for Networks, before the
Identity Broker migration**. Applies whenever **VCF Operations for Logs**
(Aria Operations for Logs / vRLI) is in use.

Log Management is now a component of **VCF Management Services**
([Phase 3](13-vcf-upgrade-sequence.md#phase-3--deploy-vcf-management-services--license-server))
and is deployed from **VCF Operations**, not upgraded in place.

---

## Path depends on the running version

- **From 9.0.x:** VCF Operations runs an upgrade operation that deploys
  Log Management 9.1 and *transfers the configuration* from the 9.0.x
  Operations for Logs instance. Agents and log sources are re-pointed
  automatically.
- **From 8.x (VCF 5.x source):** no direct path. Deploy 9.1 fresh, then
  migrate configuration by hand and re-point every agent / log source.

---

## What does not carry automatically

- **Custom dashboards, alerts and saved queries** are **not** transferred –
  convert them with the Content Pack → Management Pack tool.
- **Log forwarders are copied but left inactive** – activate each one by
  hand after cut-over.
- **Integrations** (SIEM, webhook, ticketing) are re-pointed manually.

---

## Historical log data

Three options: the transfer utility, an archived data import, or simply
query the legacy cluster for **up to 90 days** post-upgrade while it runs
in parallel for retention.

---

## Networking

The new Log Management **must sit on the management network that hosts
VCF Management Services**. It **cannot be upgraded / migrated if it is on
a custom NSX overlay network** – move it to the management network first.
Its FQDN must resolve *outside* the IP range assigned to VCF Management
Services. Prepare a **new FQDN** for the 9.1 instance (the old one stays
with the legacy appliance during parallel run). The clustered form has its
own integrated load balancer ("Cluster VIP"); size per the current
deployment guide.

**Log-data transfer needs the split-proxy Cloud Proxy.** Moving log data
off the old appliance goes through a **Universal Cloud Proxy in
split-proxy mode** – without it the Control Panel transfer fails with
"Transfer failed due to an error" (see
[Phase 1](13-vcf-upgrade-sequence.md#phase-1--vcf-operations-upgrade) and
[Field notes](04-field-notes.md#observability--cloud-proxy-logs-networks)).

**Newly added vCenters are not auto-collected** – activate their log
collectors by hand in the VCF Operations UI.

---

## Decommission

Once post-upgrade configuration is done and ingestion is confirmed on 9.1,
**shut down and remove the legacy Operations for Logs appliances**.
Repoint or retire anything still aimed at the old FQDN.

---

## Before moving on

- Ingestion flowing from every source on the 9.1 instance.
- Forwarders active.
- Alerts firing.
- Custom content converted and present.
- Legacy appliances powered off.

---

## Sources

- [Upgrade to Log Management 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-operations-for-logs.html)
- [Deploy Log Management](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-of-components-to-complete-your-vcf-platform/installing-vcf-logs.html)
  (fresh deploy)
