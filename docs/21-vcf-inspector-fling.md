# VCF Inspector Fling: fleet-level pre-upgrade and health diagnostics

**VCF only.** VCF Inspector connects to a VCF control-plane node (SDDC
Manager / VCF Management Services), which only exists in a fleet driven
through those services – a standalone VVF or plain vSphere environment
has nothing for it to point at.

A standalone, no-install binary that runs on an admin workstation or
jumpbox, rather than a vCenter/PSC-level tool like [VDT and
lsdoctor](17-vdt-and-lsdoctor-diagnostics.md) – VCF Inspector operates at
the fleet layer instead, which is exactly the layer where the patching
failures documented in [Patching an existing VCF 9.1
fleet](20-patching-an-existing-vcf9-fleet.md) happen (stuck lifecycle
tasks, components silently deadlocked behind an apparent "Healthy"
status). Per the official [VCF Inspector Fling
announcement](https://blogs.vmware.com/cloud-foundation/2026/07/28/vcf-inspector-fling/):

- **Pre-upgrade validation** – password policies, host readiness,
  network port reachability, certificate expiration, and lifecycle task
  status. This directly overlaps with the prerequisites tables in
  [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md) and the
  depot/backup prechecks in [Patching an existing VCF 9.1
  fleet](20-patching-an-existing-vcf9-fleet.md) – run it as a second,
  independent confirmation, not a replacement for either.
- **Deployment monitoring** – real-time progress tracking with automatic
  stuck-task detection and root-cause analysis. This is the capability
  most relevant to the [Upgrade All failure
  account](20-patching-an-existing-vcf9-fleet.md#step-2-respect-the-mandatory-dependency-order)
  – a 13-day silent deadlock that the fleet's own UI reported as
  "Healthy" the whole time. A tool built to actively detect stuck tasks
  is the kind of second opinion that account's after-the-fact recovery
  would have benefited from.
- **Health diagnostics** – service status, node topology, log analysis,
  platform IP/FQDN discovery, and remediation actions such as
  certificate renewal.

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

On launch, connect by providing the VCF control-plane node IP/FQDN (the
SDDC Manager address) and `vmware-system-user` (or SDDC Manager admin)
credentials.

**Supported version:** built for **VMware Cloud Foundation 9.1** and its
management services – not verified in this repo against 9.0.x fleets, so
confirm compatibility before relying on it against an older source
build.

---

## Sources

- [VCF Inspector Fling (official VMware Cloud Foundation blog)](https://blogs.vmware.com/cloud-foundation/2026/07/28/vcf-inspector-fling/) – announcement, capabilities, download location, and usage
