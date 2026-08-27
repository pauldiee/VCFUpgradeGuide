# VxRail Addendum

Extra steps for a **Dell VxRail** environment, layered **on top of** the
general upgrade guidance in [Overview](01-overview.md) — not a replacement
for it. Read the general flow first; this doc only covers what's different
or additional because the hardware is VxRail.

Current scope: Dell **VxRail 5.2 → VCF 9.1.1** for a specific customer
engagement.

> Work in progress — no content yet beyond scaffolding.

## Scope

- VxRail-specific pre-upgrade checks (VxRail Manager health, HCL/firmware
  compatibility, cluster health)
- VxRail-specific sequencing considerations (VxRail Manager vs. VCF
  Fleet LCM ordering, firmware/driver bundles)
- VxRail-specific post-upgrade validation
