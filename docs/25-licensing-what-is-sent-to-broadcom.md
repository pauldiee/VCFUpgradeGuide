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

## What happens if usage isn't reported

From the
[Licensing Overview](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview.html):

1. **Usage must be reported, and licenses updated, at least every 180
   days.** If not, the license **expires**. Notifications appear
   beforehand.
2. **After expiry there are 90 days** to update the license. License
   assignments are affected, and notifications appear in most components,
   including VCF Operations and vCenter.
3. **90 days after expiry:** management operations may be blocked, *"ESX
   hosts disconnect from vCenter"*, and *"You cannot start workloads.
   Existing workloads are not proactively stopped."*
4. **Recovery:** download an updated license file.

So in disconnected mode, put the 180-day exchange in the operations
calendar with a margin. The 90-day grace is a safety net, not a plan.

---

## Sources

- [Registering VCF Operations and a License Server with the VCF Business Services Console (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/register-vcf-operations.html) – registration and confirmation file contents, the FQDN setting.
- [Updating Licenses and Viewing the License Usage File (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses.html) – usage file contents, how to view it.
- [Update Licenses in Connected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses/updatelicenses.html) – daily submission, automated vs. manual updates.
- [Report License Usage and Update Licenses in Disconnected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/update-licenses/update-licenses-in-disconnected-mode.html) – the manual exchange.
- [Switch from Disconnected to Connected Mode (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/switch-from-disconnected-to-connected-mode.html) – the 180-day activation-code caveat.
- [Licensing Overview (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/licensing/licensing-overview.html) – 180-day reporting, expiry and the 90-day grace.
- Christopher Kusek, [What's inside a VCF 9 license file](https://www.linkedin.com/pulse/whats-inside-vcf-9-license-file-understanding-connected-kusek-95gfc/) (June 2025, VCF 9.0) – community walkthrough of decoding the registration file.
