// Ordered navigation manifest for the upgrade-planning docs. The docs
// themselves carry no frontmatter (they double as GitLab/GitHub-rendered
// .md), so labels, icons and the flow order live here. `slug` matches the
// glob collection id (filename without extension).
//
// `step` doubles as a grouping label: general flow steps use "Overview" /
// "Step N" / etc; hardware-specific addenda use "Addendum" so they render as
// their own group rather than blending into the general flow.
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
    step: 'Guide',
    label: 'Disaster Recovery',
    icon: 'shield-halved',
    blurb: 'SRM / vSphere Replication convergence to VCF Protection and Recovery, before the core upgrade.',
  },
  {
    slug: '03-identity-broker-migration',
    step: 'Guide',
    label: 'Identity Broker migration',
    icon: 'key',
    blurb: 'VIDM / Workspace ONE Access to VCF Identity Broker, after the core upgrade.',
  },
  {
    slug: '04-field-notes',
    step: 'Reference',
    label: 'Field notes',
    icon: 'triangle-exclamation',
    blurb: 'Known issues and gotchas from real VCF 5.2 to 9.x upgrades, grouped by phase.',
  },
  {
    slug: '05-operations-modernization',
    step: 'Guide',
    label: 'Operations modernization',
    icon: 'chart-line',
    blurb: 'Aria Operations to VCF Operations: in-place upgrade vs. fresh install, re-IP, HA setup, and vCenter integrations.',
  },
  {
    slug: '06-iwa-ldaps-migration',
    step: 'Guide',
    label: 'IWA to LDAPS migration',
    icon: 'user-lock',
    blurb: 'Move a vCenter off Integrated Windows Authentication to AD-over-LDAPS before Phase 6, with a permissions/roles backup.',
  },
  {
    slug: '07-vcenter-manual-upgrade',
    step: 'Guide',
    label: 'vCenter manual GUI upgrade',
    icon: 'server',
    blurb: 'Manual GUI upgrade of a standalone vCenter (no Fleet Management), plus the vCenter-specific back-in-time compatibility check.',
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
