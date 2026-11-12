# Log Insight to Log Management 9.1: what moves, and how

A component-by-component companion to
[Log Management migration](11-log-management-migration.md), for the case
where the source is **Log Insight**, also known as Aria Operations for Logs
8.x. Docs/11 says *when* in the upgrade this happens. This page says how each
part of the old instance gets to VCF Operations 9.1 with Log Management,
and which parts Broadcom doesn't document at all.

Everything below comes from TechDocs for VCF 9.1, read word for word on
2026-11-12. Broadcom's post-migration steps name **8.18** as the source
version. The deploy wizard itself says "8.x". Where a page is silent, this
page says so instead of guessing.

---

## The short version

There's no in-place upgrade: *"No direct upgrade path for VMware Aria
Operations for Logs 8.x to log management 9.1 exists"*. You deploy Log
Management 9.1 from VCF Operations next to the old cluster and move things
over along five routes:

![Log Insight to Log Management 9.1: eleven parts of a Log Insight instance, each with its route and where it ends up in VCF Operations 9.1. A, import at deploy: forwarding rules (copied but inactive) and the link to the old cluster (queryable for 90 days). D, log data tools: Logs Data Transfer for up to 90 days of logs, archive import from NFS. B, content pack to management pack: custom alerts, dashboards, third-party content packs, and saved queries and extracted fields (result not documented). C, re-point by hand: agents, log sources and upstream forwarders. E, not documented: users, roles, AD and data sets are recreated in VCF Operations Access Control.](images/log-insight-migration/routes.png)

| Route | What it is | Covers |
| --- | --- | --- |
| **A** Import at deploy | A checkbox in the Log Management deploy wizard | Forwarding rules; the link to the old cluster |
| **B** Content pack to management pack | Export from Log Insight, convert with Broadcom's converter, install the `.pak` in VCF Operations | Alerts, dashboards, other custom and third-party content |
| **C** Re-point by hand | Change the target on each sender | Agents, log sources, forwarders that send to Log Insight |
| **D** Log data tools | Query, copy or re-import old log data | Logs on the old cluster, archives |
| **E** Not documented | Rebuild it in VCF Operations | Users, roles, authentication, data sets, notifications |

---

## Per component

| In Log Insight 8.x | Route | What you do | Ends up as |
| --- | --- | --- | --- |
| Configuration as a whole | A | Tick **Import configuration from an earlier Operations for logs instance** and give the old FQDN, admin user and password (*"Select to migrate a VMware Aria Operations for Logs 8.x configuration"*) | An **Upgrade report** on the deploy task: download it and read what came over |
| Forwarding rules | A | Activate each one: *"forwarders are copied over but are not active. You must manually activate them"* | Log Forwarding (maximum of 10 rules) |
| Logs still on the old cluster | A | Connect the old cluster during the deploy: *"as part of the upgrade workflow, and not later on"* | A legacy partition on the Logs page, queryable for **90 days**. After that *"these legacy partitions will no longer be available for searching"* |
| Up to 90 days of logs, copied | D | Operate → Administration → Control Panel → **Logs Data Transfer** → Initiate Transfer | Logs in the Log Management store |
| Archived logs | D | Archive import with operation type **legacy import**: *"Legacy Import supports only NFS storage"* | An import partition. *"only one imported log archive can be active for querying at a time"* |
| Custom alerts | B | Content Packs → My Content → Export, convert, install ([steps below](#route-b-custom-content)) | Operate → Configuration → Alert Definitions |
| Custom dashboards | B | Same content pack | Dashboards in the management pack: *"you can see the dashboards, alerts, and symptom definitions that originated from the original content pack"* |
| Saved queries, extracted fields | B | Include them in the content pack. For alerts, select them *"along with their associated extracted fields"* | **Not documented.** Broadcom names *"dashboards, queries, alerts"* as custom content that goes this way, but lists only dashboards, alerts and symptom definitions in the result. Check after install. 9.1 has its own Fields Library with export/import between VCF Operations instances |
| Third-party content packs | B | Run the converter on the pack file | A *"content-only management pack"* (no metrics) |
| VMware content packs | – | Nothing to move: *"Content packs have been deprecated in VCF Operations 9.1 and they have been replaced with the content integrated into management packs"* ([KB 443089](https://knowledge.broadcom.com/external/article/443089)) | Built-in management pack content |
| Agents | C | Re-point to the new FQDN. From 8.18 this is manual; the old cluster keeps collecting until you do | Log Collection. Agent authentication needs *"agent version 9.1 or higher"* |
| Log sources (vCenter, ESX, NSX and so on) | C | *"Reconfigure required log sources to point to your new instance"* | Log Collection |
| Forwarders that send *to* Log Insight | C | *"you must reconfigure the log forwarder to send logs to the new 9.1 log management component FQDN"* | Log Management ingestion |
| Users, roles, AD / VIDM login | E | **Not documented** for a Log Insight import. Recreate them in VCF Operations | Log access is *"converged into the VCF Operations role based access control"*: Access Control → Roles, Scopes |
| Data sets | E | **Not documented.** Recreate them as a Log Data Set in a Scope | Access Control → Scopes → *Assign Log Data Set* |
| Index partitions, retention | E | **Not documented.** Recreate them as log partitions | Administration → Configurations → Log Processing → **Log Partition** |
| Archiving to NFS | E | **Not documented.** Set archiving on each log partition (NFS or S3) | Log Partition → *Enable Archive* |
| Alert notifications (email, webhook) | E | **Not documented** for a Log Insight import. Log-based alerts are now VCF Operations alerts, so they use VCF Operations notifications | VCF Operations alert notifications |
| Integration with Aria Operations | – | Gone: *"VCF does not permit integration of VCF Operations with Aria Operations for Logs"* | Logs live inside VCF Operations |

Anything marked "not documented" may still come across with the import.
The import report is the place to check, item by item, before you rebuild
anything.

---

## Order of work

1. **Prepare.**
   - A **new FQDN** for Log Management. It must be lowercase and must not
     point at a VCF services-runtime IP. Put it on the management network
     that hosts VCF Management Services: Log Management *"cannot deployed
     on a custom NSX overlay network"*.
   - Firewall: the import talks to the old cluster on 9543/TCP (see
     [firewall flows in the deployment-planning guide](https://vcf-planning.hollebollevsan.nl/docs/31-log-management/)).
     The data transfer needs SSH, see step 6.
2. **Deploy with import (A).** VCF Operations → Build → Lifecycle → VCF
   Management → Components → Add component → Log management. Tick the
   import, give the old instance's FQDN and admin credentials, and keep
   the link to the old cluster. You can't add it later.
3. **Read the upgrade report.** Tasks → the Log Management task → Upgrade
   report. This tells you which of the "not documented" rows above you
   still have to rebuild.
4. **Export custom content while the old cluster is still there (B).**
   Do this before you power anything off: once the old cluster is gone,
   there's nothing to export from.
5. **Re-point collection (C).** Agents, log sources, and anything that
   forwards into Log Insight. Then activate the copied forwarding rules (A).
6. **Move the log data you need (D), within 90 days.**
   - **Logs Data Transfer** copies up to 90 days. *"All source nodes of
     the Aria Operations for Logs instance must have the same SSH
     credentials as each other, and be reachable via port 22 from the Log
     Management nodes"*. Not all buckets are copied without enough free
     disk space, so check that first. Broadcom suggests starting with the
     last 10 days. The transfer also needs the Cloud Proxy in split-proxy
     mode; see the [field note in docs/11](11-log-management-migration.md#networking).
   - **Archives:** use legacy import, NFS only, a small time range at a
     time. *"if the import logs fill the storage more than 80%, the task
     fails"*.
7. **Rebuild what didn't come over (E).** Roles, scopes and data sets,
   partitions and archiving, notifications.
8. **Decommission.** After the post-migration steps, *"you can shut down
   and remove the legacy appliances"*. The 90-day query window closes on
   its own either way.

---

## Route B: custom content

From
[*Converting Custom Log Alerts to Management Packs*](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/converting-custom-log-alerts-to-management-packs.html)
and
[*Converting Content Packs to Management Packs*](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/converting-content-packs-to-management-packs.html):

1. **Export** from Log Insight. Go to Content Packs → **My Content** →
   gear icon → **Export**. Select the alerts, dashboards and queries, plus
   the extracted fields they use. You can make one pack for everything or
   several smaller ones.
2. **Get the converter** from the Broadcom Support Portal, under Drivers
   and Tools, in the log management section. Use
   `cp-to-mp-convertor-jar-with-dependencies-jdk17.jar` for Java 17 to 24,
   or `...-jdk25.jar` for Java 25 and later. Download the README too.
3. **Convert** on a workstation with Java:

   ```
   java -jar cp-to-mp-convertor-jar-with-dependencies-jdk17.jar -i <content-pack-file> -o <output-directory>
   java -jar cp-to-mp-convertor-jar-with-dependencies-jdk17.jar -f <directory-with-packs> -o <output-directory>
   ```

   The first converts one pack, the second all packs in a directory. Each
   pack gets its own output folder with a `.pak`.
4. **Allow unsigned PAKs.** In the VCF Operations admin UI
   (`https://<vcf-ops-fqdn>/admin`), go to Administrator Settings →
   Security Settings → **ENABLE UNSIGNED PAK INSTALLATION**. Broadcom calls
   this *"a temporary modification of the security posture"* but doesn't
   give the step to switch it back. Turn it off yourself after the last
   install.
5. **Install** the `.pak` from Software Install → Install Software Update,
   with **Ignore the PAK File Signature Checking** ticked.
6. **Check** under Operate → Configuration → **Alert Definitions** (alerts)
   and the management pack's content tab (dashboards, symptom
   definitions). Then look for your saved queries and extracted fields,
   which the pages don't cover.

---

## Gotchas

- **The old link can't be added afterwards.** Connecting the old cluster
  for 90-day queries only works during the deploy.
- **90 days is a hard edge.** The legacy partition disappears after 90
  days. The data transfer also covers at most 90 days. Older data only
  survives through archives.
- **Data transfer re-imports in full.** *"Data for any selected interval
  is fully re-imported. Check the audit record to avoid redundant
  transfers."*
- **Agent authentication is new and optional.** By default the server
  accepts both authenticated and unauthenticated logs. Enforcing
  authentication needs 9.1 agents. Syslog stays unauthenticated, and
  Windows agents aren't supported. Unauthenticated ingestion stays accepted
  until you enforce it. Whether an 8.x agent works against Log Management
  at all isn't stated; Broadcom only says to re-point the agents.
- **Scopes don't limit logs.** *"Object Scopes and Log Data Sets are
  independent"*. Giving a user Cluster A doesn't limit their logs to
  Cluster A; only the Log Data Set does.

---

## Sources

TechDocs for VCF 9.1, all read word for word on 2026-11-12:

- [Deploy Log Management](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/deploying-a-new-vmware-cloud-foundation-or-vmware-vsphere-foundation-private-cloud-/manual-deployment-of-components-to-complete-your-vcf-platform/installing-vcf-logs.html):
  import option, upgrade report, post-deployment actions
- [Upgrade to Log Management 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/upgrade-vcf-operations-for-logs.html):
  no direct 8.x path, overlay restriction
- [Log Data Transfer](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/deploy-and-upgrade-log-management/log-data-transfer.html)
- [Log Partitions and Searching Older Partitions](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/deploy-and-upgrade-log-management/federated-queries.html)
  and [Configuring Log Partitions](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/deploy-and-upgrade-log-management/configure-log-partitions.html)
- [Archive Log Import](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/configuring-log-import-and-export-tasks/archive-log-import.html)
- [Configuring Log Forwarding](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/configuring-log-forwarding.html)
- [Agent Authentication for Log Ingestion](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/overview-of-log-management-agents/agent-authentication-for-log-ingestion.html)
- [User Management and Role-Based Access Control](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/log-administration/user-management-and-role-based-access-control.html)
- [Query Management](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/using-the-explore-logs-chart-to-analyze-logs/chart-types/the-analyze-page/query-management.html):
  Fields Library
- [Converting Content Packs to Management Packs](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/converting-content-packs-to-management-packs.html)
  and [Converting Custom Log Alerts to Management Packs](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/infrastructure-operations/log-analysis/converting-custom-log-alerts-to-management-packs.html)
- [KB 441532](https://knowledge.broadcom.com/external/article/441532/alerts-from-vcf-operations-for-logs-90x.html):
  alerts not transferred from 9.0.x (same route)
- [KB 443089](https://knowledge.broadcom.com/external/article/443089):
  content packs deprecated in 9.1
