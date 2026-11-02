# Application Virtual Networks after an upgrade from VCF 5.x

**VCF only.** Applies to a fleet upgraded from VCF 5.x where the Aria
components were deployed on Application Virtual Networks (AVN): the
region-specific and the cross-instance (X-Region) NSX overlay segments.
This page answers one question: after the upgrade to 9.1, do you keep the
AVN segments or plan a migration away from them?

**Short answer: keep them.** Broadcom does not require a migration, and the
9.1 design library describes a network model that is the AVN layout carried
forward. Only the **new** VCF Management Services components land on a
VLAN.

Read from Broadcom TechDocs and KBs on 2026-11-02. Not run on a build in
this repo.

---

## What Broadcom says

**No migration required.** KB 443842 covers VCF Operations, VCF Automation
and the Management Runtime cluster on NSX segments after a brownfield
upgrade: they remain "a fully supported network configuration following a
brownfield upgrade to VCF 9.1", and "migration of existing brownfield
workloads from validated NSX VLAN segments is not required to maintain
system support status"
([KB 443842](https://knowledge.broadcom.com/external/article/443842/vcf-91-brownfield-upgrade-support-for-vc.html)).
The KB names VLAN-backed segments; an AVN is an overlay segment, which is
closer to the greenfield design ("Greenfield deployments, which prescribe
NSX Overlay Segments for management component isolation"). That AVN is
covered as well is an inference: no Broadcom page names AVN in 9.1.

**The 9.1 design has an AVN-shaped model.** The design library lists four
VCF management network models
([VCF Management Network Detailed Design](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design.html)):

| Model | VCF Management Services | VCF Operations, VCF Automation, Ops for Networks, License Server |
| --- | --- | --- |
| Shared VLAN | VM management network | VM management network |
| Dedicated VLAN | Dedicated VLAN | Dedicated VLAN |
| Dedicated VLAN and NSX Overlay Segment | Dedicated VLAN | NSX overlay segment |
| Dedicated VLAN and NSX Stretched Overlay Segment | Dedicated VLAN | NSX overlay segment stretched with NSX Federation |

The page for the overlay model is still published under the URL
`logical-application-virtual-network-design-for-vmware-cloud-foundation`.
For a 5.2 fleet with an X-Region AVN on NSX Federation, the stretched model
is the match: "The NSX stretched overlay segment will provide IP mobility
for VCF Operations in the case of a failover from one region to another"
([VCF Management Dedicated VLAN and NSX Stretched Overlay Segment Network Model](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design/fleet-level-components-on-stretched-nsx-overlay-segment-model.html)).
Without Federation, the non-stretched model applies
([VCF Management Dedicated VLAN and NSX Overlay Segment Network Model](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design/logical-application-virtual-network-design-for-vmware-cloud-foundation.html)).

---

## Where each component lands after the upgrade

| Component | After the upgrade | Why |
| --- | --- | --- |
| VCF Operations, Ops for Networks | Stays on its AVN segment | Upgraded in place |
| VCF Automation | Stays on its AVN segment | The blue-green upgrade deploys the new nodes "on the same network as your existing Automation nodes" ([Upgrading to VCF Automation 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9.html)). See [docs/26](26-aria-automation-to-vcf-automation-upgrade.md) |
| VCF Management Services (Identity Broker, fleet and SDDC lifecycle, depot, services runtime) | New, on the VM management network by default, or a dedicated VLAN / overlay through the SDDC Manager API | New deployment, see [below](#placing-vcf-management-services) |
| Log Management | On the VCF Management Services network | Its FQDN must resolve to an IP "in the same management network as the VCF Management Services components" ([KB 441062](https://knowledge.broadcom.com/external/article/441062/cannot-retrieve-logs-check-connection-fr.html)). See [docs/11](11-log-management-migration.md) |
| Cloud Proxy | VM management network | Instance-level component; design recommendation VCF-MGMT-DVOVL-NET-RCMD-001 |
| Workspace ONE Access, Aria Suite Lifecycle | Retired | Free their AVN addresses after decommissioning ([docs/03](03-identity-broker-migration.md)) |

---

## Placing VCF Management Services

The SDDC Manager workflow deploys VCF Management Services onto the existing
VM management network by default. William Lam documents choosing another
network, a VLAN-backed port group or an NSX overlay, through the SDDC
Manager API
([William Lam: deploying VCFMS to a non-management network during the VCF upgrade](https://williamlam.com/2026/06/vcf-9-1-deploying-vcf-management-services-vcfms-to-non-management-network-during-vcf-upgrade.html)).
There is no re-deployment workflow afterwards, so decide before Phase 3
([docs/13](13-vcf-upgrade-sequence.md#phase-3--deploy-vcf-management-services--license-server)).

Broadcom's AVN-shaped models put Management Services on a **dedicated
VLAN**, not on the overlay segment. For a second region the design gives
two options: a separate, routable management VLAN in the second region with
DNS repointed during the restore, or one management VLAN stretched between
the regions. Fleet recovery onto a different VLAN is documented in
[docs/02](02-disaster-recovery.md#fleet-components-after-a-site-loss-vcf-only).

**Identity Broker on overlay: 9.0.x source only.** An existing 9.0.x
Identity Broker on an NSX overlay must be transitioned before the VCF
Operations upgrade
([KB 444734](https://knowledge.broadcom.com/external/article/444734/transition-a-vcf-identity-broker-90x-ins.html)).
A 5.x source has no Identity Broker yet, so this does not apply.

---

## Recommendation

1. **Keep the AVN segments** for VCF Operations, Ops for Networks and VCF
   Automation. With an X-Region segment on NSX Federation, this is the
   *Dedicated VLAN and NSX Stretched Overlay Segment* model of the 9.1
   design.
2. **Put VCF Management Services on a dedicated, routed management VLAN**,
   chosen through the SDDC Manager API before Phase 3, so the fleet matches
   that model.
3. **Plan the DR side** of the Management Services VLAN: a routable
   recovery VLAN with DNS repointing, or a stretched VLAN.
4. **Clean up only what is retired:** Workspace ONE Access and Aria Suite
   Lifecycle addresses on the AVN, after decommissioning.
5. **Do not plan a move** of VCF Operations or VCF Automation off the AVN.
   Broadcom documents no procedure for re-addressing them, and does not
   require it.

---

## Open items to confirm

- The AVN deployment UI in SDDC Manager was removed in 9.0 (third-party
  source: [vInfrastructure: deprecated and removed features in VCF 9.0](https://vinfrastructure.it/2025/06/deprecated-features-in-vcf-9-0/)).
  Not checked against the Broadcom release notes.
- Whether Lam's API method for VCF Management Services is also documented
  in TechDocs for the upgrade path (the design page recommends the VCF
  Installer UI for greenfield day 2).

---

## Sources

- [KB 443842: VCF 9.1 brownfield upgrade support for VCF Operations and Automation on NSX VLAN segments](https://knowledge.broadcom.com/external/article/443842/vcf-91-brownfield-upgrade-support-for-vc.html)
- [VCF Management Network Detailed Design (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design.html)
- [VCF Management Dedicated VLAN and NSX Overlay Segment Network Model (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design/logical-application-virtual-network-design-for-vmware-cloud-foundation.html)
- [VCF Management Dedicated VLAN and NSX Stretched Overlay Segment Network Model (9.1)](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/design/design-library/fleet-level-components-networking-detailed-design/fleet-level-components-on-stretched-nsx-overlay-segment-model.html)
- [Upgrading to VCF Automation 9.1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/deployment/upgrading-cloud-foundation/phase-3-import-and-upgrade-aria-automation-8-to-vcf-automation-9.html)
- [KB 441062: Cannot retrieve logs. Check connection from Logs Integration page](https://knowledge.broadcom.com/external/article/441062/cannot-retrieve-logs-check-connection-fr.html)
- [KB 444734: Transition a VCF Identity Broker 9.0.x Instance to the VCF Services Runtime Environment](https://knowledge.broadcom.com/external/article/444734/transition-a-vcf-identity-broker-90x-ins.html)
- [William Lam: VCF 9.1 deploying VCF Management Services to a non-management network during VCF upgrade](https://williamlam.com/2026/06/vcf-9-1-deploying-vcf-management-services-vcfms-to-non-management-network-during-vcf-upgrade.html)
