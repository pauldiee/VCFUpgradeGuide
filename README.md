# VCFUpgradeGuide

**ITQ.** General guidance for planning a VMware upgrade, split into three
tracks depending on what's actually driving the fleet:

- **Full VCF** – SDDC Manager / VCF Management Services / Fleet Management
  drives the upgrade.
- **Standalone VVF** (VMware vSphere Foundation, no VCF Management
  Services) – vCenter/ESXi patched via standard vSphere lifecycle
  mechanisms.
- **Standalone vSphere** – no VCF or VVF entitlement at all. Broadcom
  documents the same procedure as standalone VVF for this case, so
  [`docs/12-vsphere-standard-upgrade.md`](docs/12-vsphere-standard-upgrade.md)
  points into that rather than inventing a separate one. Not yet on the
  live site (no landing page or nav entry) since there's nothing distinct
  to show for it yet.

Each track covers pre-upgrade checks, the upgrade sequence, and
post-upgrade validation – applicable regardless of underlying hardware.
Hardware/HCI-specific extra steps (currently: **Dell VxRail**, full VCF
only) are layered on top as their own addendum, not baked into the general
flow.

Live at **[docs.hollebollevsan.nl](https://docs.hollebollevsan.nl)** – the
first section of a general VMware docs site; future guides need not be
upgrade-specific or VCF-specific. The site's `/vcf/` and `/vvf/` landing
pages route to the docs relevant to each track (`/vsphere/` pending).

## Related repo

**[VCF9-DeploymentPlanning](https://github.com/pauldiee/VCF9-DeploymentPlanning)**
(public) is the from-scratch deployment-planning field guide this repo's
site scaffolding was seeded from. It also holds foundational VCF9 knowledge
that's directly useful during an upgrade – check there rather than
duplicating it here:

- `docs/13-shutdown-startup.md` – the ordered fleet shutdown/startup runbook
- `docs/07-firewall-ports.md` – firewall flows by zone
- `docs/prerequisites.md` – environment prerequisites, incl. certificate authority setup
- `docs/12-sso-configuration.md` – fleet SSO / Identity Broker
- `docs/16-remove-components.md` – cleanly removing/reinstalling optional Day-N components

## Contents

### The spine

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/01-overview.md` | General VCF/VVF upgrade guidance (work in progress) | VCF, VVF, or standalone vSphere |
| `docs/12-vsphere-standard-upgrade.md` | Standalone vSphere track landing doc – points at the standalone-VVF procedure rather than duplicating it | **Standalone vSphere only** |

### Guides, grouped by where they slot into the flow

The `docs/NN-` file numbers are stable identifiers (linked from across the
repo), not a reading order. The site sidebar mirrors these bands; the
site's `/vcf/`, `/vvf/`, `/vsphere/` landing pages filter by track instead.
**Applies to** follows the three-track split described above – most
guides work for more than one track, some are scoped to one.

**Pre-upgrade prep** – done before the core sequence, or before a specific
phase:

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/02-disaster-recovery.md` | SRM / vSphere Replication to VCF Protection and Recovery, before core Phase 3 | VCF, VVF, or standalone vSphere |
| `docs/06-iwa-ldaps-migration.md` | IWA to AD-over-LDAPS migration, before Phase 6, with a permissions/roles backup | VCF, VVF, or standalone vSphere |
| `docs/08-vss-to-vds-migration.md` | VSS to VDS migration, before extending a standalone VVF fleet to full VCF | **VVF only** (extending to full VCF) |

**Phase guides** – detail for a specific core-sequence phase:

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/05-operations-modernization.md` | Aria Operations to VCF Operations (Phase 1): in-place vs. fresh install, re-IP, HA setup, vCenter integrations | VCF or VVF |
| `docs/07-vcenter-manual-upgrade.md` | Manual GUI upgrade of a standalone vCenter (Phase 6 alternate path, no Fleet Management), plus the vCenter-specific back-in-time compatibility check | VVF or standalone vSphere (no VCF Management Services) |
| `docs/09-avi-license-hub-upgrade.md` | Avi Load Balancer + License Hub upgrade, before SDDC Manager | VCF or VVF, if Avi is in use |
| `docs/10-nsx-edge-finalize.md` | NSX Edge cluster upgrade and NSX finalize (replaces the plain Phase 8), after the host phase | VCF or VVF, if NSX is in use |
| `docs/11-log-management-migration.md` | VCF Operations for Logs migration to Log Management 9.1, after NSX finalize | VCF or VVF |

**Post-upgrade:**

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/03-identity-broker-migration.md` | VIDM / Workspace ONE Access to VCF Identity Broker, after core (or before Phase 1 for the 9.0.x source case) | **VCF only** (needs VCF Management Services) |

**Reference:**

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `docs/04-field-notes.md` | Known issues and gotchas from real upgrades |

**Hardware addenda:**

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps (work in progress) | **VCF only** (SDDC Manager ↔ VxRail Manager) |

### Other

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `reference/`      | Pinned reference material                                |
| `tools/`          | Helper scripts, if any get added                         |
| `web/`            | ITQ-branded Astro site rendering `docs/` in place        |

## Web version

Published at **docs.hollebollevsan.nl** via GitHub Pages
(`.github/workflows/pages.yml`); also mirrored to an internal GitLab Pages
instance (`.gitlab-ci.yml`) for ITQ-internal use. To run it locally:

```
cd web
npm install
npm run dev
```

Each doc page has a **Print / Save as PDF** button – it calls the
browser's own print dialog against that doc, using the site's print
styling, so choosing "Save as PDF" there gives a proper, correctly-paginated
PDF of just that doc.

For a locally-generated file covering the whole guide instead (e.g. to
email one without sending a link), build a combined PDF:

```
cd web
npm run pdf
```

Writes `web/dist-pdf/vcf-upgrade-guide.pdf` (not committed – generated
on demand).

## Author

Paul van Dieen

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
