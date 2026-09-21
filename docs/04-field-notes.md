# Field notes: known issues and gotchas

Symptom → cause → fix, collected from real VCF upgrades. A companion to the
[Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) – that doc gives the
sequence; this doc is the list of things that went wrong and how they were
cleared.

> **Scope.** These were observed on a **VCF 5.2.2 → 9.0.2** multi-domain
> upgrade (management domain, several workload clusters, a new VKS workload
> domain, the full VCF Operations / Logs / Networks / Automation / Identity
> Broker stack). Most apply to any 5.2 → 9.x upgrade. **KB numbers and
> component versions are 9.0.x-era – re-check them for your target build.**

---

## Entitlement and the depot download token

- **403 Forbidden downloading the SDDC Manager 9 bundle.** The customer's
  Broadcom account lacked the entitlement. Broadcom's Customer Sales team
  fixes it on the account; a personal Broadcom account is a stopgap for the
  first download.
- **The depot token lives in three places and drifts.** SDDC Manager, Fleet
  Manager, and vCenter's Lifecycle Manager each hold a download token. After
  the vCenter 9 upgrade the **vCenter LCM token can silently stop matching**
  the one SDDC Manager and Fleet Manager use – depot sync keeps working
  everywhere except vCenter, and **ESXi images disappear from the vCenter
  depot**. A vUM database reset does not fix it. Correct the token in
  vCenter's Lifecycle Manager settings.

---

## VCF Operations upgrade and the "back in time" trap

- **"Back in time" upgrade.** A component patch **released *after* a target
  VCF build cannot upgrade *to* that build** – the version graph treats it as
  going backwards, and it is explicitly unsupported. Example: Aria Operations
  8.18.5 shipped after VCF 9.0 and 9.0.1, so 8.18.5 → 9.0.0 / 9.0.1 was
  blocked and the only path was to wait for 9.0.2. This is the same trap the
  overview's [source-patch-level note](01-overview.md#confirm-a-supported-upgrade-path)
  describes – always check the interop matrix from the *exact* running patch.
- **A vRSLCM-managed product can only be upgraded through vRSLCM.** Not
  outside it, not by removing and re-adding the product, not by downgrading
  to an older patch. If vRSLCM does not offer the target, the target is not
  reachable yet.
- **vIDM patch ordering matters.** Applying the older security patch before
  the newer one broke the Identity Manager cluster and forced a
  restore-from-backup. Apply the current CSP patch **directly** (alongside
  the required vRSLCM patch), not in sequence with superseded ones. Take a
  backup first.
- **Operations for Logs has no upgrade path** – a fresh 9.x deployment, then
  migrate the configuration and (optionally) the log data; the old appliance
  can run in parallel for retention. Point log agents at the new server.
- **APUAT against an offline cluster silently under-reports.** Running the
  Pre-Upgrade Readiness Assessment Tool while the cluster was offline
  produced an empty **Removed/Disconnected Metrics** tab in the report –
  it looked like a clean "nothing affected" result rather than a failure.
  Re-running the same PAK with the cluster online populated the tab with
  the actual metric impacts. Always run APUAT against the online cluster –
  see [APUAT procedure](05-operations-modernization.md#pre-upgrade-readiness-assessment-tool-apuat).

---

## Fleet Manager / Fleet LCM migration – the layered failure chain

The migration from the vRSLCM-managed model to the Fleet Manager model can
stall at **stage 17 ("Migrate VCF Ops to Management Node")**. It is a stack
of independent problems, each masking the next:

1. **Port 443 blocked** between Fleet Manager and the management vCenter node.
   Open it.
2. **vCenter rejects TLS 1.3.** Error `LCMMANAGEMENTNODEVCFOPS12005`
   ("failed pushing VCF Ops certificate to management node"); vCenter's
   `rhttproxy` log shows the cipher mismatch. Change the vCenter TLS profile
   from its restrictive default to **`COMPATIBLE-NON-FIPS`**.
3. **Incomplete certificate chain.** The VCF Operations certificate must
   include the **IP addresses of all cluster nodes**. Regenerate it (CertGen /
   Lifecycle Manager) to embed every node IP, and authorize the VCF
   Operations Fleet Management API.
4. **Inverted `is_admin_node` flag** in the VCF Operations CASA database –
   the real primary node has it `false`, a non-primary has it `true`. LCM
   cannot find the master and loops, pushing proxy details to a null address
   (`VropsAddressException: Invalid Operations master address`,
   `NullPointerException at VropsEndpoint.getVcfOpsProxy`). This predates
   every migration attempt, so no amount of network or certificate work
   helps. Correct the flag in the CASA DB (primary → `true`, replica →
   `false`) with the cluster offline and snapshots taken; apply the cached
   roles fix (KB 368959).
5. **If the LCM-driven migration still fails**, abandon it: de-register VCF
   Operations from the vRSLCM environment, register Fleet Management against
   VCF Operations, and **import VCF Operations into Fleet Manager manually**.

Side effects seen during the loop: the VCF Operations admin account locks
itself out repeatedly (SDDC Manager hammering a connectivity retry loop);
Fleet Manager UI must be enabled (`touch /var/lib/vrlcm/UI_ENABLED`); the
integration procedure is KB 417122; a stale CASA service user can be removed
with a `DELETE …/casa/auth/users` call.

---

## SDDC Manager

- **502 Bad Gateway after a clean upgrade.** Services all report healthy but
  the UI 502s. The **VDT tool** identifies a **corrupted `/etc/hosts`**;
  KB 412614 rebuilds it.

---

## NSX and vCenter

- **Promote Manager-mode objects to Policy mode first.** A mandatory NSX
  upgrade prerequisite (KB 385606) – any objects still in Manager mode block
  the upgrade.
- **Integrated Windows Authentication is gone in vCenter 9.** The Active
  Directory domain join must be dissolved before the upgrade can proceed –
  unjoin gracefully per KB 373004.
- **The installer-UI vCenter upgrade path is deprecated** – drive it from
  SDDC Manager / VCF Operations Fleet Management.
- After the vCenter 9 upgrade, re-check the vCenter LCM **depot token** (see
  above).
- **vCenter's outbound proxy config file changed and is not backward
  compatible.** 8.0.x uses `/etc/sysconfig/proxy`; 9.x uses
  `/var/lib/vmware-envoy-system-proxy/config.json` instead, and Broadcom
  explicitly warns not to touch the old file on 9.x. The 9.x VAMI UI's
  proxy validation is also broken (fails validating through the proxy
  itself) and rejects CIDR exclusions outright – the JSON file is the only
  reliable path on 9.x. Full procedure for both versions: [vCenter proxy
  configuration](16-vcenter-proxy-configuration.md).
- **GUI installer "invalid SSO credentials" despite a correct password.**
  Seen on a manual, non-fleet-managed vCenter upgrade. Confirmed cause: a
  **customized SSO domain suffix** typed incorrectly – reachability, the
  cert thumbprint, root, and the SSO password were all independently
  correct, and there was no clock skew. Full troubleshooting sequence (six
  other failure modes with the identical error text) in
  [manual GUI upgrade – Troubleshooting](07-vcenter-manual-upgrade.md#troubleshooting-invalid-single-sign-on-credentials-at-step-3).

---

## ESX / cluster upgrades

Expect every cluster to behave differently.

- **Sub-NUMA Clustering can PSOD a host during a firmware update.** A serial
  console dump identifies it. A disable → re-enable cycle of the BIOS setting
  lets the ESXi 9 install complete.
- **NSX presence locks all hosts** during the vLCM baseline → image
  transition. A **rolling reboot** clears the locks, then the transition
  succeeds.
- **Scripted VMware Tools block the vLCM baseline → image transition** –
  remove them first.
- **HBA / hardware failures happen during firmware upgrades.** Keep the
  server vendor engaged in parallel with Broadcom; an on-site part swap plus
  a cluster-wide firmware resync may be needed.
- Firmware updates are the slowest and most failure-prone part of the whole
  project – budget accordingly.

---

## vSphere Supervisor

- **Workload Management / Tanzu clusters gate the target release on the
  running Kubernetes version** – older K8s may need a specific upgrade
  sequence (KB 92227). Check this before scheduling.
- **NSX cannot feature-finalize to v9 until the Supervisors are on a
  compatible version.** A bridging Supervisor upgrade is required first
  (pattern: `1.30.10-vsc0.1.12` → `1.30.10-vsc9.0.2`), then NSX finalize
  completes. See also [vSphere Supervisor in detail](13-vcf-upgrade-sequence.md#vsphere-supervisor-in-detail).
- A `vmware-system-csi` pod start-up failure on the Supervisor was a
  code-level defect; the Broadcom workaround involved volume-snapshot
  deletion (production-snapshot-touching, so schedule it deliberately).

---

## VCF Automation

- **Idem-based Avi load balancer resources need a data migration, not a
  general upgrade prerequisite.** Broadcom KB 403314 covers migrating
  `Idem.AVILB.%`-pattern resources to native Avi resource integration on
  Aria Automation 8.18.1 Patch 3 and later. It only applies if those
  specific resources exist – it is **not** a blanket "must be on 8.18.1
  Patch 3 before the VCF 9.1 upgrade" requirement, despite how it can read
  in a summary slide. Check for Idem-based Avi LB resources first; if there
  are none, this KB does not apply.

---

## Identity Broker / VCF SSO

- **Identity Broker encryption keys can desynchronise from the vCenter
  database** after an upgrade, a storage outage, or a hard crash. Symptoms:
  `mac check in GCM failed` in the Identity Broker service logs, a `401
  invalid_client` on the token call, and internal services (Trust Management)
  failing to authenticate. Fix: **KB 377519** – run `recover_ws1b.sh` then
  `Rotate_WS1B_secrets.sh` on the vCenter to flush and regenerate the
  corrupted secrets, then re-push the SSO configuration.
- **NTP clock skew on the Identity Broker expires SAML tokens before vCenter
  receives them.** Even a 10-minute skew triggers `InvalidTimingException`
  and fails the SSO push. Verify NTP via Lifecycle Manager first – but note
  that fixing NTP alone does **not** resolve it if the encryption keys are
  also desynchronised.
- **ELM drift after breaking Enhanced Linked Mode.** ELM is intentionally
  broken to allow the VCF SSO reconfiguration. Afterwards, check the SDDC
  Manager API for drift status and re-run drift remediation – a missed step
  leaves one or more vCenters (often the management vCenter) unremediated.
- **`lsdoctor` is the general-purpose tool for this whole category** –
  Lookup Service / SSO / vmdir inconsistencies (SSL trust mismatches,
  broken service registrations, stale solution users) don't always
  present as the specific symptoms above; when something in this section
  looks close but doesn't quite match, run `lsdoctor.py -l` (read-only
  check) first before assuming it's something new. Full reference,
  download/setup, all repair-mode flags, and the mandatory
  same-instant-across-the-whole-SSO-domain snapshot precaution: [VDT and
  lsdoctor: self-service diagnostic
  tools](17-vdt-and-lsdoctor-diagnostics.md) (also covers **VDT**, the
  broader appliance health-check tool worth running first). One
  field-observed failure worth knowing by name: **"Node In Multiple
  Sites"** – the read-only check's own output names the exact fix
  (`lsdoctor.py -r`, option 2) for the affected node, see that doc for the
  full example.

---

## Observability – Cloud Proxy, Logs, Networks

- **The upgrade plan does not deploy a unified Cloud Proxy** (also called
  **Universal Cloud Proxy / UCP**). The legacy per-purpose Cloud Proxy
  inherited from VCF 5 is left in place, but **log-data transfer from the old
  Aria Operations for Logs requires a UCP configured for *split proxy*** –
  separating internal traffic from external Broadcom traffic. Without it the
  Control Panel transfer fails with "Transfer failed due to an error". The
  fix applied by engineering patched the HAProxy and HTTPD configuration on
  the existing Cloud Proxy.
- **Log collection for a newly added vCenter is not automatic** – activate
  the collectors by hand in the VCF Operations UI.
- **Operations for Networks (vRNI) may need an intermediate hop** – a direct
  jump to the latest patch was blocked; the upgrade went via an interim
  version first (same pattern as the overview's Operations for Networks
  note).

---

## VCF Management Services Runtime

- **Day-0-only worker nodes do not rightsize after a 9.1 → 9.1.1+ patch.**
  VCF Management Services Runtime 9.1.1+ introduces Day-0-optimized worker
  machine types and minimum worker replica counts, applied automatically on
  a greenfield 9.1.1+ deployment. A brownfield patch from 9.1 does not
  reconcile existing worker sizing, so a management domain that has **not**
  had Log Management or Real-time Metrics added yet stays on its larger
  pre-patch worker VMs indefinitely. Per Broadcom
  [KB 455842](https://knowledge.broadcom.com/external/article/455842):
  1. SSH to the control-plane node as `vmware-system-user`, elevate to `root`.
  2. Copy Broadcom's `rightsize-day0-workers.sh` remediation script to the
     control-plane node.
  3. `chmod +x <directory>/rightsize-day0-workers.sh`, then run it.
  4. Verify with `kubectl get pd vmsp-platform -n vmsp-platform` – wait for
     `STATUS` to reach `Successful`.

  **This triggers a worker node rollout, which can disrupt ongoing
  operations on the cluster** – run it in a maintenance window, not
  immediately after the patch completes. Only applies if the management
  domain is still Day-0-only at 9.1.1+; once Log Management or Real-time
  Metrics is added, worker sizing is no longer Day-0-optimized and this
  script does not apply.

---

## Firewall ports opened during the upgrade

Upgrade-specific flows that had to be opened (in addition to the standard
VCF 9 firewall model – see
`VCF9-DeploymentPlanning/docs/07-firewall-ports.md`):

| Flow | Ports |
| --- | --- |
| Fleet Manager → management hosts and the new Identity Broker IPs | 443 |
| Identity Broker / VCF Automation stack | 443, 7443, 6443, 8008, **30000–30006** |
| Management edges → Operations for Networks appliance (flow data) | 3055 |
| Fleet Manager → Operations for Logs cluster | 9543, and **22 (SSH)** to every log node |

**Ports 30000–30006 must be opened separately for VCF Automation** even if
they were already opened for the Identity Broker deployment – the two
components are firewalled independently and it is an easy step to miss.

---

## Deprecations and behaviour changes to expect

- **Enhanced Linked Mode (ELM) is deprecated** and will be removed – broken
  deliberately during the SSO reconfiguration.
- **The installer-UI vCenter upgrade path is deprecated.**
- **SDDC Manager's own UI is deprecated** and will be removed in a later
  release – lifecycle management is moving to VCF Operations. Not yet gone
  in 9.1.x, but don't build long-term customer processes around it.
- **vSAN is no longer required for the management domain** – VMFS is
  supported.
- **vCLS is deprecated / retreat mode** – expect it deactivated by default;
  a new empty cluster with zero VMs for vCLS to manage can stall vSAN
  stretching until vCLS is put in embedded mode.
- **Aria Suite Lifecycle (vRSLCM) has no upgrade path** – removed after the
  upgrade, replaced by the Fleet Manager appliance.
- **The Data Protection appliance** (vSAN snapshots on ESA) moves into the
  Live Recovery / Protection and Recovery appliance – see
  [Disaster Recovery](02-disaster-recovery.md).

---

## Open items to confirm

- **"Internal certificates renew automatically on upgrade."** An
  unconfirmed general claim (as of 2026-09-11) with no authoritative
  source found yet, and it is not clear which components / certificate
  types it covers. Do not rely on it to skip the pre-upgrade
  certificate-validity check in the [prerequisites table](13-vcf-upgrade-sequence.md#prerequisites-and-architectural-guardrails) –
  confirm scope against TechDocs or in-product behaviour before treating it
  as fact.
- **"VCFverify (VoV only)"** – an unconfirmed (as of 2026-09-11) Dell
  VxRail pre-check tool name (see [VxRail Addendum](vxrail-addendum.md)),
  but neither what "VoV" stands for nor what VCFverify actually checks
  has been confirmed yet. Do not describe its purpose in the docs until
  that's confirmed.
- **"NSX Intel"** – an unconfirmed (as of 2026-09-11) term, likely
  referring to **NSX Intelligence**, but not confirmed – if so, its
  upgrade interaction/sequencing isn't documented anywhere in this repo
  yet.
- **Combined vCenter + NSX Manager upgrade window.** An "optimized"
  combined approach has been described (as of 2026-09-11, not yet
  confirmed against Broadcom TechDocs) – prep vCenter, upgrade NSX, then
  switchover – as an alternative to the plain sequential order (NSX Local
  Manager finishing before vCenter starts, which is what [Phase 5 → Phase
  6](13-vcf-upgrade-sequence.md#phase-5--nsx-local-manager-upgrade)
  documents). The exact mechanics of "prep vCenter" relative to the RDU
  switchover, and how far it can overlap the NSX Local Manager upgrade,
  were not confirmed. **Treat the sequential Phase 5 → Phase 6 order as the
  safe default** until this is clarified – do not attempt to interleave
  them based on this note alone.
- **Third-party ACI (Cisco APIC/VMM) integration can gate the vSphere
  upgrade independently of the VCF interop matrix.** (reviewed 2026-09-18
  against Cisco's live
  [ACI Virtualization Compatibility Matrix](https://www.cisco.com/c/en/us/td/docs/Website/datacenter/aci/virtualization/matrix/virtmatrix.html),
  page last revised 2026-09-01; not yet field-verified against a real
  engagement.) When a customer runs Cisco ACI with a VMM domain against
  vCenter, the VMM domain integration is gated by that matrix independent of
  Broadcom's VCF/vSphere interop matrix. Quoted verbatim from the page's
  VMware section:
  - Every vSphere row, including 9.x: *"VMM integration requires the
    Distributed Virtual Switch feature on vCenter"* – VDS-based VMM is the
    baseline requirement, not just the common deployment choice.
  - vSphere 9 is listed there as **"VMware VCF (vSphere) 9.0"**, not bare
    "vSphere 9" – Cisco's own matrix already uses the VCF name.
  - vSphere 8.0 note: *"vSphere 8.0 does not support the vCenter Plug-in and
    Cisco ACI Virtual Edge (AVE). If you need to continue to use the vCenter
    Plug-in and Cisco AVE, use vSphere 7.0."*
  - VCF (vSphere) 9.0 note: *"VCF (vSphere) 9.0 does not support the vCenter
    Plug-in and Cisco ACI Virtual Edge (AVE)... Also, VCF 9.0 does not
    support the SDDC manager."* The SDDC Manager remark needs its own
    follow-up – unclear yet whether that means Cisco's ACI integration
    doesn't recognize SDDC-Manager-driven upgrades, or something narrower.
  - **AVE (ACI Virtual Edge, formerly AVS) is a hard blocker for 8.0 and
    9.0**, confirmed directly by Cisco, not just "deprecated." A customer
    still on AVE must migrate to VDS-based VMM integration (and drop the
    vCenter Plug-in) before the vSphere 8 or 9 upgrade can proceed.

  **Per-APIC-train support** (read from the matrix's underlying cell data,
  not just the rendered tooltip text – see below):
  - **vSphere 8.0** is supported on APIC **5.2(8)**, **5.3(1)–5.3(2)**, then
    **not** 6.0(1)–6.0(2) (an explicit gap in Cisco's own matrix, not a
    transcription error here), then supported again on **6.0(3)–6.0(9)**,
    **6.1(x)–6.2(1)**, and **6.2(2)–6.2(3)**. Not supported on any APIC
    release before 5.2(8).
  - **VCF (vSphere) 9.0** is supported starting **only at APIC
    6.2(2)–6.2(3)**. Every earlier train – including 6.0(3)–6.1(x)/6.2(1),
    which already supports vSphere 8.0 – is marked not supported for VCF 9.0.
    A customer on an APIC train older than 6.2(2) cannot integrate VMM with
    a VCF 9.0 vCenter yet, full stop, regardless of vSphere-side readiness.

  These come from the page's `v-yes`/`v-no` cell classes (extracted via the
  live DOM, since the rendered tooltip popups aren't present as plain
  extractable text) – re-verify against the live tool before relying on them
  for a specific engagement, as Cisco updates this matrix over time. APIC
  and vCenter do not need to upgrade in lockstep, but the VMM domain must
  always point at a vCenter/ESXi combination certified for the *currently
  running* APIC version – check the matrix at each hop, not just at the
  start and end of the upgrade.
