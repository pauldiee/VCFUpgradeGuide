# VCF Inspector Fling: fleet-level pre-upgrade and health diagnostics

**VCF only.** Every mode connects to either SDDC Manager or a VCF
Services Runtime control-plane VM – layers that only exist in a fleet
driven through VCF Management Services. A standalone VVF or plain
vSphere environment has nothing for it to point at.

A standalone, no-install binary that runs on an admin workstation or
jumpbox, rather than a vCenter/PSC-level tool like [VDT and
lsdoctor](17-vdt-and-lsdoctor-diagnostics.md) – VCF Inspector operates at
the fleet layer instead, which is exactly the layer where the patching
failures documented in [Patching an existing VCF 9.1
fleet](20-patching-an-existing-vcf9-fleet.md) happen (stuck lifecycle
tasks, components silently deadlocked behind an apparent "Healthy"
status). Launching the binary opens a **local web UI in the browser**
(light/dark theme toggle in the header) rather than a terminal TUI – per
its own landing screen: *"All communication is local to your machine.
Credentials are never stored to disk."*

**Field-observed (v1.300, lab run, not a live customer fleet) – the
landing screen presents three use-case cards, each connecting to a
different VCF infrastructure layer:**

- **Check VCF 9.1 Upgrade Readiness** – connects to an **existing VCF
  5.2 or 9.0 SDDC Manager** and runs a pre-flight check before starting a
  9.1 upgrade: component version compatibility, certificate expiry and
  in-flight LCM task scan, IP pool validation and network port probes –
  **20+ pre-flight checks across 9 categories**. This targets the same
  moment as the prerequisites tables in [Full VCF upgrade
  sequence](13-vcf-upgrade-sequence.md) – a source on 5.2 or 9.0.x
  heading to 9.1, not a 9.1.0.x → 9.1.1 patch – run it as a second,
  independent confirmation, not a replacement.
- **Monitor Installation or Upgrade** – connects to an **in-progress VCF
  installation or upgrade** (button: *Connect to VCF Installer*) to track
  Bootstrap VM task and appliance status, bundle download progress from
  the depot, deployment stage/workflow tracking, and real-time error
  detection and alerts.
- **Check Deployed VCF Management Services** – inspects an **already
  running** VCF Management Services deployment: live health status for
  every management service, error translation with admin runbook steps,
  workflows for failed Fleet/SDDC lifecycle runs, a **Runtime Health
  score with cascade detection and node topology**, and a **live Log
  Analyzer** that mines pod logs for patterns and surfaces source-aware
  remediations for Fleet and SDDC LCM issues – not mentioned in the
  official announcement blog at all. This is the capability most
  relevant to the [Upgrade All failure
  account](20-patching-an-existing-vcf9-fleet.md#step-2-respect-the-mandatory-dependency-order)
  – a 13-day silent deadlock that the fleet's own UI reported as
  "Healthy" the whole time. A tool built for cascade detection and live
  log pattern mining is the kind of second opinion that account's
  after-the-fact recovery would have benefited from.

**This is a VMware Fling, not officially supported production
software.** Treat it as a diagnostic aid, not a gate the patch process
depends on, and expect rough edges – feedback goes back through the
Flings community channel it ships with.

## Download and setup

Download the platform-matching binary from the Broadcom Support Portal
Free Downloads / Flings section (search for **VCF Inspector**) – no
installer, no appliance to deploy:

| Platform | Binary |
| --- | --- |
| macOS (Apple Silicon) | `vcf-inspector-darwin-arm64-native` |
| Linux (x86_64) | `vcf-inspector-linux-amd64` |
| Windows (x86_64) | `vcf-inspector-windows-amd64-native.exe` |

**macOS/Linux:**
```
chmod +x ./vcf-inspector-darwin-arm64-native
./vcf-inspector-darwin-arm64-native
```

**Windows:** double-click the `.exe`.

**Each of the three modes connects to a different target with different
credentials – there's no single generic login.** Field-observed (v1.300):

- **Check VCF 9.1 Upgrade Readiness** connects to **SDDC Manager**.
  Select the **current VCF version first** (a toggle: **VCF 5.2.x** or
  **VCF 9.0.x** – no 9.1 option, since this mode is specifically for a
  pre-9.1 source assessing readiness to move to 9.1), then supply the
  SDDC Manager IP/hostname (port suffix supported for non-standard
  ports, e.g. `10.0.0.1:9004`) and an SSO admin login (placeholder
  `administrator@vsphere.local`). Button: **Connect & Run Pre-Flight
  Check**.
- **Monitor Installation or Upgrade** also connects to **SDDC Manager**
  (IP/FQDN, `admin` + the SDDC Manager password) – but unlike the other
  two modes, it needs **no separate Bootstrap VM credentials**: *"The
  Bootstrap VM is auto-discovered via SDDC Manager."* Button: **Connect &
  Monitor**.
- **Check Deployed VCF Management Services** connects somewhere entirely
  different: **SSH directly to a VCF Services Runtime control plane VM**
  (not SDDC Manager), default username `vmware-system-user`, with an
  **Advanced Connection Options** section for a non-default SSH port and
  an optional pasted SSH private key (PEM) in place of a password. It
  also surfaces a callout pointing at **VCF Operations' own Health
  Dashboard** as a suggested first check before connecting here at all.
  Button: **Connect & Inspect**.

All three forms offer a **Save connection** option, and a prior session's
saved connections reappear as chips on return visits (e.g. a saved IP) –
so despite the tool's own framing, *some* connection state does persist
between runs.

**Credential-storage claims are inconsistent across screens, and that
matters before pointing this at anything sensitive.** The landing page's
blanket claim is *"Credentials are never stored to disk."* The Management
Services Inspector screen's own footer instead says *"Credentials are
stored in browser local storage only"* – a materially different claim
(browser local storage is disk-backed, just sandboxed to the app's
origin) that directly contradicts the landing page one screen up.
Unresolved as of v1.300 – until VMware clarifies which is accurate,
treat any saved connection/credential as retained somewhere on the
machine running the tool, and don't save credentials for a production
control-plane node on a shared workstation.

**Supported source versions:** the announcement blog describes the tool
as built for VCF 9.1, but the readiness-check mode's own version toggle
(v1.300) only offers **VCF 5.2.x or VCF 9.0.x** as the *source* being
assessed – i.e. this mode is for a pre-9.1 fleet checking readiness to
reach 9.1, not for validating a fleet already on 9.1. The other two
modes (Deployment Monitor, Management Services Inspector) do target VCF
9.1 itself, per their header badges (`VCF 9.1`). Confirm which mode
matches the source version actually in play before relying on it.

---

## Sources

- [VCF Inspector Fling (official VMware Cloud Foundation blog)](https://blogs.vmware.com/cloud-foundation/2026/07/28/vcf-inspector-fling/) – announcement, capabilities, download location, and usage
