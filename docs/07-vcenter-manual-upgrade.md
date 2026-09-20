# vCenter manual GUI upgrade (no Fleet Management)

The vCenter upgrade step in the core sequence ([Phase 6](13-vcf-upgrade-sequence.md#phase-6--vcenter-upgrade))
assumes the fleet-managed path: vCenter is upgraded from **VCF Operations →
Fleet Management**, and the installer-UI path is deprecated for that case.

This doc covers the other case: a **standalone / not-fleet-managed** vCenter
(see [Fleet-managed VVF vs. standalone VVF](14-standalone-vvf-upgrade.md#fleet-managed-vvf-vs-standalone-vvf))
where there is no SDDC Manager or Fleet Management layer driving the
upgrade. There, vCenter is upgraded the traditional way, from its own
**two-stage GUI installer** or the **CLI installer** – see
[Not VAMI](#not-vami-a-common-mix-up) below for why the appliance's own
VAMI isn't a third option here, despite looking like it should be. Same
underlying two-stage migration mechanism as the fleet-driven path, just
triggered manually.

---

## Not VAMI – a common mix-up

**VAMI (`https://<vcenter>:5480`, root login) does not drive a version
upgrade of any kind – major or RDU.** It's easy to assume otherwise, since
VAMI is *also* where routine **patching** happens and vSphere 9.1 added
"vCenter quick patch" there too, but neither of those is a version upgrade:

- **A major upgrade** (crossing a major version boundary, e.g. 8.x → 9.x)
  only has two supported paths per Broadcom TechDocs' [Upgrading the
  vCenter Appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-0/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance.html)
  landing page: *"The vCenter installer contains executable files for both
  GUI and CLI upgrades which you can use alternatively."* VAMI isn't listed
  as a third option anywhere on that page or its sub-pages.
- **RDU** (see [Stage 1/2 below](#stage-2--migrate-data-and-cut-over)) is
  driven from the **vSphere Client**'s **Update Planner** – vCenter →
  **Updates** → **vCenter Server** → **Update Planner** – logged in with
  SSO credentials, not VAMI's root login. Broadcom KB 313288 treats RDU and
  VAMI as two genuinely separate lifecycle mechanisms, warning explicitly
  against touching both at once: *"Users should not use Reduced downtime
  upgrade and VAMI at the same time... This may interfere with already
  running lifecycle events and may lead to a corrupt vCenter Server"* and
  *"If the ISO is mounted from the Reduced downtime upgrade workflow, VAMI
  ... should not be used to upgrade the vCenter Server."* That warning only
  makes sense because they're different interfaces driving different
  processes – if VAMI itself performed RDU, there'd be nothing to warn
  against running "at the same time."
- **vCenter quick patch** (new in 9.1, run from VAMI) is scoped to
  *security patches*, not version upgrades – Broadcom's own "what's new"
  material for it is explicit that it *"targets rapid deployment of
  important security fixes,"* not major or minor version jumps.

VAMI's legitimate role in an upgrade is limited to **naming and first-boot
config of the new appliance** ([Stage 1 below](#stage-1--deploy-the-new-911-appliance))
and to routine within-major-version patching – not to starting or driving
the upgrade itself.

---

## Before you start: confirm the source is actually on a supported path

Do not assume "any 8.x can reach any 9.1.x" – the same **back-in-time**
restriction called out in [Confirm a supported upgrade path](01-overview.md#confirm-a-supported-upgrade-path)
applies to vCenter itself, patch level by patch level.

Checked against the **Broadcom Product Interoperability Matrix** (Upgrade
Path tool, vCenter, "Hide Patch Releases" unticked) and **KB 448135**
("Back-in-Time Upgrade Restriction for vSphere 8.0 Update 3j and later, NSX
4.2.4 and later, VMware Cloud Foundation 9.1.0.x"):

- **vCenter 8.0 U3j and later → any 9.1.0.x build or 9.0.x build: blocked.**
  The security patches in those U3j+ builds are chronologically newer than
  the 9.1.0.x / 9.0.x baseline, so upgrading would regress fixes – VCF
  refuses the path outright.
- **vCenter 8.0 U3j and later → 9.1.1.0: open.** KB 448135, verbatim: *"VMware
  Cloud Foundation 9.1.1.0 has been released with an updated Bill of
  Materials (BOM) that includes component build versions chronologically
  newer than the previous 9.1.0.0 restriction baseline. This effectively
  resolves the 'Back-in-Time' upgrade block for environments running vSphere
  8.0 Update 3j and later, NSX 4.2.4 and later, VMware Cloud Foundation
  9.1.0.x."*
- Confirmed directly in the Upgrade Path tool: vCenter 8.0U3k shows
  **green / Compatible** against target 9.1.1.0, and **red / Incompatible**
  against every 9.1.0.x and 9.0.x build.

This is the same pattern as the VCF Operations 8.18.7 example already in
the overview doc – a patch released after a given target build's baseline
can lose its path to that build entirely, and only a later point release
(here, 9.1.1) reopens it. **Re-run the Upgrade Path tool for the exact
source build before committing to a target** – do not extrapolate from a
neighbouring patch level.

> **One open question this doc cannot resolve from documentation alone.**
> The vSphere 9.1 TechDocs page for the GUI installer path is titled
> *"Upgrade a vCenter Appliance 9.0 or later by Using the GUI"* and states
> only that 9.0-or-later is a supported source for that installer flow – it
> does not mention 8.0 anywhere. That is inconsistent with the
> interoperability matrix and KB 448135 above, both of which say 8.0U3j+ is
> fine as a source once 9.1.1 is the target. Until this is confirmed with
> Broadcom support or observed on a real run, treat the matrix and the KB as
> the more current sources – but validate against a non-production vCenter,
> or open a support request, before doing this on a production appliance.

---

## Prerequisites

From [Prerequisites for Upgrading the vCenter Appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance/prerequisites-for-upgrading-the-appliance.html),
condensed:

- Download and mount the vCenter 9.1.1 installer.
- Sync clocks across the vSphere network.
- Target ESX host (where the *new* appliance deploys): not in lockdown or
  maintenance mode. If it sits in a DRS cluster, set DRS to **Manual** or
  **Partially Automated** so nothing reboots mid-upgrade.
- Source appliance: port **22** open (the upgrade process opens an inbound
  SSH connection to export data) and port **443** open on the source ESX
  host.
- Sufficient free disk space on the source appliance to stage the export.
- **Take an image-based backup (snapshot) of the source vCenter first** –
  TechDocs calls this out explicitly as the rollback path if the upgrade
  fails. In an Enhanced Linked Mode environment, power off every vCenter
  node, back up each one, then restart them all before proceeding.
- Static-IP path: forward and reverse DNS records ready for the temporary
  IP. DHCP path: the target ESX host must be on the same subnet as the
  source, on a port group that accepts MAC address changes.

---

## Before Stage 1: rename the old vCenter appliance

Stage 1 step 5 names the *new* appliance – and by default that's the only
naming decision in the whole flow, since the new appliance takes over the
old one's IP and FQDN at cutover rather than its display name. Rename the
**old** vCenter appliance (VM name in the inventory, and its own appliance
name if surfaced in VAMI) to something clearly marking it as the outgoing
instance – for example appending `-old` or the source build number – before
starting Stage 1. Do this as normal procedure, not an afterthought:

- It lets the new appliance be named correctly – the actual destination
  name – from the moment it's deployed in Stage 1 step 5, instead of
  deploying it under a throwaway name and renaming it after cutover.
- It avoids two identically-named vCenter objects existing side by side
  once the new appliance is up (the old one stays powered off but
  undeleted per [After cutover](#after-cutover), so the name collision
  would otherwise persist until it's cleaned up).

---

## Stage 1 – deploy the new 9.1.1 appliance

From [Stage 1 – Deploy the OVA File of the New vCenter Appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance/gui-upgrade-of-the-vcsa-and-psc-appliance/upgrade-the-vmware-vcenter-server-appliance-with-embedded-sso/stage-1-deploy-ova-file-of-new-vcenter-server-appliance-with-embedded-platform-services-controller.html):

1. From the mounted installer, run `vcsa-ui-installer/<your-OS>/installer`
   (`win32\installer.exe`, `lin64\installer`, or `mac/Installer.app`).
2. Home page → **Upgrade**. Read the Introduction, **Next**. Accept the
   EULA, **Next**.
3. **Connect to source appliance**: source FQDN or IP, HTTPS port (443
   unless custom), the SSO administrator username (`administrator@your_domain`)
   and password, and the source appliance's **root** password. Accept the
   SSL thumbprint prompt.
4. **Connect to target**: where the new appliance deploys – either an ESX
   host directly, or a vCenter instance (browse to a datacenter, then an
   ESX host or DRS cluster). This target must be a *different* vCenter than
   the one being upgraded – use the ESX host directly if there is only one
   vCenter in the environment.
5. Name the new appliance and set its **root** password. Note: the old
   appliance's root password is **not** carried over to the new one.
6. Pick a deployment size (Tiny / Small / Medium / Large / X-Large) to
   match the environment, then a storage size (Default / Large / X-Large).
7. Pick the datastore, optionally enabling thin provisioning.
8. Configure the **temporary network** – a network reachable from both
   appliances, static or DHCP, IPv4 or IPv6. This is throwaway; the new
   appliance takes over the old one's real IP and FQDN at the end of Stage 2.
9. Review, **Finish** to start the OVA deployment, then **Continue** into
   Stage 2. (Clicking **Close** instead leaves the new appliance deployed
   but unconfigured – no data transferred, no services started – and Stage
   2 has to be resumed from the new appliance's own VAMI.)

### Troubleshooting: "invalid single sign-on credentials" at step 3

Step 3 ("Connect to source appliance") can reject correct credentials with a
generic invalid-SSO-credentials error. Work through these in order – each
rules out a distinct failure mode, and the error text is identical for all
of them, so don't stop at the first plausible-sounding cause without
actually checking it:

1. **Confirm the credentials really are correct, outside the installer.**
   Log in to the source vCenter's own UI with the same root and SSO admin
   credentials being entered in the wizard.
2. **Clock skew** between the machine running the installer and the source
   appliance. SSO token validation is time-sensitive – a few minutes of
   drift produces this exact error even with a correct password. Compare
   `date` output on both.
3. **IP vs FQDN against the Machine SSL certificate's SAN.** If the source
   is entered as an IP address but the cert's SAN only covers the FQDN (or
   vice versa), SSO auth fails on the mismatched form even though
   connectivity and the thumbprint-acceptance step both pass. Try the other
   form.
4. **Custom SSO domain suffix.** Do not assume `vsphere.local` – confirm
   the actual domain under **Administration → Single Sign-On →
   Configuration** on the source vCenter and use `administrator@<that
   domain>` exactly. **This was the confirmed cause in a field-verified
   case** – a customized domain suffix typed incorrectly, with reachability,
   the cert thumbprint, root, and the SSO password all independently correct
   and no clock skew present.
5. **Account lockout.** Check **Administration → Single Sign-On →
   Configuration → Lockout Policy** – prior failed attempts (including the
   installer's own retries) can lock the account even though the password
   being tested now is correct.
6. **Credential entry artifacts.** Retype the password by hand instead of
   pasting, in case of trailing whitespace or a hidden character from a
   password manager.
7. **Read the actual rejection reason from the source appliance's own
   logs**, rather than continuing to guess from outside it:
   ```
   ssh root@<source-appliance>
   grep -i "invalid credential\|authentication fail\|lockout" /var/log/vmware/sso/vmware-identity-sts.log
   ```
   Also check `/var/log/vmware/vmdird/vmdird-syslog.log` for the same
   timestamp. The STS log records the real reason (locked account, wrong
   domain, genuine bad password, etc.) behind the wizard's generic message.

---

## Stage 2 – migrate data and cut over

From [Stage 2 – Transfer the Data and Set up the Newly Deployed vCenter Appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance/gui-upgrade-of-the-vcsa-and-psc-appliance/upgrade-the-vmware-vcenter-server-appliance-with-embedded-sso/stage-2-transfer-data-to-new-vcenter-server-appliance-with-embedded-platform-services-controller.html):

1. Reconnect to the source appliance (same credentials as Stage 1).
2. Reconnect to the source ESX host or vCenter (same admin credentials).
3. Wait for the **pre-upgrade check** – it runs only after both
   reconnections above complete. This is where a back-in-time or
   interoperability block, if there is one, is most likely to surface –
   fix any reported errors before continuing. If the SSO credentials
   entered in Stage 1 were wrong, this is also where that authentication
   error shows up.
4. **Select migration data** – configuration only (fastest, least storage)
   versus configuration plus historical and performance data (slower).
   With an external Oracle database, historical/performance data can
   instead be migrated in the background after the new appliance starts.
5. CEIP opt-in choice.
6. **Ready to complete** – review the settings, accept the backup
   acknowledgment, **Finish**.
7. Acknowledge the shutdown warning – the source appliance is powered off
   at this point.
8. Wait for the data transfer and service startup to finish, then **OK**
   to reach the new vCenter's Getting Started page.

---

## Alternative: CLI-driven upgrade using the OVA directly (vcsa-deploy)

Stages 1 and 2 above are the interactive `vcsa-ui-installer` GUI wizard.
The same mounted ISO also ships a **CLI installer** that drives the
identical two-stage deploy-then-migrate process unattended, from a JSON
template that points straight at the appliance's OVA file – useful for
scripting or repeating the same upgrade across several vCenter instances.

> **This is not the same thing as manually running "Deploy OVF Template" in
> the vSphere Client.** Broadcom's upgrade TechDocs for 9.1 document only the
> GUI wizard and this CLI installer as supported upgrade methods – there is
> no documented upgrade path that has you drive the vSphere Client's own OVF
> deployment wizard against the ISO's OVA yourself. (Deploying that OVA
> straight through the vSphere Client is a real, supported procedure, but
> it's the **fresh-install** flow – a brand-new, empty appliance configured
> through its own first-boot VAMI wizard – not an upgrade that migrates an
> existing vCenter's inventory and config across.) The CLI installer covered
> here is the closest supported "point it at the OVA file" alternative to
> the GUI wizard.

1. From the mounted installer, the JSON templates live in
   `vcsa-cli-installer/templates/upgrade/`. Copy the template matching the
   source topology (embedded SSO, external PSC, HA cluster, etc.) and edit
   it in a JSON-aware editor.
2. Point the template's `image` field at the appliance OVA shipped in the
   ISO's `vcsa/` folder, for example:
   ```json
   "image": "G:\\vcsa\\VMware-vCenter-Server-Appliance-9.1.1.XXXX-YYYYYYY_OVF10.ova"
   ```
   The CLI installer reads this JSON and generates an `ovftool` command
   internally to deploy that exact OVA – there's no separate manual OVF
   step to perform.
3. Fill in the same information Stage 1/Stage 2 ask for interactively:
   source appliance and SSO credentials, target ESX host or vCenter,
   temporary network, new appliance name/root password, deployment and
   storage size, and migration-data scope.
4. **All values ASCII-only** – the CLI machine's own username, the path to
   the installer, the path to the JSON file, and every string value inside
   it (passwords included). Extended ASCII / non-ASCII characters are
   unsupported and fail the run.
5. Run the CLI machine (Windows, Linux, or Mac) from the same network as
   the appliance being upgraded:
   ```
   vcsa-deploy upgrade --verify-template-only path_to_the_json_file
   vcsa-deploy upgrade --precheck-only path_to_the_json_file
   vcsa-deploy upgrade --accept-eula --acknowledge-ceip --log-dir=path_to_the_location path_to_the_json_file
   ```
   `--verify-template-only` validates the JSON without deploying anything;
   `--precheck-only` runs the same pre-upgrade check Stage 2 waits on
   interactively, without proceeding to migration – useful to catch a
   back-in-time or interoperability block before committing.
6. Same outcome as the GUI path: the old appliance is powered off once
   migration starts, the new one takes over its IP/FQDN, and the same
   [After cutover](#after-cutover) steps below apply.

Broadcom reference: [Upgrade a vCenter Appliance by Using the CLI](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance/cli-upgrade-of-vcenter-server-and-platform-services-controllers-instances/upgrade-vcenter-server-appliance-using-the-cli.html).

---

## After cutover

- The new 9.1.1 appliance now holds the old appliance's IP and FQDN; the
  old appliance is powered off but not deleted – keep it as the rollback
  position until the upgrade is verified. **This rollback path only exists
  because this upgrade method deploys a brand-new appliance** – it's not
  available for an in-place, single-appliance mechanism with no separate
  "old" VM left behind to power back on.
- **Don't power the old appliance back on without disconnecting its network
  adapter first.** For the fleet-managed **RDU** path specifically,
  Broadcom KB 313288 documents this as destructive, not just risky: *"if
  powered on, deletes the target VM"* – i.e. powering the old appliance
  back on while still network-connected deletes the **new** one, the
  opposite of what a rollback is for. **This doc's plain GUI/CLI two-stage
  upgrade isn't explicitly covered by that KB** (it only discusses RDU),
  but since this doc's own intro describes it as *"the same underlying
  two-stage migration mechanism"* – treat the same precaution as the safe
  default here too, rather than assuming it doesn't apply: disconnect the
  old appliance's network adapter before powering it back on for any
  reason, roll back or otherwise. If a rollback is actually being
  executed (not just testing), power off the new appliance first as well,
  so both aren't live on the network with the same IP/FQDN at once.
- If the old appliance used a **non-ephemeral distributed virtual port
  group**, reconnect the new appliance to it manually – that setting is not
  carried over automatically when deploying straight to an ESX host (not a
  limitation when deploying through a vCenter instance instead).
- Continue with the rest of the [Standalone VVF manual upgrade](14-standalone-vvf-upgrade.md#standalone-vvf-manual-upgrade--exact-steps)
  steps (ESX hosts, vSAN on-disk format, vSAN File Service) as applicable,
  and its [Post-upgrade validation](14-standalone-vvf-upgrade.md#post-upgrade-validation)
  checklist.
- This is a single vCenter, not Enhanced Linked Mode – the multi-node
  backup/restart sequencing called out for ELM environments in the
  prerequisites does not apply here.

Broadcom reference: [About the Upgrade Process of the vCenter appliance](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/9-1/vcenter-upgrade/upgrading-and-updating-the-vcenter-server-appliance/about-the-vcenter-server-appliance-upgrade-process.html);
KB 448135; [KB 313288](https://knowledge.broadcom.com/external/article/313288/vcenter-server-upgrades-with-the-reduced.html)
(old-appliance network-disconnect warning, documented for RDU); the
Broadcom Product Interoperability Matrix, Upgrade Path tool.
