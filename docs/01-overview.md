# Overview

General guidance for planning a **VCF upgrade** — pre-upgrade checks, the
upgrade sequence, and post-upgrade validation — applicable regardless of
underlying hardware. Hardware/HCI-specific extra steps (currently: **Dell
VxRail**) are layered on top as their own addendum, not baked into the
general flow, so the core guidance stays reusable across engagements.

> Work in progress — this doc set is being built out. Nothing here yet
> beyond scaffolding.

## Scope

**General (any underlying hardware):**
- Pre-upgrade prerequisites and health checks
- Upgrade execution sequence
- Post-upgrade validation

**Hardware-specific addenda (extra steps on top of the general flow):**
- Dell VxRail (currently: 5.2 → VCF 9.1.1 for a specific customer
  engagement) — see [VxRail Addendum](vxrail-addendum.md)

## Customer data hygiene

This repo is **ITQ-internal** (private). Even so, do not commit real
customer names, IPs, hostnames, or credentials — use generic placeholders.
Per-engagement working files belong outside the repo, in the customer's
OneDrive folder.
