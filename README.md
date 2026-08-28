# VCFUpgradeGuide

**ITQ Consulting Services – internal, private.** General guidance for
planning a **VCF upgrade** – pre-upgrade checks, the upgrade sequence, and
post-upgrade validation – applicable regardless of underlying hardware.
Hardware/HCI-specific extra steps (currently: **Dell VxRail**) are layered on
top as their own addendum, not baked into the general flow.

Not a public tool. Do not link this repo from public-facing pages.

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

| Path              | Purpose                                                |
| ----------------- | ------------------------------------------------------- |
| `docs/01-overview.md` | General VCF upgrade guidance (work in progress)      |
| `docs/02-disaster-recovery.md` | SRM / vSphere Replication to VCF Protection and Recovery |
| `docs/03-identity-broker-migration.md` | VIDM / Workspace ONE Access to VCF Identity Broker |
| `docs/04-field-notes.md` | Known issues and gotchas from real upgrades |
| `docs/vxrail-addendum.md` | Dell VxRail-specific extra steps (work in progress) |
| `reference/`      | Pinned reference material                                |
| `tools/`          | Helper scripts, if any get added                         |
| `web/`            | ITQ-branded Astro site rendering `docs/` in place        |

## Web version

Published internally via **GitLab Pages** (primary hosting for this repo).
To run it locally:

```
cd web
npm install
npm run dev
```

## Author

Paul van Dieen

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
