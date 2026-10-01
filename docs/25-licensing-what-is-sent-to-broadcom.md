# VCF 9 licensing: what is sent to Broadcom

What leaves the environment when VCF Operations is registered and reports
license usage, how to inspect it yourself, and what connected vs.
disconnected mode change. Applies to **VCF and VVF 9.x**: both are
licensed through VCF Operations, a License Server and the VCF Business
Services console (`vcf.broadcom.com`).

For customers asking *"what data do we send?"*, the short answer from
Broadcom's own documentation is: license IDs and quantities (cores / TiB),
opaque instance IDs and fingerprints, and, since 9.1, **counts** of
vCenters, hosts and clusters. *"The license usage file exclusively contains
this specific information and does not collect personal data or customer
data."*

Avi Load Balancer and vDefend use a separate licensing chain (Avi Cloud
Console and License Hub), not covered here. See
[Avi + License Hub upgrade](09-avi-license-hub-upgrade.md#license-hub).

---

## Two files, two moments

| File | When | Format |
| --- | --- | --- |
| **Registration file** (plus, from 9.1, a **confirmation file**) | Once, when VCF Operations and its License Server(s) are registered | JSON Web Signed (JWS) |
| **Usage file** | Daily (connected) or at least every 180 days (disconnected) | JWS, gzip-compressed |

Broadcom: the information is *"equivalent between connected and
disconnected mode, but sent in different formats"* (registration) and
*"The contents of the usage files are identical in connected and
disconnected mode"* (usage).

---

## Registration file

From
[Registering VCF Operations and a License Server](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/register-vcf-operations.html):

| Property | Since | What it is |
| --- | --- | --- |
| `model_version` | 9.0 | File format version, always `1.0.0` |
| `product_version` | 9.1 | VCF Operations version |
| `asset_name` | 9.0 | The **FQDN** of VCF Operations, pre-filled as the display name in the console. Broadcom only keeps it if you leave the display name equal to the FQDN |
| `created_on` | 9.0 | Creation date and time |
| `asset_type` | 9.0 | Always `AC` |
| `xr2` | 9.0 | *"A unique opaque fingerprint"* of the instance. *"No identifiable details about your environment can be derived from the fingerprint"* |
| `asset_id` | 9.0 | Unique ID of the VCF Operations instance |
| `request_id` | 9.0 | Unique ID of this file |
| `child_assets` | 9.1 | The License Server(s): ID, **hostname** (same display-name rule as above), type `LS`, version |

**Since 9.1 a confirmation file is also required.** It lists every License
Server with its ID, version, **public key**, an opaque fingerprint, a
challenge code and a timestamp. *"The file is valid for 3 hours after it is
generated."*

**Keeping the FQDN and hostname out.** Broadcom documents a setting to stop
VCF Operations using its FQDN and the License Server hostname as the asset
name. Run it **before** registering:

```
PUT {VCF_Ops_URI}/suite-api/api/deployment/config/globalsettings/GENERATE_DEFAULT_LICENSE_MANAGER_ASSET_NAME/false
```

> **Untested:** quoted from the TechDocs page; not run in this repo's labs.

You can only see the registration file's contents in disconnected mode
(connected mode sends the same details as API parameters). Save a copy
before completing registration and paste it into a JWT decoder.

---

## Usage file

From
[Updating Licenses and Viewing the License Usage File](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses.html).

**Per report:**

| Property | Since | What it is |
| --- | --- | --- |
| `usage_report_generated_time`, `usage_report_id` | 9.0 | When the report was generated, and its ID |
| `asset_id`, `asset_status`, `xr2` | 9.0 | Instance ID, status (`Active`) and opaque fingerprint |
| `jws_child_asset_usages` | 9.1 | One encoded usage report per License Server |
| `acknowledged_claims` | 9.1 | Reserved licenses; `NULL` if there are none |
| `key_rotation_details` | 9.1 | Public key rotation |
| `unassigned_licenses` | 9.0 | Licenses added to VCF Operations but not used |
| `license_usage_anomaly_details` | 9.0 | Corrupted usage data (e.g. a corrupt database or software update) |

**Per license and usage period:**

| Property | Since | What it is |
| --- | --- | --- |
| `product_name`, `product_version` | 9.0 | Product; version `9.0` for 9.x licenses, `1.0` for a pre-9 key |
| `Allocation_id` / `license_key_id` | 9.0 | License ID (9.x) or license key (pre-9) |
| `usage_start_time`, `usage_end_time`, `granularity` | 9.0 | The usage period; granularity is always minutes |
| `uom`, `quantity` | 9.0 | Unit (**core** or **TiB**) and usage in the period |
| `total_quantity` | 9.0 | License capacity, pre-9 licenses only |
| `pre_v9_quantity` | 9.1 | Usage of a 9.x license by pre-9 hosts |

**Reclaimed and reused capacity (9.1):**

| Property | What it is |
| --- | --- |
| `manually_freed_capacity.total_freed_capacity` | Capacity reclaimed by hand from the License Server, and for which license |
| `recycled_events.event_type`, `recycled_events.asset_type` | How capacity was reclaimed and reused, and for which asset type (e.g. host) |
| `recycled_events.RecycleStats.assets_recycled` | How many assets were relicensed after their license was reclaimed |
| `recycled_events.RecycleStats.max_recycle_frequency`, `recycled_events.avg_recycle_frequency` | The highest and average frequency of that relicensing |

**Object counts (`additional_data`, 9.1):** *"Additional records include the
count of objects instead of just aggregate core and TiB counts."*

| Property | What it is |
| --- | --- |
| `id` | VCF Operations instance ID |
| `vcenters`, `vc_guid`, `vc_version` | Each vCenter's GUID and version |
| `host_info.total` | Number of ESX hosts per vCenter |
| `host_versions.version`, `host_versions.total_count` | ESX versions, and how many hosts run each |
| `cluster_info.total` | Number of clusters |
| `cluster_info.vks_clusters` | Number of VKS clusters |
| `cluster_info.vsan_enabled_clusters`, `cluster_info.vsan_data_stores` | vSAN-enabled clusters and vSAN datastores |

**What this means in a customer conversation:** no hostnames, IP
addresses, VM names or user data are in the usage file. Since 9.1 it
does describe the **shape** of the environment: how many vCenters (by
GUID) and hosts, which ESX versions, and how many clusters, VKS clusters
and vSAN datastores. The registration file can contain the VCF Operations
FQDN and License Server hostname, unless you change the display name or
use the setting above.

---

## Inspect it yourself

- **Readable usage file:** VCF Operations → **Licensing → Registration →
  File History**, download a file and open it.
- **Raw usage file:** **Licensing → Registration → Generate Usage File**,
  decompress it with any gzip tool, open it in a text editor, and paste
  the content into a JWT decoder.
- **Registration file:** only in disconnected mode. Keep a copy before
  completing registration and decode it the same way.

---

## Connected vs. disconnected

| | Connected (Broadcom's recommendation) | Disconnected |
| --- | --- | --- |
| Registration | Activation code | Upload the registration file (and, since 9.1, the confirmation file) to the console |
| Usage reporting | *"submitted automatically on a daily basis"* | Generate the usage file and upload it by hand, **at least every 180 days** |
| License updates | Automated mode: *"once every 24 hours and after each change"*. Manual mode: click **Update Licenses** | Download the license file from the console and **Import License File** |
| Internet access | Needed from VCF Operations | Not from the data centre. An administrator's browser reaches `vcf.broadcom.com` |
| Content sent | Same | Same |

**Disconnected, step by step**
([procedure](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses/update-licenses-in-disconnected-mode.html)):

1. VCF Operations → **Manage → Licensing → Licenses & Registration →
   Generate Usage File**.
2. VCF Business Services console → **Licensing → VCF Operations
   Registrations** → the instance → **Actions → Upload Usage File**.
3. **Download** the generated license file.
4. VCF Operations → **Licenses & Registration → Manage Registration
   Details → Import License File**.

Broadcom's advice: *"always submit a usage file before you download a new
license file."*

**Switching modes** is possible at any time, in either direction. But
after **more than 180 days** in disconnected mode, switching to connected
*"might fail, and you must generate a new activation code"*.

---

## What happens if usage isn't reported, or licenses lapse

### Timeline

From the
[Licensing Overview](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview.html):

| When | What happens |
| --- | --- |
| Every day (connected) / at least every 180 days (disconnected) | Usage is reported and licenses are updated. Each update restarts the 180-day clock |
| Before the 180 days run out | Notifications appear |
| Day 180 without a report and update | The license **expires** (it also expires when the last contributing subscription ends) |
| The 90 days after expiry | *"You have 90 days to update your license."* License assignments are affected and notifications appear in most components, including VCF Operations and vCenter. Workloads keep running |
| More than 90 days after expiry | The full impact below. *"Existing workloads are not proactively stopped."* |

In disconnected mode, that means roughly **270 days** from the last
successful exchange until hosts disconnect. Treat the 90 days as a safety
net, not a plan: put the 180-day exchange in the operations calendar with
a margin.

### What stops and what keeps running

After the grace period (and when a vCenter or ESX evaluation period ends
without a license), from the
[Licensing Overview](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview.html)
and
[KB 391605](https://knowledge.broadcom.com/external/article/391605)
(*Impact of vCenter/ESXi license expiration*):

| Keeps working | Stops or is blocked |
| --- | --- |
| **Running VMs** *"will continue uninterrupted"* | **Powering on** any powered-off VM, *"whether they were shut down before or after license expiry"* |
| Direct access to the ESX **Host Client** via the host's IP | **ESX hosts disconnect** from vCenter; host and VM management in the vSphere Client is impaired (configuration changes, resource adjustments) |
| **Creating** new VMs | **Powering on** those new VMs fails |
| **Removing** a host from vCenter | **Adding** hosts to an expired vCenter fails |
| | Management operations of other components *"might be prevented"* |

So the risk is not an immediate outage. It's that **anything that stops
can't be started again**: a host crash with vSphere HA trying to restart
its VMs, a VM shut down for maintenance, a patch reboot. The longer an
environment sits past the grace period, the more of its workload ends up
off and unstartable.

**Scope** (from the
[Licensing Model](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview/licensing-model.html)
page):
- If a **vCenter** is expired, *"all hosts added to the vCenter instance
  are disconnected from it."*
- If only an **ESX host** is expired and the vCenter is licensed, *"only
  the ESX host with an expired evaluation period is disconnected."*

KB 391605 is Broadcom's general vCenter / ESX expiry KB, not
version-specific. Its behaviour matches the 9.1 Licensing Overview.

### Upgrades from 8.x start in evaluation mode

Per the Licensing Model page, evaluation mode *"applies to new
deployments and upgrades from version 8.x to version 9.1"*. Each ESX host
(from first boot), vCenter and VCF Operations instance runs up to **90
days** in evaluation until a 9.x license is assigned. Hosts added without
free license capacity also stay in evaluation, counted from install, not
from when they were added. Stateless Auto Deploy hosts get no evaluation
period at all.

> **Don't let the fleet's evaluation run out.** *"If you fail to license
> your VCF fleet before the evaluation period expires, you must reinstall
> the software because you cannot license a fleet with an expired
> evaluation period."* License VCF Operations, vCenter and the hosts as
> part of the upgrade, not afterwards.

Individual components can still be recovered after their evaluation ends:
register VCF Operations and add a license; assign a license to the
vCenter from VCF Operations; or add the host to a licensed vCenter with
free capacity.

### When VCF Operations or the License Server is down

From
[License Server Downtime Impact](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/license-server-overview/license-server-downtime-impact.html)
and [KB 443240](https://knowledge.broadcom.com/external/article/443240):

- **No immediate impact** on running workloads or management operations
  in a fully licensed environment. Existing entitlements on vCenter stay
  active.
- **Blocked:** assigning licenses, capacity updates, generating usage
  reports (including the daily connected-mode report) and importing
  license files. New vCenters, hosts and vSAN clusters can be added, but
  only in evaluation mode.
- **The outage counts against the clock.** No usage reports can be
  generated while it lasts, so *"After the 180-day update period, the
  licenses expire."* An environment already in evaluation can also run
  out its 90 days.
- **Warnings to watch for:** the vSphere Client banner *"One or more vCenter
  instances are not connected to a license server"*, and VCF Operations
  sync errors *"Licenses could not be synchronized with the vCenter
  systems."*

The TechDocs page says the License Server *"does not need to be always
online"* and recommends vSphere HA on its cluster. KB 443240 is stricter:
it *"should remain powered on at all times"*. Plan for the KB, and alert on
the vCenter banner.

### Recovery

*"You can recover expired environments by downloading an updated license
file"*: an update in connected mode, or the usage-file exchange in
disconnected mode. Expired evaluation periods are recovered per component
as described above, except for a never-licensed fleet.

---

## Sources

- [Registering VCF Operations and a License Server with the VCF Business Services Console (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/register-vcf-operations.html) – registration and confirmation file contents, the FQDN setting.
- [Updating Licenses and Viewing the License Usage File (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses.html) – usage file contents, how to view it.
- [Update Licenses in Connected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses/updatelicenses.html) – daily submission, automated vs. manual updates.
- [Report License Usage and Update Licenses in Disconnected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses/update-licenses-in-disconnected-mode.html) – the manual exchange.
- [Switch from Disconnected to Connected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/switch-from-disconnected-to-connected-mode.html) – the 180-day activation-code caveat.
- [Licensing Overview (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview.html) – 180-day reporting, expiry and the 90-day grace.
- [Licensing Model (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview/licensing-model.html) – evaluation mode (including 8.x upgrades), vCenter vs. host expiry scope, reinstall if the fleet's evaluation expires.
- [KB 391605](https://knowledge.broadcom.com/external/article/391605) – what stops and what keeps running when a vCenter or ESX license expires.
- [License Server Downtime Impact (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/license-server-overview/license-server-downtime-impact.html) and [KB 443240](https://knowledge.broadcom.com/external/article/443240) – License Server / VCF Operations outages.
- Christopher Kusek, [What's inside a VCF 9 license file](https://www.linkedin.com/pulse/whats-inside-vcf-9-license-file-understanding-connected-kusek-95gfc/) (June 2025, VCF 9.0) – community walkthrough of decoding the registration file.
