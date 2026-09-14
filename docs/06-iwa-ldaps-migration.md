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
can log in. The sequence below adds a permissions backup ahead of both, since
switching identity source technology can change how existing role
assignments resolve.

1. Backup (VM snapshot + file-based backup + permissions/role export).
2. Add and verify the AD-over-LDAPS identity source, alongside the existing
   IWA one.
3. Re-point/re-verify permissions against the new identity source.
4. Remove the IWA identity source.
5. Leave the AD domain.
6. Clean up the stale AD computer object.

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

## 2. Add the AD-over-LDAPS identity source

Do this **alongside** the existing IWA source – don't remove IWA yet.

**Prerequisites:**

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

## 3. Re-verify permissions against the new identity source

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

Don't proceed to removing IWA until this reconciliation is confirmed clean.

---

## 4. Remove the IWA identity source

vSphere Client → **Administration → Configuration → Identity Sources** →
select the Active Directory (Integrated Windows Authentication) source →
**Delete**. The domain-leave step below will fail while an active IWA
identity source still exists, so this has to happen first.

---

## 5. Leave the Active Directory domain

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

## 6. Clean up Active Directory

Delete the stale computer account object left behind in Active Directory
after the domain leave completes – it doesn't clean itself up automatically
and can cause confusion (or a naming collision) if the vCenter is ever
rejoined.

---

## Rollback

If the LDAPS identity source doesn't resolve correctly after the switch and
a fix isn't quick: the VM snapshot from step 1 is the fast path back to a
known-good, IWA-joined state. The file-based backup is the fallback if the
snapshot itself is unusable. Don't leave the AD domain (step 5) until the
LDAPS identity source has been verified end-to-end – that's the point past
which rollback gets materially harder.

---

## Sources

- ["Leave the vCenter Server from Active Directory domain before proceeding" – pre-check error during VCF 9.0 upgrade (KB 373004)](https://knowledge.broadcom.com/external/article/373004/leave-the-vcenter-server-from-active-dir.html)
- [Configuring a vCenter Single Sign-On Identity Source using LDAP with SSL (LDAPS)](https://knowledge.broadcom.com/external/article/316596/configuring-a-vcenter-single-signon-iden.html)
- [Active Directory over LDAP and OpenLDAP Server Identity Source Settings](https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/active-directory-ldap-server-identity-source-settings.html)
- [Enabling secure backup and restore in the vCenter Server Appliance](https://knowledge.broadcom.com/external/article/310399/enabling-secure-backup-and-restore-in-th.html)
