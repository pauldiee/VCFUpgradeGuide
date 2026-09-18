# IWA to AD-over-LDAPS migration, with permissions backup

A companion to the [Overview](01-overview.md), expanding on the
[Phase 6 – vCenter upgrade](01-overview.md#phase-6--vcenter-upgrade) gotcha:
**Integrated Windows Authentication (IWA) is removed in vCenter 9.** Every
vCenter still joined to Active Directory via IWA needs to move to an
AD-over-LDAP(S) identity source (or another external IdP) and gracefully
leave the domain **before** its upgrade. Run this per vCenter, ahead of
Phase 6, not during it.

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
already exists"**. Per Broadcom KB 316596: *"If an existing identity source
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
from scratch.

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

**Required rights – two separate layers, both needed:**

- **vCenter-side:** the account logged in to perform the leave must be a
  member of the **SystemConfiguration.Administrators** group in vCenter
  Single Sign-On (per Broadcom TechDocs' Join/Leave AD Domain
  prerequisites).
- **AD-side:** the AD account *supplied to the Leave AD dialog* needs
  delegated rights over the vCenter computer object, specifically the
  ability to **delete** it. Broadcom KB 322859 (covering the join-side
  LDAP permission errors) lists Microsoft's minimally required delegated
  permissions for this class of operation, which include **"Create and
  Delete Computer objects"** on the target OU – leaving the domain only
  needs the delete half, but that's the specific right that's usually
  missing.
- **"Unable to leave: insufficient rights"** points at the second layer,
  not the first – a fully-privileged vCenter SSO admin can still hit this
  if the *AD* account entered in the dialog lacks delegated
  create/delete-computer-object rights on the OU holding the vCenter's
  computer account. Check with the customer's AD team what OU the
  computer object lives in and whether the account being used has
  delegated control there, rather than assuming a Domain Admins-equivalent
  account will always work (some environments deliberately restrict even
  that).

**Via the vSphere Client:**

1. **Administration → Single Sign On → Configuration → Identity Provider**
   tab → **Active Directory Domain**.
2. Click **Leave AD**, supply AD credentials with rights to remove the
   computer object, confirm.
3. Restart vCenter Server.

**CLI fallback**, if the UI method fails (SSH to the vCenter appliance as
root):

```
/opt/likewise/bin/domainjoin-cli query
/opt/likewise/bin/domainjoin-cli leave <DomainName.com>
```

Restart vCenter Server afterward either way.

> Never leave the identity source at "N/A" or blank as an intermediate
> state – ensure the AD-over-LDAPS source (or another external IdP) is
> already configured and verified working *before* this step, per the
> ordering above.

---

## 7. Clean up Active Directory

Delete the stale computer account object left behind in Active Directory
after the domain leave completes – it doesn't clean itself up automatically
and can cause confusion (or a naming collision) if the vCenter is ever
rejoined.

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
- ["Joining vCenter Server Appliance or ESXi host into Active Directory domain fails with error: LW_ERROR_LDAP_CONSTRAINT_VIOLATION or LW_ERROR_LDAP_INSUFFICIENT_ACCESS" – required AD delegated permissions (KB 322859)](https://knowledge.broadcom.com/external/article/322859/joining-vcenter-server-appliance-or-esxi.html)
- [Configuring a vCenter Single Sign-On Identity Source using LDAP with SSL (LDAPS)](https://knowledge.broadcom.com/external/article/316596/configuring-a-vcenter-single-signon-iden.html)
- [Active Directory over LDAP and OpenLDAP Server Identity Source Settings](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/active-directory-ldap-server-identity-source-settings.html)
- [Enabling secure backup and restore in the vCenter Server Appliance](https://knowledge.broadcom.com/external/article/310399/enabling-secure-backup-and-restore-in-th.html)
