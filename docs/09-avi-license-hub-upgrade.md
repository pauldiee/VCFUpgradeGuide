# Avi Load Balancer + License Hub upgrade

A companion to the [Overview](01-overview.md), expanding on the [Conditional
phases table's Avi + License Hub
row](01-overview.md#conditional-phases-optional-components): two separate
components that travel together because License Hub licenses Avi.

Applies whenever **Avi Load Balancer (NSX Advanced Load Balancer)** is in
use. **Position: after Disaster Recovery Products, before SDDC Manager** –
ahead of the core NSX / vCenter / host tier.

---

## Avi Load Balancer

Upgrade the **Avi Controller** cluster ahead of the core NSX / vCenter /
host tier; Service Engines follow. Follow the dedicated
[Upgrade Avi Load Balancer to VCF 9.1](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html)
procedure.

> **Hard blocker: Avi 32.1.1 is the minimum for VCF 9.1.** If NSX and
> vCenter reach 9.1 while Avi is still below 32.1.1, their own upgrades are
> blocked. Upgrade Avi first, not as an afterthought.

---

## License Hub

License Hub licenses **vDefend and Avi** subscription license files
(replacing the 25-character keys). It is needed **only when vDefend *or*
Avi is in scope** – never on the strength of the Security Services Platform
alone.

> **License Hub is not the License Server.** The **License Server** is
> deployed automatically at bring-up /
> [Phase 3](01-overview.md#phase-3--deploy-vcf-management-services--license-server)
> and licenses the VCF *fleet*. **License Hub** is a separate Day-N
> appliance for vDefend / Avi. Both exist in a fleet that runs Avi.

- **License Hub 2.0** (2026) ships as a **single standalone OVA** (~11 GB),
  listed under the **Avi Load Balancer** download page → *Primary
  Downloads*. It no longer uses the Security Services Platform Installer /
  `.tar` flow. **There is no 5.1.2 → 2.0 upgrade path** – a fresh 2.0
  deployment.
- **License Hub 5.1.2** (older, if that is what is installed): three VMs
  (installer / controller / worker), roughly **9 IPs** in two pools
  (installer 1, nodes 4, services 4) whose **node and service pools cannot
  be changed after deployment**, two FQDNs. Disconnected (air-gapped) mode
  requires a manual license-file import every six months, indefinitely;
  connected mode polls the Avi Cloud Console.
- **Confirm which version applies** before re-using any 5.1.2 IP-pool /
  FQDN guidance – the 2.0 single-OVA deploy prompts for different inputs.

---

## Sources

- [Upgrade Avi Load Balancer to VCF 9.1](https://techdocs.broadcom.com/us/en/vmware-security-load-balancing/avi-load-balancer/avi-load-balancer-vmware-cloud-foundation/9-1/upgrade-avi-load-balancer-to-vcf-9-1/upgrade-avi-to-9-1.html)
