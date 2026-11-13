# Cutting over and cleaning up

Phase 6 of a [side-by-side migration](29-side-by-side-migration.md): the
VMs are on the target, but the source still carries their gateways,
other systems still point at it, and HCX (if you used it) still connects
the two sites. This page takes those apart in a safe order: per network
first, then per environment, until the source can be switched off.

It assumes phase 5 is done for the networks you cut over: every wave on
them is signed off ([Migrating with HCX](33-migrating-with-hcx.md) or
[Migrating without HCX](32-migrating-without-hcx.md)).

Facts on this page come from the *VCF Operations HCX* user guide for VCF
9.1 and Broadcom KB articles, read word for word on 2026-11-13. Each is
linked where it's used. Moving a gateway on the physical network is the
network team's change; this page says what to check around it, not how
to configure their routers.

---

## Contents

- [Phase 6, at a glance](#phase-6-at-a-glance)
- [The order](#the-order)
- [Before you cut over a network](#before-you-cut-over-a-network)
- [Where the gateway is, before and after](#where-the-gateway-is-before-and-after)
- [Cutting over a network with HCX](#cutting-over-a-network-with-hcx)
- [Networks on physical VLANs](#networks-on-physical-vlans)
- [Networks on NSX overlay](#networks-on-nsx-overlay)
- [After each network](#after-each-network)
- [Repointing what still points at the source](#repointing-what-still-points-at-the-source)
- [Removing HCX](#removing-hcx)
- [Retiring the source](#retiring-the-source)
- [Phase 6 is done when](#phase-6-is-done-when)
- [Sources](#sources)

---

## Phase 6, at a glance

![Phase 6 in five steps. 1, check the network: its last VM has moved, and nothing else on the source still uses it: physical servers, appliances, DHCP, DNS or NTP. 2, move the gateway: with HCX, unextend the network and connect the target segment to its gateway; without HCX, the network team moves the gateway to the target. 3, check: gateway, routing, DHCP, DNS and NTP from a migrated VM; the firewall groups. Steps 1 to 3 repeat per network. 4, repoint and remove HCX: backup, monitoring, DNS, firewall rules, automation and CMDB away from the source; delete the service mesh and the site pair, unregister the plug-in, remove the Connector. 5, retire the source: archive the exports, a quiet period with the source powered off, then decommission.](images/cutover/phase-6.png)

---

## The order

1. **Per network**, when its last VM has moved: check what else still
   uses it, move its gateway to the target, and check from a migrated VM.
   Repeat for every network. Networks don't all have to wait for the last
   wave: a network whose VMs all moved in wave 2 can be cut over while
   wave 5 is still running.
2. **Per environment**, when every network is cut over: repoint what still
   points at the source, then remove HCX.
3. **The source itself**, last: archive, power off for a quiet period,
   decommission.

The reason for the order: as long as a network is extended or stretched,
a VM can still go back; once its gateway has moved and the extension is
gone, going back means a re-IP or a new extension. Cut over a network only
when its application owners have signed off.

---

## Before you cut over a network

Per network:

- [ ] **Every VM on it has moved**, or is written down as staying behind
      with a reason. Check the source vCenter for VMs still connected to
      the port group, including powered-off VMs and templates.
- [ ] **Nothing else on the source side uses it.** A network can carry
      more than the VMs in your scope: physical servers, appliances, VMs in
      another vCenter, a firewall or load balancer interface. They lose
      their gateway when it moves. Ask the network team for the ARP or MAC
      table of the source gateway on that VLAN: every entry that isn't a
      migrated VM is something to resolve first.
- [ ] **Network services.** *"Migrated virtual machines that use a source
      environment DHCP server or that use statically assigned network
      services like DNS or NTP can lose those services after unextending a
      network"*
      ([Removing a Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/removing-a-network-extension.html)).
      Check where the network's DHCP relay, DNS and NTP servers are, and
      that the migrated VMs can still reach them after the cutover.
- [ ] **Firewall groups.** Groups that refer to the extended network or
      its segment are reviewed
      ([docs/31, 4.8](31-carry-over-networks-and-firewall.md#48-groups-that-refer-to-hcx-extended-networks)).
- [ ] **A window with the network team**, because this is the moment the
      routing changes, and a way back agreed for that window.

---

## Where the gateway is, before and after

The cutover of a network depends on two things: where its gateway is now,
and where the target design puts it. Write both in the network mapping
table ([docs/31, step 1](31-carry-over-networks-and-firewall.md#step-1-the-network-mapping-table)),
then follow the matching row:

| Gateway now (source) | Gateway after (target) | What the cutover is | Where |
| --- | --- | --- | --- |
| Physical router, VLAN | The same physical router or fabric, serving both sites | No gateway move. Remove the VLAN from the source hosts and trunks | [Physical VLANs](#networks-on-physical-vlans), case A |
| Physical router at the source site, VLAN | Physical router at the target site, VLAN (VDS port group or NSX VLAN segment) | The network team moves the gateway and its route; with HCX first unextend, without ticking *Connect cloud network* | [Physical VLANs](#networks-on-physical-vlans), case B |
| Physical router, VLAN | NSX Tier-1 on the target (overlay segment or VPC subnet) | The network team takes the old gateway down, NSX on the target takes over: with HCX the unextend with *Connect cloud network*; without HCX the VMs first move to the NSX segment | [Physical VLANs](#networks-on-physical-vlans), case C |
| NSX Tier-1, overlay | NSX Tier-1 on the target | Withdraw the subnet from the old NSX, advertise it from the new one | [NSX overlay](#networks-on-nsx-overlay) |

Whatever the row: the subnet must never be routed from both sides at once,
because neither vSphere nor HCX notices (*"Network extension does not
detect or mitigate IP conflicts"*,
[Restrictions and Limitations for Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/about-vmware-hcx-network-extension/restrictions-and-limitations-for-network-extension.html)).

---

## Cutting over a network with HCX

### What MON changes

Without **Mobility Optimized Networking (MON)**, *"all routed traffic for
migrated workloads is directed back to the source-site gateway"*. With
MON, routing to other networks on the target goes through the target's
Tier-1 locally
([Understanding Network Extension with Mobility Optimized Networking](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/hcx-network-extension-with-mobility-optimized-networking.html)).
MON *"is not supported for network extension to VLAN networks or VPC
subnets"*. Per
[KB 321599](https://knowledge.broadcom.com/external/article/321599), on a
MON-enabled network *"HCX Bulk migrated VMs will be MON optimized to use
the cloud gateway by default"*, while *"HCX vMotion/RAV migrated VMs will
use the gateway on-premises by default, until transitioned to use the cloud
gateway"*.

So before the cutover, VMs on one network may route two ways. After the
unextend there is one gateway, on the target, for all of them. A firewall
between the sites that only saw some of that traffic before sees all of it
afterwards; check its rules in the same window.

### Unextend

In the HCX UI, **Network Extension**, select the network, **Actions**,
**Unextend Networks** (Removing a Network Extension). Two options decide
what happens to the target side:

- **Connect cloud network to cloud edge gateway after unextending.** *"By
  default, the cloud segment/VPC subnet is left disconnected from the edge
  gateway/VPC respectively after removing the network extension. This is
  done to prevent an edge gateway from advertising a route to the cloud
  segment and causing a potential routing conflict with the network in the
  on-premises data center"*. Ticked, the segment connects to its Tier-1,
  and *"If dynamic routing is activated, the network is advertised from the
  Tier 1 gateway"*. Not ticked, *"the NSX router interface remains
  disconnected"*, and the VMs have no gateway until someone connects it.
- **Block reuse of subnet CIDR** (VPC subnets): *"To prevent inconsistent
  network routing from the destination site to the source site when the
  VPC subnet at the source remains in use"*.

*"Unextending a network removes the L2 bridged path without removing the
NSX segment or Port group, or NSX interface."*

The sequence in the window, so that the subnet is never routed from both
sides at once:

1. The network team takes the gateway on the source side out of service
   and stops advertising the subnet there. If the source network is an NSX
   overlay segment, this step is NSX work on the old Tier-1: see
   [Networks on NSX overlay](#networks-on-nsx-overlay).
2. **Unextend**, with **Connect cloud network to cloud edge gateway after
   unextending** ticked when the target is an NSX segment or VPC subnet on
   a Tier-1. When the target is a **DVPG or an NSX VLAN segment** (possible
   when *"the VCF Operations HCX and NSX versions [are] at least 9.1 on both
   sites"*), there is no Tier-1 to connect: the network team brings up the
   gateway at the target instead ([case B](#networks-on-physical-vlans)).
3. Check the route: the subnet is now advertised from the target (dynamic
   routing) or routed statically to it, and nowhere else.
4. Run [the checks](#after-each-network).

Step 1 before step 2 means a short outage for the network's routed
traffic: agree it as part of the window. HCX doesn't protect you here:
*"Network extension does not detect or mitigate IP conflicts"*
([Restrictions and Limitations for Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/about-vmware-hcx-network-extension/restrictions-and-limitations-for-network-extension.html)).

### When the unextend fails

- **Force Unextend**, for the cases the user guide names: when *"the
  Unextend Networks option fails due to the state of the network extension
  appliance"*, or *"Where the source components are no longer available"*.
  It *"removes the extension and clears internal operations and processes
  from the source and the destination sites"*.
- *"Network unextend failed"*, with *"Remote site status is down. Use force
  option to un-stretch network locally"* in the source HCX Manager log: the
  site pair is disconnected because the remote HCX URL is an IP address
  that doesn't match the target HCX Manager's certificate
  ([KB 448117](https://knowledge.broadcom.com/external/article/448117)).
  Fix the site pair, then unextend normally.
- In an **NSX Federation** environment (a Local Manager later joined to a
  Global Manager), *"the only operation allowed on extended networks"* is
  Force Unextend (Restrictions and Limitations for Network Extension).

---

## Networks on physical VLANs

Here the gateway is a router interface on the physical network (or a
pair, with VRRP or HSRP), and the physical network routes the subnet to
it: statically or with a routing protocol. That is the network team's
change; this section says what has to happen around it, per case from
[the table](#where-the-gateway-is-before-and-after).

Without HCX, the VLAN reached both sides through the physical network and
the gateway stayed where it was during the waves (question 2 in
[docs/29](29-side-by-side-migration.md#2-do-the-vms-keep-their-ip-addresses)).
With HCX, the VLAN on the source was extended to the target by HCX.

![Moving a physical VLAN gateway from the source site to the target site. Step 1, before the window, the target router has the gateway configured but shut, with the same IP address and prefix, and the route ready; route filters allow the subnet from the target site. Step 2a, the source gateway goes out of service and its route is withdrawn. Step 2b, with HCX, unextend without Connect cloud network. Step 2c, the target gateway comes up and its route is announced. Step 3, the core reaches the subnet via the target site only. Step 4, the VMs cache the old gateway's MAC address, so the new gateway announces itself or uses the same virtual MAC. Step 6, the VLAN is removed from the source hosts and the links between the sites. Case A needs no routing change; for case C the NSX side is in the overlay picture.](images/cutover/vlan-cutover.png)

### Case A: the gateway doesn't move

The same router or fabric serves both sites, so the VMs on the target
already use it. There is no routing change:

1. With HCX: **Unextend**, *without* **Connect cloud network**: the
   target side reaches the gateway over the physical VLAN, not through a
   Tier-1.
2. Run [the checks](#after-each-network).
3. Remove the VLAN from the source hosts' uplinks and from the trunks to
   the source site, once nothing on the source uses it any more.

### Case B: the gateway moves to a router at the target site

1. **Before the window:** the network team prepares the gateway at the
   target site, shut, with the **same IP address and prefix**, and the
   route for the subnet ready to be announced from there. If the physical
   network filters routes per peer or per site, the filter must allow the
   subnet from the target site.
2. **In the window:**
   1. The old gateway goes out of service, and the route for the subnet
      is withdrawn at the source site (or the static route to it removed).
   2. With HCX: **Unextend**, *without* **Connect cloud network**.
   3. The new gateway comes up and the route is announced from the target
      site.
3. **Check the routing:** on the core or the routers between the sites,
   the subnet is now reached via the target site only; nothing still points
   at the source site for it.
4. **Check the gateway's MAC address.** The VMs have the old gateway's MAC
   address in their ARP cache. If the new gateway has a different MAC
   address, they reach it only once that entry is refreshed. Agree with the
   network team how the new gateway announces itself (or that it uses the
   same virtual MAC), and test it from a VM straight after the switch.
5. Run [the checks](#after-each-network).
6. Remove the VLAN from the links between the sites and from the source
   hosts, so that it doesn't stay stretched by accident.

### Case C: the gateway moves into NSX on the target

The subnet ends on a Tier-1 (an overlay segment or a VPC subnet) in the
new NSX:

- **With HCX:** use the sequence in [Unextend](#unextend): the network
  team takes the physical gateway down and withdraws the route, then the
  unextend with **Connect cloud network** connects the segment to its
  Tier-1, and the new NSX advertises the subnet. Check the new NSX's side
  as in [Networks on NSX overlay](#networks-on-nsx-overlay), steps 4 and 5
  of the cutover.
- **Without HCX:** the VMs are on a VLAN port group on the target and have
  to change to the NSX segment. That changes their network, not their
  address, and takes them off the VLAN: a change per VM, in its own
  window, done together with the gateway switch for that subnet. Plan it
  in the wave plan, not as a quiet cutover.

---

## Networks on NSX overlay

When the source network is an **NSX overlay segment**, the gateway is not
a router interface the network team owns. It is the segment's downlink on
a source **Tier-1**, and the physical network learns the subnet through a
chain of advertisements in NSX. The target has the same chain in its own
NSX. Cutting over means moving the subnet from one chain to the other:
withdrawn from the old NSX, advertised by the new one, never by both.

![Cutting over an NSX overlay subnet. In each NSX the subnet goes up a chain: segment connected to a Tier-1, Tier-1 route advertisement of connected segments, Tier-0 route redistribution into BGP toward the physical routers. Step 1, old NSX: turn off Gateway Connectivity on the segment only; the other segments on that Tier-1 stay advertised. Step 2, on the old Tier-0 Edges, get route and get bgp neighbor advertised-routes no longer show the subnet. Step 3, new NSX: connect the segment, which had Connectivity None, to the Tier-1 with the gateway IP, or HCX unextend with Connect cloud network. Step 4, the new Tier-0 Edges list the subnet in advertised-routes. Step 5, the physical routers learn the subnet from the new NSX only. Between steps 1 and 3 the subnet has no gateway, the outage of the window.](images/cutover/overlay-cutover.png)

### The advertisement chain, in both NSX environments

| Link | Where | What it does |
| --- | --- | --- |
| Segment to Tier-1 | Segment, **Connectivity** | The segment's subnet and gateway IP live on the Tier-1 it's connected to. *"None"*: *"Select this option when you do not want to connect the segment to any upstream gateway (tier-0 or tier-1)"* |
| Tier-1 to Tier-0 | Tier-1, **Route Advertisement** | **All Connected Segments and Service Ports** advertises every connected segment to the Tier-0; **Set Route Advertisement Rules** narrows that down |
| Tier-0 to the physical network | Tier-0, **Route Redistribution** | Under *Advertised tier-1 subnets*, **Connected Interfaces & Segments**, **Connected Segment**: *"Redistribute subnets configured on segments and advertised from the connected tier-1 gateway"*, into BGP (or OSPF) toward the physical routers |

Sources: *Create an NSX Segment*, *Add an NSX Tier-1 Gateway* and *Add an
NSX Tier-0 Gateway* in the NSX administration guide for VCF 9.0
([segment](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/segments/add-an-nsx-segment.html),
[Tier-1](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-1-gateways/add-an-nsx-tier-1-gateway.html),
[Tier-0](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-0-gateways/add-an-nsx-tier-0-gateway.html)).
The source NSX 4 has the same three settings.

The lever for one subnet is the **segment's connectivity**, not the
Tier-1's route advertisement: *All Connected Segments* covers every
segment on that Tier-1, and the other segments on the old Tier-1 may
still be in use. Disconnecting one segment takes only its subnet out of
the chain. NSX allows the change both ways: *"You can change the
connectivity of a gateway-connected segment from one gateway to another
gateway"*, and *"you can change the connectivity of segment from "None"
to a tier-0 or tier-1 gateway"*, as long as *"the gateways and the
connected segments are in the same transport zone"* (Create an NSX
Segment).

### During the waves: one gateway, on the old side

The target segment must exist for the VMs to land on, but without a
gateway, or its subnet is advertised twice:

- **With HCX:** HCX handles the target side. While the network is
  extended, the target Tier-1's interface for the segment is not in
  service: the unextend page says *"If you don't select this option, the
  NSX router interface remains disconnected"*, and the restrictions page
  that an extension to an existing segment *"disconnects the NSX router
  interface from the network"*
  ([Restrictions and Limitations for Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/about-vmware-hcx-network-extension/restrictions-and-limitations-for-network-extension.html)).
  It is connected only when you tick **Connect cloud network to cloud edge
  gateway after unextending**.
- **Without HCX:** create the target segment with **Connectivity None**
  ([docs/31, step 3](31-carry-over-networks-and-firewall.md#step-3-nsx-segments-and-segment-profiles)).
  *"If a segment is not connected to a gateway, subnet is optional"*;
  write the gateway IP in the mapping table for the cutover. Without HCX
  there is also no layer 2 between the old and the new segment, so VMs on
  the target can't reach VMs still on the source, or the gateway. That
  leaves two ways, chosen per subnet in phase 0:
  - **One window per subnet:** every VM on the subnet moves in the same
    window as the cutover. A wave is then a subnet, not an application.
  - **A layer 2 bridge during the migration:** NSX Edge bridging
    *"connects NSX overlay logical segment with a traditional VLAN at layer
    2"* and *"is mainly for migration scenarios (physical to virtual or
    virtual to virtual)"*
    ([Add and attach NSX Edge Bridge Profile to a Segment](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/transport-zones-and-transport-nodes/add-an-edge-bridge-profile.html)).
    Bridging each side's segment to the same VLAN, trunked between the
    sites, joins them at layer 2. That layout (a bridge in each NSX on one
    shared VLAN) is a design, not a documented Broadcom procedure: it needs
    the Edge prerequisites from that page on both sides, it is a loop risk
    if anything else joins that VLAN, and it must be proven in phase 4
    ([Proving the path](34-prove-the-path.md)) before a wave depends on it.

### The cutover

In one window, with the NSX administrators of both environments and the
network team:

1. **Old NSX:** disconnect the segment from its Tier-1: **Networking**,
   **Segments**, edit the segment, turn off **Gateway Connectivity** (the
   NSX DHCP scenarios page describes this as the way to *"disconnect the
   segment temporarily from the gateway"*). With **DHCP** on the segment,
   read that page first: changing a segment's connectivity affects existing
   leases
   ([Scenarios: Impact of Changing Segment Connectivity on NSX DHCP](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/nsx-dhcp-policy-ui/scenarios-impact-of-changing-segment-connectivity-on-nsx-dhcp.html)).
2. **Old NSX, check it's gone:** on each Edge of the old Tier-0, `get
   logical-router`, then `vrf <id>` of the Tier-0 SR, then `get route`:
   the subnet is no longer there. Then `get bgp neighbor <peer-ip>
   advertised-routes` per BGP peer: the subnet is no longer advertised
   ([KB 339392](https://knowledge.broadcom.com/external/article/339392)
   lists these commands; *advertised-routes* only works *"if connection is
   in Established state"*).
3. **New NSX:** connect the target segment to its Tier-1 with the gateway
   IP from the mapping table (without HCX), or unextend with **Connect
   cloud network to cloud edge gateway after unextending** (with HCX).
4. **New NSX, check it's there:** the new Tier-1 advertises connected
   segments (or has a rule that covers this subnet), the new Tier-0
   redistributes advertised Tier-1 connected segments, and on its Edges
   `get bgp neighbor <peer-ip> advertised-routes` now lists the subnet.
5. **The physical network:** the network team confirms the subnet is
   learned from the new Tier-0's peers only. If the physical side filters
   what it accepts per peer (prefix lists), that filter must allow the
   subnet from the new peers; agree that change before the window.
6. Run [the checks](#after-each-network).

Between steps 1 and 3 the subnet has no gateway: that is the outage of
the window. Doing step 3 before step 1 avoids it, but then both NSX
environments advertise the subnet for a moment, and the physical network
picks one; agree with the network team which risk they prefer, and keep
the gap short either way.

**When the old Tier-1 is empty** after its last segment is cut over,
remove it and its Tier-0 redistribution entries when the source is
retired, not before: until then it's the way back.

---

## After each network

From a migrated VM on the network, and from outside:

| Check | Expected |
| --- | --- |
| Ping the gateway | Answers, from the target |
| Reach a VM on another network on the target, and one still on the source | Both work |
| Reach the VM from a client network (users, management) | Works |
| DHCP lease renewal, DNS resolution, NTP | Work, from servers the VM can still reach |
| A traceroute from the VM | The path no longer goes through the source site |
| Firewall rules on the target that should hit | They hit |

Then, per network, update the network mapping table
([docs/31, step 1](31-carry-over-networks-and-firewall.md#step-1-the-network-mapping-table))
with the date of the cutover.

---

## Repointing what still points at the source

When every network is cut over, go through the systems that know the
source by name or address. Most were handled per wave
([docs/32, Outside vCenter](32-migrating-without-hcx.md#outside-vcenter-per-wave));
this is the final sweep:

| What | Check |
| --- | --- |
| **Backup** | No job selects VMs through the source vCenter; the source vCenter is no longer a backup source |
| **vSphere Replication, DR** | Replication runs from the target ([KB 421671](https://knowledge.broadcom.com/external/article/421671)); no protection group or recovery plan still names the source |
| **Monitoring, VCF Operations** | No adapter, alert or dashboard still collects from the source vCenter or hosts; decide how long its history is kept |
| **Automation** | No cloud account, script or scheduled job still connects to the source vCenter |
| **DNS** | No CNAME or alias still points at a source vCenter, host or appliance; records you'll remove are listed |
| **Firewall rules** | Rules for the migration (vCenter to vCenter, ESX to ESX, HCX) are listed for removal |
| **Identity** | Service accounts that only the source used (vCenter, backup, monitoring) are listed for removal |
| **CMDB and documentation** | Every VM shows its new vCenter, cluster and datastore |

A way to find what you missed: for a week before you switch the source
off, watch its vCenter for logins and API sessions, and the firewall for
traffic to it. Every hit is a system that still points there.

---

## Removing HCX

Remove HCX when every extended network is unextended and no migration is
running. Broadcom's order for a clean decommission
([KB 317510](https://knowledge.broadcom.com/external/article/317510)), on
the source (Connector) side:

1. *"Ensure that any on-going migrations are completed or cancelled"*.
2. *"Remove all disaster recovery protections"* (if HCX DR was used).
3. *"Un-stretch all networks"* (done network by network above).
4. Delete every **service mesh**: *"Infrastructure --> Interconnect -->
   Service Mesh"*, **Delete**. Start it from the Connector side: that
   *"will remove the Service Mesh and associated HCX appliances from both
   the Connector and Cloud sites"*
   ([KB 314195](https://knowledge.broadcom.com/external/article/314195)).
5. Delete the **site pair**: *"Infrastructure --> Site Pairs --> Delete
   Site Pair"*.
6. **Unregister the HCX plug-in** from the source vCenter. For vCenter
   8.0 and later the extensions are *"com.vmware.hcx.plugin"* and
   *"com.vmware.hcsp.alarm"*; the KB's first option is **Administration**,
   **Solutions**, **Client Plugins**, select the HCX plug-in, **Remove**.
   The KB asks for *"a snapshot and a backup of the current vCenter Server
   Appliance VM before making these changes"*, and a change window,
   because the vSphere Client service may have to be restarted.
7. *"Power-off the HCX Connector VM and delete it from disk"*.

On the target, decide whether to keep the HCX Manager for later
migrations or remove it; and close the HCX firewall rules either way
(the deployment-planning guide,
[HCX migration to VCF 9.1](https://vcf-planning.hollebollevsan.nl/docs/38-hcx-migration/),
§11 and §3.4).

**When it gets stuck.** If the service mesh won't delete, KB 314195 lists
what to try first (refresh the site pair until it shows *Connected*, remove
the extensions, then delete from the Connector side) and only then the
**Force Delete** option, which *"will remove the HCX appliances associated
with the Service Mesh and the Service Mesh itself even if the remote site
cannot be reached"*. A site pair that can't be removed in the UI can be
deleted through the HCX API
([KB 314206](https://knowledge.broadcom.com/external/article/314206)); the
KB gives the session call for HCX 9.x. Both KBs call manual removal a last
resort.

---

## Retiring the source

1. **Nothing runs on it** that belongs to the migration scope. The copies
   that a migration left behind are removed once their wave was signed off:
   the originals Bulk left in *Migrated VMs*
   ([docs/33](33-migrating-with-hcx.md#moving-a-vm-back)), and copies from
   *Keep VMs on the source* ([docs/32](32-migrating-without-hcx.md#phase-5-is-done-when)).
2. **Archive** the last baseline export of the source
   ([docs/29, phase 0](29-side-by-side-migration.md#phase-0-decide-the-route)),
   together with the wave lists, the logs, and the phase 4 evidence sheet.
   Keep them in the engagement's storage, not in a repository.
3. **A quiet period.** Power the source vCenter and hosts off, but don't
   wipe them yet. Agree how long with the customer. Anything that breaks
   in that period was still using the source; you can still power it on.
4. **Backups of the source** stay until their retention ends; check with
   the backup owner before removing the source vCenter from the backup
   software.
5. **Decommission:** remove the source vCenter from the tools that still
   list it, remove its DNS records, firewall rules and service accounts
   (the lists from [Repointing](#repointing-what-still-points-at-the-source)),
   and wipe or hand back the hardware.
6. **Hosts that move to the target** are commissioned there as new hosts:
   see the deployment-planning guide,
   [Host commissioning](https://vcf-planning.hollebollevsan.nl/docs/40-host-commissioning/).

---

## Phase 6 is done when

- [ ] Every migrated network has its gateway on the target, and its checks
      passed.
- [ ] No network is extended or stretched between the sites any more,
      and no Edge bridge from the migration is left.
- [ ] Every migrated subnet is advertised by the new NSX (or the new
      gateway) only; the old Tier-0s no longer advertise it.
- [ ] Nothing points at the source: backup, DR, monitoring, automation,
      DNS, firewall rules, CMDB.
- [ ] HCX is removed (service mesh, site pair, plug-in, Connector), and
      its firewall rules are closed.
- [ ] The exports, wave lists, logs and evidence sheet are archived.
- [ ] The source was powered off for the agreed quiet period without
      anything breaking, and is decommissioned.

That ends the side-by-side migration. Back to the overview:
[Side-by-side migration](29-side-by-side-migration.md).

---

## Sources

Read word for word on 2026-11-13.

- VCF Operations HCX user guide for VCF 9.1:
  [Removing a Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/removing-a-network-extension.html),
  [Understanding Network Extension with Mobility Optimized Networking](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/hcx-network-extension-with-mobility-optimized-networking.html),
  [Restrictions and Limitations for Network Extension](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/workload-mobility/vmware-hcx-user-guide-vcf-9-0/extending-networks-with-vmware-hcx/about-vmware-hcx-network-extension/restrictions-and-limitations-for-network-extension.html)
- [KB 321599](https://knowledge.broadcom.com/external/article/321599):
  Mobility Optimized Networking (MON) Troubleshooting Guide
- [KB 448117](https://knowledge.broadcom.com/external/article/448117):
  HCX failed to unextend network with error message "Network unextend failed"
- [KB 317510](https://knowledge.broadcom.com/external/article/317510):
  Uninstall a deployment from Connector & Cloud
- [KB 314195](https://knowledge.broadcom.com/external/article/314195):
  Manual removal of an HCX Service Mesh and Compute Profile
- [KB 314206](https://knowledge.broadcom.com/external/article/314206):
  Manual removal of stale Site Pairing
- NSX administration guide for VCF 9.0:
  [Create an NSX Segment](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/segments/add-an-nsx-segment.html),
  [Add an NSX Tier-1 Gateway](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-1-gateways/add-an-nsx-tier-1-gateway.html),
  [Add an NSX Tier-0 Gateway](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/tier-0-gateways/add-an-nsx-tier-0-gateway.html),
  [Scenarios: Impact of Changing Segment Connectivity on NSX DHCP](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/nsx-dhcp-policy-ui/scenarios-impact-of-changing-segment-connectivity-on-nsx-dhcp.html),
  [Add and attach NSX Edge Bridge Profile to a Segment](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-0/advanced-network-management/administration-guide/transport-zones-and-transport-nodes/add-an-edge-bridge-profile.html)
- [KB 339392](https://knowledge.broadcom.com/external/article/339392):
  Troubleshooting NSX BGP (Edge CLI: `get logical-router`, `vrf`,
  `get route`, `get bgp neighbor ... advertised-routes`)
- [KB 421671](https://knowledge.broadcom.com/external/article/421671):
  Cross vCenter migration is not supported for VMs protected by vSphere
  Replication
