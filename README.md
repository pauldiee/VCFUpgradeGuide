# VCFUpgradeGuide

**ITQ.** General guidance for planning a **VCF upgrade** – pre-upgrade
checks, the upgrade sequence, and post-upgrade validation – applicable
regardless of underlying hardware. Hardware/HCI-specific extra steps
(currently: **Dell VxRail**) are layered on top as their own addendum, not
baked into the general flow.

Live at **[docs.hollebollevsan.nl](https://docs.hollebollevsan.nl)** – the
first section of a general VMware docs site; future guides need not be
upgrade-specific or VCF-specific.

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

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `docs/01-overview.md` | General VCF upgrade guidance (work in progress)      |

### Guides, grouped by where they slot into the flow

The `docs/NN-` file numbers are stable identifiers (linked from across the
repo), not a reading order. The site sidebar mirrors these bands. **Applies
to** follows the VCF/VVF split from `01-overview.md`'s
["VVF: confirm whether VCF Management Services is even in scope"](docs/01-overview.md#vvf-confirm-whether-vcf-management-services-is-even-in-scope) –
most guides work for either licensing model, some are scoped to one.

**Pre-upgrade prep** – done before the core sequence, or before a specific
phase:

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/02-disaster-recovery.md` | SRM / vSphere Replication to VCF Protection and Recovery, before core Phase 3 | VCF, VVF, or pre-9 vSphere |
| `docs/06-iwa-ldaps-migration.md` | IWA to AD-over-LDAPS migration, before Phase 6, with a permissions/roles backup | VCF or VVF |

**Phase guides** – detail for a specific core-sequence phase:

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/05-operations-modernization.md` | Aria Operations to VCF Operations (Phase 1): in-place vs. fresh install, re-IP, HA setup, vCenter integrations | VCF or VVF |
| `docs/07-vcenter-manual-upgrade.md` | Manual GUI upgrade of a standalone vCenter (Phase 6 alternate path, no Fleet Management), plus the vCenter-specific back-in-time compatibility check | **VVF only** (no VCF Management Services) |

**Post-upgrade:**

| Path              | Purpose                                                | Applies to |
| ----------------- | ------------------------------------------------------- | ---------- |
| `docs/03-identity-broker-migration.md` | VIDM / Workspace ONE Access to VCF Identity Broker, after core (or before Phase 1 for the 9.0.x source case) | **VCF only** (needs VCF Management Services) |

**Reference:**

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `docs/04-field-notes.md` | Known issues and gotchas from real upgrades |

**Hardware addenda:**

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps (work in progress) |

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
