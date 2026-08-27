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
