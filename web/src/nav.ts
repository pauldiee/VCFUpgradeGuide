// Ordered navigation manifest for the upgrade-planning docs. The docs
// themselves carry no frontmatter (they double as GitLab/GitHub-rendered
// .md), so labels, icons and the flow order live here. `slug` matches the
// glob collection id (filename without extension).
//
// `step` doubles as a grouping label: general flow steps use "Overview" /
// "Pre-upgrade prep" / "Phase guide" / "Post-upgrade" / etc; hardware-specific
// addenda use "Addendum" so they render as their own group rather than
// blending into the general flow. A guide scoped to only one licensing model
// gets a " · VCF only" / " · VVF only" suffix (see docs/01-overview.md's
// "VVF: confirm whether VCF Management Services is even in scope" for what
// that split means) — guides applicable to both stay unsuffixed, with the
// applicability stated in the blurb instead.
export interface NavItem {
  slug: string;
  step: string;
  label: string;
  icon: string; // Font Awesome Classic Solid name
  blurb: string;
}

// TODO: replace with the actual general upgrade-flow doc set as it's written.
export const NAV: NavItem[] = [
  {
    slug: '01-overview',
    step: 'Overview',
    label: 'Overview',
    icon: 'clipboard-check',
    blurb: 'General VCF upgrade guidance, independent of underlying hardware.',
  },
  {
    slug: '02-disaster-recovery',
    step: 'Pre-upgrade prep',
    label: 'Disaster Recovery',
    icon: 'shield-halved',
    blurb: 'SRM / vSphere Replication convergence to VCF Protection and Recovery, before the core upgrade. Applies to VCF, VVF, or pre-9 vSphere.',
  },
  {
    slug: '06-iwa-ldaps-migration',
    step: 'Pre-upgrade prep',
    label: 'IWA to LDAPS migration',
    icon: 'user-lock',
    blurb: 'Move a vCenter off Integrated Windows Authentication to AD-over-LDAPS before Phase 6, with a permissions/roles backup. vCenter-level, applies to VCF and VVF alike.',
  },
  {
    slug: '05-operations-modernization',
    step: 'Phase guide',
    label: 'Operations modernization',
    icon: 'chart-line',
    blurb: 'Aria Operations to VCF Operations: in-place upgrade vs. fresh install, re-IP, HA setup, and vCenter integrations. Phase 1. Applies to fleet-managed VCF and standalone VVF alike.',
  },
  {
    slug: '07-vcenter-manual-upgrade',
    step: 'Phase guide · VVF only',
    label: 'vCenter manual GUI upgrade',
    icon: 'server',
    blurb: 'Manual GUI upgrade of a standalone vCenter (no Fleet Management), plus the vCenter-specific back-in-time compatibility check. Phase 6 alternate path. Standalone VVF (no VCF Management Services) only.',
  },
  {
    slug: '03-identity-broker-migration',
    step: 'Post-upgrade · VCF only',
    label: 'Identity Broker migration',
    icon: 'key',
    blurb: 'VIDM / Workspace ONE Access to VCF Identity Broker, after the core upgrade (or before Phase 1 for the 9.0.x source case). Requires VCF Management Services, so VCF only – not applicable to standalone VVF.',
  },
  {
    slug: '04-field-notes',
    step: 'Reference',
    label: 'Field notes',
    icon: 'triangle-exclamation',
    blurb: 'Known issues and gotchas from real VCF 5.2 to 9.x upgrades, grouped by phase.',
  },
  {
    slug: 'vxrail-addendum',
    step: 'Addendum',
    label: 'VxRail Addendum',
    icon: 'server',
    blurb: 'Dell VxRail-specific extra steps layered on top of the general upgrade flow.',
  },
];

export function navBySlug(slug: string): NavItem | undefined {
  return NAV.find((n) => n.slug === slug);
}
