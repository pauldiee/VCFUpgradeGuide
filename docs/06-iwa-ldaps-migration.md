# IWA to AD-over-LDAPS migration, with permissions backup

A companion to the [Overview](01-overview.md), expanding on the
[Phase 6 – vCenter upgrade](13-vcf-upgrade-sequence.md#phase-6--vcenter-upgrade) gotcha:
**Integrated Windows Authentication (IWA) is removed in vCenter 9.** Every
vCenter still joined to Active Directory via IWA needs to move to an
AD-over-LDAP(S) identity source (or another external IdP) and gracefully
leave the domain **before** its upgrade – the upgrade pre-check fails
otherwise (
["Leave the vCenter Server from Active Directory domain before proceeding"](https://knowledge.broadcom.com/external/article/373004/leave-the-vcenter-server-from-active-dir.html),
KB 373004). Run this per vCenter, ahead of Phase 6, not during it.

Applies whenever a vCenter uses native AD join / IWA for authentication –
typical on long-lived vSphere environments predating LDAPS-only identity
sources.

---

## Why order matters

Broadcom's own guidance is explicit: **configure and verify the replacement
identity source before leaving the domain**, not after. Leaving AD first and
figuring out LDAPS afterward risks a window where nobody with an AD account
can log in.

**That guidance assumes the replacement identity source can coexist with
IWA while it's being verified. It can't, for the common case.** vCenter SSO
does not allow two identity sources against the same Active Directory
domain at once. Attempting to add the AD-over-LDAPS source while the native
IWA source for that same domain still exists fails with **"connection
already exists"**. Per
[Broadcom KB 316596](https://knowledge.broadcom.com/external/article/316596/configuring-a-vcenter-single-signon-iden.html):
*"If an existing identity source
exists with the same domain, that identity source must be removed before
configuring an LDAPS identity source."* There is no split-brain,
add-both-then-cut-over path here – the IWA source has to come out before
LDAPS can go in.

That inverts the safe ordering Broadcom's general guidance assumes, so the
sequence below adds an explicit fallback-access check *before* the removal,
to keep a working admin login available for the (short) window where
neither IWA nor LDAPS is configured:

1. Backup (VM snapshot + file-based backup + permissions/role export).
2. Confirm a non-AD-dependent SSO admin login (`administrator@vsphere.local`)
   works, as a fallback for the gap in step 4.
3. Remove the IWA identity source.
4. Add and verify the AD-over-LDAPS identity source immediately afterward –
   this is the gap where no AD account can authenticate, so don't pause
   here.
5. Re-point/re-verify permissions against the new identity source.
6. Leave the AD domain.
7. Clean up the stale AD computer object.

If the replacement identity source is a **different** AD domain, or a
non-AD IdP, the "connection already exists" restriction doesn't apply and
Broadcom's original add-before-remove ordering works as documented –
this reordering is specifically for staying on the same Active Directory
domain, which is the common case when only the authentication method is
changing.

---

## 1. Backup, before touching anything

**VM-level snapshot.** Snapshot every vCenter node in the affected SSO
domain (all Enhanced Linked Mode members, not just the one being changed) –
offline/no-memory snapshot, per standard pre-change practice.

**vCenter file-based backup.** Via VAMI (`https://<vcenter>:5480` →
**Backup**), to a configured destination (NFS/SMB/FTP(S)) with enough
space. This captures full appliance config/inventory state, independent of
the snapshot – Broadcom's own upgrade guidance treats a valid VAMI backup as
a hard prerequisite: without one, a failed change means redeploying vCenter
from scratch. See
[Enabling secure backup and restore in the vCenter Server Appliance](https://knowledge.broadcom.com/external/article/310399/enabling-secure-backup-and-restore-in-th.html)
(KB 310399).

**Permissions/role export – the "role/rights specific backup".** Global and
per-object permissions in vCenter are keyed to the identity source's
representation of each user/group. Moving from IWA (native AD join) to
AD-over-LDAP(S) can change how those principals resolve, so capture the
current state before changing anything, to compare against (and reapply
from, if needed) afterward.

Using PowerCLI, connected to the vCenter/SSO domain in scope:

```powershell
# Per-object permissions, with the object name resolved for readability
$date = Get-Date -Format "yyyyMMdd-HHmm"
Get-VIPermission | Sort-Object Principal | Select-Object `
    @{N="ObjectName";E={(Get-View -Id $_.EntityId).Name}}, `
    EntityId, Role, IsGroup, Principal, Propagate |
  Export-Csv -Path ".\vCenter-Permissions-$date.csv" -NoTypeInformation -UseCulture

# Roles and their assigned privileges
Get-VIRole | Select-Object Name, Id, IsSystem |
  Export-Csv -Path ".\vCenter-Roles-$date.csv" -NoTypeInformation -UseCulture
foreach ($role in Get-VIRole) {
  [PSCustomObject]@{ Role = $role.Name; Privileges = ($role.ExtensionData.Privilege -join ";") }
} | Export-Csv -Path ".\vCenter-RolePrivileges-$date.csv" -NoTypeInformation -UseCulture
```

**Global permissions** (assigned at the SSO/vCenter-group level, spanning
multiple vCenters under Enhanced Linked Mode) don't come from
`Get-VIPermission` – they're managed separately through the vSphere Client's
**Administration → Global Permissions** and need their own export (script or
manual screenshot/table capture) before the change, since a cross-domain
identity source swap is exactly the scenario where global permissions are
easiest to lose track of.

Keep all exports somewhere outside the vCenter itself (they're the
reference used to verify nothing broke, and to manually reapply anything
that doesn't resolve automatically after the identity source switch).

---

## 2. Confirm a fallback admin login before removing anything

Since removing IWA (next step) and adding LDAPS can't overlap for the same
AD domain, there's a gap where no AD account can log in. Before touching
either identity source:

- Confirm `administrator@vsphere.local` (or another local SSO account, not
  AD-backed) has a known-working password and can log in to the vSphere
  Client right now.
- Confirm that account has the rights to add/remove identity sources –
  it's the account performing this whole procedure regardless, so this
  should already be true, but verify rather than assume.

This is the account carrying out steps 3 and 4 below; it's the fallback
precisely because it doesn't depend on either identity source.

---

## 3. Remove the IWA identity source

vSphere Client → **Administration → Configuration → Identity Sources** →
select the Active Directory (Integrated Windows Authentication) source →
**Delete**.

This has to happen **before** step 4 for a same-domain migration – see
[Why order matters](#why-order-matters). Move straight on to step 4 once
this completes; AD accounts cannot authenticate until the LDAPS source is
added and verified.

---

## 4. Add the AD-over-LDAPS identity source

See Broadcom TechDocs'
[Active Directory over LDAP and OpenLDAP Server Identity Source Settings](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/active-directory-ldap-server-identity-source-settings.html)
for the full field reference behind the wizard below.

**Prerequisites** (line these up *before* step 3, so this step is quick
once IWA is removed):

- The domain controller's certificate, exported and available as a `.cer`
  file. Extract it from the DC:
  ```
  openssl s_client -showcerts -connect <dc-fqdn>:636 </dev/null 2>/dev/null | openssl x509 -outform PEM
  ```
  Save the full block (`-----BEGIN CERTIFICATE-----` to
  `-----END CERTIFICATE-----`) into a `.cer` file.
- Verify LDAPS connectivity from the vCenter side (or a host that shares its
  network path) before configuring anything:
  ```
  openssl s_client -connect <dc-ip>:636
  ```
  A returned certificate means it's reachable; failure usually means a
  firewall is blocking port 636.
- The hostname used in the LDAPS URL **must** appear in the DC certificate's
  Subject Alternative Name (SAN) – this still applies even when supplying
  root certificates separately.
- The AD account used to query LDAP must not sit in a restricted group
  (e.g. **Protected Users**), and its password should not be near
  expiry/lockout – a broken query account here fails AD logins silently
  until noticed.

**Steps** (vSphere Client → **Administration → Configuration → Identity
Sources**):

1. Click **Add**, select **Active Directory over LDAP**.
2. Fill in the Add Identity Source wizard: friendly name, Base DN for users,
   Base DN for groups, Domain name, Domain alias, the query account's
   username/password, and the Primary/Secondary Server URL using
   `ldaps://` (not `ldap://`).
3. Under **Certificates (for LDAPS)**, browse to and load the `.cer` file(s)
   exported above.
4. Click **Add** to save.
5. Test-login with a known AD account through this new identity source
   before proceeding – confirm it authenticates and that its expected group
   memberships are visible in vCenter.

### Validate SSO/Lookup Service health with lsdoctor

Removing one identity source and adding another is exactly the kind of
change that can leave the **Lookup Service / vmdir** layer subtly
inconsistent even when the login test above passes – catch that now, not
after step 6 makes it harder to roll back. Per
[Broadcom KB 320837, "Using the 'lsdoctor' Tool"](https://knowledge.broadcom.com/external/article/320837/using-the-lsdoctor-tool.html):

1. Download the `lsdoctor.zip` attachment from the KB, copy it to the
   vCenter via WinSCP (or equivalent – SCP fails against the appliance's
   default shell until it's switched to bash, see [VDT and lsdoctor:
   self-service diagnostic
   tools](17-vdt-and-lsdoctor-diagnostics.md#vdt-and-lsdoctor-self-service-diagnostic-tools)),
   and unzip it:
   ```
   unzip lsdoctor.zip
   ```
2. Run the **read-only** check (`-l` / `--lscheck`) – this only reports,
   it doesn't change anything, so it's safe to run without a fresh
   snapshot beyond the one already taken in
   [step 1](#1-backup-before-touching-anything):
   ```
   python lsdoctor.py -l
   ```
3. Resolve anything it flags before moving on to step 5's permissions
   check – an unresolved Lookup Service inconsistency here will surface as
   confusing, hard-to-place permission/authentication failures later
   rather than a clean error now.

**If it does find something to fix**, lsdoctor's repair modes are more
invasive and need the same-instant-across-the-whole-SSO-domain snapshot
precaution [step 1](#1-backup-before-touching-anything)'s Enhanced Linked
Mode sequencing already follows for the pre-change backup – see [VDT and
lsdoctor: self-service diagnostic
tools](17-vdt-and-lsdoctor-diagnostics.md) for the full flag reference,
the exact snapshot and service-restart impact, and a field-observed
failure example.

---

## 5. Re-verify permissions against the new identity source

Compare live permissions against the exports from step 1:

- Confirm the accounts/groups that had permissions under the IWA identity
  source resolve identically under the new AD-over-LDAPS source (same
  `DOMAIN\principal` representation is the common case, but don't assume –
  verify, especially for group-based role assignments).
- Anything that shows as an orphaned/unresolvable principal after the
  switch needs to be manually reapplied against the new identity source,
  using the exported CSVs as the source of truth for what the assignment
  should be.
- Re-check Global Permissions specifically – they're the easiest thing to
  silently break in a cross-vCenter (Enhanced Linked Mode) setup, since
  they're not visible in a plain `Get-VIPermission` sweep.

Don't proceed to leaving the AD domain until this reconciliation is
confirmed clean.

---

## 6. Leave the Active Directory domain

**Error: `Idm client exception: Error trying to leave AD, error code [11]`,
followed by the username entered.** Field-verified verbatim. Per
[Broadcom KB 399350](https://knowledge.broadcom.com/external/article/399350/error-idm-client-exception-error-trying.html)
(documented for the *join* side, same `error code [11]` and same
`Idm client exception` source), the cause is an **unsupported username
format**, not a missing permission: *"The failure was due to the incorrect
username format used during the domain join operation."* Specifically,
*"Down-level login name format, for example, DOMAIN\UserName, is
unsupported in 8.x."* Supply the account as **`user@domain` (UPN format)**
in the Leave AD dialog, not `DOMAIN\user`, and retry. KB 399350 documents
this for the join operation; field-confirmed here that the same cause and
fix apply to leave as well.

**If UPN format doesn't resolve it**, two rights layers still apply and are
worth checking next:

- **vCenter-side:** the account logged in to perform the leave must be a
  member of the **SystemConfiguration.Administrators** group in vCenter
  Single Sign-On (per Broadcom TechDocs'
  [Join or Leave an Active Directory Domain](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vcenter-configuration/configuring-vcenter-server-using-the-vsphere-client/join-or-leave-an-active-directory-domain.html)
  prerequisites).
- **AD-side:** the AD account *supplied to the Leave AD dialog* needs
  delegated rights over the vCenter computer object, specifically the
  ability to **delete** it.
  [Broadcom KB 322859](https://knowledge.broadcom.com/external/article/322859/joining-vcenter-server-appliance-or-esxi.html)
  (covering the join-side LDAP permission errors) lists Microsoft's minimally required delegated
  permissions for this class of operation, which include **"Create and
  Delete Computer objects"** on the target OU – leaving the domain only
  needs the delete half. Check with the customer's AD team what OU the
  computer object lives in and whether the account being used has
  delegated control there, rather than assuming a Domain Admins-equivalent
  account will always work (some environments deliberately restrict even
  that).

**Via the vSphere Client:**

1. **Administration → Single Sign On → Configuration → Identity Provider**
   tab → **Active Directory Domain**.
2. Click **Leave AD**, supply AD credentials **in UPN format
   (`user@domain`)** with rights to remove the computer object, confirm –
   see the error note above if `DOMAIN\user` format was tried first.
3. Restart vCenter Server.

**CLI fallback**, if the UI method fails (SSH to the vCenter appliance as
root):

```
/opt/likewise/bin/domainjoin-cli query

# Credentialed - reaches AD, disables the computer object there (recommended)
/opt/likewise/bin/domainjoin-cli leave <username> <password>

# Bare - local disjoin only, does NOT contact AD, leaves the computer
# object live and enabled (see warning below - avoid unless that's intended)
/opt/likewise/bin/domainjoin-cli leave
```

**`leave` takes no domain-name argument** – unlike `join`, it only
optionally takes `[username [password]]` (confirm the domain it will
leave with the `query` command above first, not by passing one to
`leave`).

**The credentials are not optional if the AD-side object matters.**
Running `domainjoin-cli leave` completely bare, with **no arguments at
all**, disjoins the appliance locally **without contacting AD** –
**field-verified**, observed happening exactly this way on a live
vCenter. Per the `domainjoin-cli` man page: *"If no credentials are
specified, the machine will no longer behave as a member of domain but
its machine account will remain enabled in AD."* That silently leaves a
live, enabled computer object behind in AD, which is worse than a merely
stale one. Supply UPN-format credentials (same requirement as the UI
method above) as the two trailing arguments so the CLI actually reaches
AD instead of disjoining blind. Even then, the man page only promises the
account gets **disabled**, not deleted – step 7 below is still required
regardless of which method was used.

Restart vCenter Server afterward either way.

> Never leave the identity source at "N/A" or blank as an intermediate
> state – ensure the AD-over-LDAPS source (or another external IdP) is
> already configured and verified working *before* this step, per the
> ordering above.

---

## 7. Clean up Active Directory

Delete the computer account object left behind in Active Directory after
the domain leave completes. This is required regardless of method – the UI
path and a credentialed CLI leave both stop at *disabling* the account at
best, and a bare CLI leave (no credentials) doesn't touch the AD side at
all, leaving it live. An orphaned object doesn't clean itself up
automatically and can cause confusion (or a naming collision) if the
vCenter is ever rejoined.

---

## Rollback

If the LDAPS identity source doesn't resolve correctly after the switch and
a fix isn't quick: the VM snapshot from step 1 is the fast path back to a
known-good, IWA-joined state. The file-based backup is the fallback if the
snapshot itself is unusable. This covers the gap between steps 3 and 4 as
well – if adding LDAPS fails outright, restoring the snapshot re-creates the
IWA source rather than leaving the vCenter with no working AD
identity source.

Don't leave the AD domain (step 6) until the LDAPS identity source has been
verified end-to-end – that's the point past which rollback gets materially
harder, since it changes state in AD itself (the computer object) that a
vCenter-side snapshot restore doesn't undo.

---

## Sources

- ["Leave the vCenter Server from Active Directory domain before proceeding" – pre-check error during VCF 9.0 upgrade (KB 373004)](https://knowledge.broadcom.com/external/article/373004/leave-the-vcenter-server-from-active-dir.html)
- ["Idm client exception: Error trying to join AD, error code [11]" – down-level username format cause, field-confirmed to also apply on leave (KB 399350)](https://knowledge.broadcom.com/external/article/399350/error-idm-client-exception-error-trying.html)
- ["Joining vCenter Server Appliance or ESXi host into Active Directory domain fails with error: LW_ERROR_LDAP_CONSTRAINT_VIOLATION or LW_ERROR_LDAP_INSUFFICIENT_ACCESS" – required AD delegated permissions (KB 322859)](https://knowledge.broadcom.com/external/article/322859/joining-vcenter-server-appliance-or-esxi.html)
- [Configuring a vCenter Single Sign-On Identity Source using LDAP with SSL (LDAPS)](https://knowledge.broadcom.com/external/article/316596/configuring-a-vcenter-single-signon-iden.html)
- [Active Directory over LDAP and OpenLDAP Server Identity Source Settings](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/active-directory-ldap-server-identity-source-settings.html)
- [Enabling secure backup and restore in the vCenter Server Appliance](https://knowledge.broadcom.com/external/article/310399/enabling-secure-backup-and-restore-in-th.html)
- ["Using the 'lsdoctor' Tool" (KB 320837)](https://knowledge.broadcom.com/external/article/320837/using-the-lsdoctor-tool.html) – SSO / Lookup Service / vmdir validation and repair, used in step 4
- [domainjoin-cli(8) man page](https://man.cx/domainjoin-cli(8)) – upstream Likewise/PBIS tool docs (not Broadcom-specific), source for the credentials-required-to-touch-AD behavior in step 6's CLI fallback
