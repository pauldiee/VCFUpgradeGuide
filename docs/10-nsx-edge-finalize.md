# NSX Edge & NSX Finalize

A companion to the [Full VCF upgrade sequence](13-vcf-upgrade-sequence.md),
expanding on [Phase 8 – NSX finalize](13-vcf-upgrade-sequence.md#phase-8--nsx-finalize)
and the [Conditional phases table's NSX Edge & NSX Finalize
row](13-vcf-upgrade-sequence.md#conditional-phases-optional-components).

**Position: the last core step**, replacing the plain Phase 8. It runs
**after the ESX / host-cluster phase** and does two things in one
workflow: upgrades the **NSX Edge cluster(s)** to 9.1, then **finalizes**
the NSX upgrade – the step that marks the workload domain fully on 9.1.
Applies whenever NSX Edge nodes are present (any NSX-backed overlay / N-S
routing – i.e. almost always).

---

## Why it is last

The Edge dataplane version aligns with the **host transport-node
dataplane**, so the hosts must be on 9.1 first. VCF Lifecycle Management
enforces it: the **Configure button for the Edge / finalize step stays
greyed out** until *every* vCenter and ESX host in the domain (and
dependent domains) is on 9.1 – *"NSX Dataplane upgrade is not available for
domain … since all vCenter and ESX on the dependent domains are not
upgraded"*.

Driven from **SDDC Manager / VCF Operations Fleet Management** (the NSX
Upgrade Coordinator underneath), not NSX's own UI, once SDDC Manager is on
9.1. **Run the NSX upgrade prechecks first.**

---

## Rolling upgrade behavior

**Edge clusters** upgrade in parallel by default; **within a cluster the
edges go serially**. Each edge node: enter maintenance mode → stage the new
OS → switch → **reboot** → exit maintenance mode. On an Active/Standby pair
the standby takes the Active role and sends GARP.

**North-south traffic impact.** Expect a **brief N-S blip per edge** at
each failover. Known issue: an ESX host can miss the GARP and keep
tunnelling to the now-offline edge until the ARP entry ages out (~10 min) –
[KB 440381](https://knowledge.broadcom.com/external/article/440381).
Schedule the Edge/finalize step in a maintenance window and
confirm N-S routing re-converges after each node.

**Shared NSX instance.** If one NSX instance is shared between the
management domain and one or more workload domains, start the **Edge
Cluster Upgrade + Finalize from the management domain only**, once every
other component in every domain on that NSX is upgraded.

**What "finalize" does.** Completes the Edge dataplane upgrade and commits
the NSX upgrade – version state flips to fully upgraded, Manager-mode
fallbacks are cleared, and the domain is reported on 9.1.

---

## Gotcha – stale transport-node record

A leftover / orphaned Host Transport Node entry (from a decommissioned or
renamed host that was not cleanly removed from NSX) makes LCM count an
un-upgraded unit and greys out the Configure button even though everything
really is on 9.1.

Remove the stale entry in **NSX Manager → System → Fabric → Nodes → Host
Transport Nodes → Other Nodes** (Remove NSX / Force Delete); verify with
`GET /api/v1/upgrade/upgrade-units?component_type=HOST`; then retry
([KB 444026](https://knowledge.broadcom.com/external/article/444026)).

---

## Before moving on

- All Edge nodes on the target build and in their cluster.
- Edge cluster + tunnels + BFD healthy.
- N-S routing (BGP / static) re-converged.
- **NSX upgrade marked complete / finalize succeeded.**
- No orphaned upgrade units.

---

## Sources

- "Upgrading vCenter and NSX Manager" → *Upgrade the NSX Edge Cluster and
  Finalize NSX Upgrade* (Broadcom TechDocs, under *Upgrading Cloud
  Foundation*).
- "NSX Edge Node Upgrade Process by the Upgrade Coordinator" (NSX upgrade
  guide).
- ["VCF 9.1 NSX Edge Dataplane Upgrade and Finalize Cannot be Started (Stale
  Host Entry)" (KB
  444026)](https://knowledge.broadcom.com/external/article/444026)
- ["Application Outage During NSX Edge Upgrade Failover Due to Missed GARP"
  (KB 440381)](https://knowledge.broadcom.com/external/article/440381)
