# VCF software depot and binary management

**The VCF Software Depot handles binaries for all VCF components** –
install bundles, upgrade/patch bundles, ESX updates, and (from 9.1.1)
"artifacts" – and is what both the VCF Installer and VCF Operations Fleet
Management read from when deploying or patching anything in the fleet.
This is a newer, still-evolving area of VCF 9.1 (the activation-code
mechanism described below only fully replaced download tokens in 9.1) –
re-verify exact UI paths and command flags against the current build
before relying on them for a live engagement.

Applies to VCF and VVF alike – both use the same depot/download
mechanism, distinguished only by the `--sku` value passed to the
download tool.

---

## Online vs. offline (disconnected) depot

Two connection modes, and **only one can be ACTIVE at a time** – switching
between Online and Offline requires disconnecting the current one first,
not a live cutover.

- **Online** – the VCF Operations Fleet Management appliance connects
  directly to Broadcom's online repository. Simplest ongoing operation,
  needs outbound internet access from the fleet management appliance.
- **Offline** – an internal web server hosts the binaries instead. Since
  VCF 9.1, this offline depot can be configured over **plain HTTP with no
  basic authentication**, for both the VCF Installer and the newer Fleet
  Depot Service – populated ahead of time using the **VCF Download Tool**
  (below) on a separate machine that does have internet access, then
  served internally.

**Connect the fleet to a depot**: in VCF Operations, **Fleet Management →
Lifecycle → VCF Instances → (select the VCF Instance) → Depot Settings**.

---

## Download token vs. activation code

Two authentication mechanisms exist, and Broadcom is actively moving from
one to the other:

- **Download token** – the older mechanism. Works with the VCF Download
  Tool or the VCF Installer UI for general VVF/VCF binary downloads.
- **Activation code** – the newer, preferred mechanism, and **mandatory
  for downloading ESX updates/patches specifically** – there is no
  token-based path for ESX binaries. Also works for every other VVF/VCF
  download, so it's the direction to standardize on rather than treating
  it as ESX-only.

To obtain an activation code: generate a Software ID first
(`vcf-download-tool configuration generate --software-depot-id`), then
register that depot in the Broadcom/VCF Business Services portal to get
the activation code back. In VCF 9.0 a download token alone was
sufficient; from 9.1 onward, registering the software depot to get an
activation code is the expected path.

---

## VCF Download Tool (VCFDT)

Ships with VCF 9.1, downloads VVF/VCF installation and upgrade binaries
plus ESX patches/updates to an offline depot. Four distinct operations,
not one generic "download everything":

**Installation binaries:**

```
vcf-download-tool binaries download --depot-download-token-file=/path/token.txt \
  --depot-store=/path/destination --vcf-version=9.1.0 --sku=VCF \
  --automated-install --type=INSTALL
```

**Upgrade/patch binaries** (note `--patches-only` and pinning a specific
target `--component-version`):

```
vcf-download-tool binaries download --depot-download-token-file=/path/token.txt \
  --depot-store=/path/destination --vcf-version=9.1.0 --sku=VCF \
  --type=UPGRADE --patches-only --component-version=9.1.0.0100
```

**ESX binaries and metadata** – separate command, and this is the one
that **requires an activation code, not a download token**:

```
vcf-download-tool esx download --depot-download-activation-code-file=/path/code.txt \
  --depot-store=/path/destination
```

**Key flag values:**
- `--type=INSTALL` – installation binaries
- `--type=UPGRADE` – upgrade/patch binaries
- `--sku=VCF` or `--sku=VVF` – which platform's binaries

---

## Manual binary upload for Day-N operations on a local/disconnected depot

A disconnected or local depot doesn't auto-fetch anything – binaries for
**Day-N operations** (deploying optional components after initial
bring-up, or provisioning a new VCF Instance/Domain) have to be uploaded
into the Fleet Depot Service by hand. This covers things like:

- Deploying **Log Management**, **Real-time Metrics**, or **VCF
  Operations for Networks** after the fleet already exists
- Provisioning a **new VCF Instance or workload domain**

Plan for this explicitly in a disconnected environment – these aren't
covered by whatever binaries were staged for the initial
install/upgrade, since they're separate optional-component downloads.

---

## Depot patching blocks everything else

**Don't schedule a depot binary update at the same time as any other
component patch.** Per Broadcom: *"When you patch a software depot
instance, patching other components is blocked because the patch
binaries are unavailable."* This is also why Fleet Lifecycle patches
first in the day-2 patching order (see [Field notes: VCF Management
Services Runtime](04-field-notes.md#vcf-management-services-runtime)) –
the depot needs to be in a stable, non-patching state before anything
downstream of it can proceed.

---

## Sources

- [Configure a Software Depot Connection Mode](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/connect-sddc-manager-to-a-software-depot-for-downloading-bundles.html)
- [Set Up an Offline Depot](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/set-up-an-offline-depot-web-server-for-vmware-cloud-foundation.html)
- [Download Binaries to an Offline Depot by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/download-bundles-to-an-offline-depot.html)
- [Download Binaries to Software Depot in Disconnected Mode by Using the VCF Download Tool](https://techdocs.broadcom.com/us/en/vmware-cis/vcf/vcf-9-0-and-later/9-1/lifecycle-management/binary-management-for-vmware-cloud-foundation/offline-download-of-vmware-cloud-foundation-5-2-upgrade-bundles.html)
- [VCF 9.1 - VCF Download Tool (VCFDT) Cheatsheet](https://williamlam.com/2026/05/vcf-9-1-vcf-download-tool-vcfdt-cheatsheet.html) – concrete command examples
- [VCF 9.1 - New HTTP Offline Depot Support for VCF Installer & Fleet Depot Service](https://williamlam.com/2026/05/vcf-9-1-new-http-offline-depot-support-for-vcf-installer-fleet-depot-service.html)
