// Ordered navigation manifest for the upgrade-planning docs. The docs
// themselves carry no frontmatter (they double as GitLab/GitHub-rendered
// .md), so labels, icons and the flow order live here. `slug` matches the
// glob collection id (filename without extension).
//
// `step` doubles as a per-page eyebrow label: general flow steps use
// "Overview" / "Pre-upgrade prep" / "Phase guide" / "Post-upgrade" / etc;
// hardware-specific addenda use "Addendum". A guide scoped to only one
// licensing model gets a " · VCF only" / " · VVF only" suffix (see
// docs/01-overview.md's "Confirm which track applies" for what that split
// means) — guides applicable to both stay unsuffixed, with the
// applicability stated in the blurb instead.
//
// `band` is the coarser grouping used by the mega-menu's "Guides" panel (see
// REFERENCE_BANDS). The overview doc has no band – it's the entry point/spine,
// rendered as its own plain nav link rather than inside the dropdown.
//
// `tracks` is which of the three landing pages (/vcf/, /vvf/, /vsphere/)
// this item's card shows up on. It's a separate, required field rather than
// parsed out of `step`/`blurb` so every item forces an explicit call – see
// docs/01-overview.md's "Confirm which track applies" for what the vcf/vvf
// split means, and docs/12-vsphere-standard-upgrade.md for why plain
// vSphere reuses the VVF procedure rather than getting its own. The
// full-VCF and standalone-VVF spines (docs/13, docs/14) sit right after
// 01-overview in this array on purpose, so each track's landing page leads
// with its own dedicated procedure doc, not just the shared Overview.
export type Track = 'vcf' | 'vvf' | 'vsphere';

export interface NavItem {
  slug: string;
  step: string;
  label: string;
  icon: string; // Font Awesome Classic Solid name
  blurb: string;
  band?: string;
  tracks: Track[];
}

// Render order for the mega-menu's guide bands.
export const REFERENCE_BANDS = [
  'Pre-upgrade prep',
  'Phase guides',
  'Post-upgrade',
  'Reference',
  'Hardware addenda',
] as const;

// TODO: replace with the actual general upgrade-flow doc set as it's written.
export const NAV: NavItem[] = [
  {
    slug: '01-overview',
    step: 'Overview',
    label: 'Overview',
    icon: 'clipboard-check',
    blurb: 'Shared prerequisites and target-build guidance, plus a pointer to the full-VCF and standalone-VVF sequences below.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '13-vcf-upgrade-sequence',
    step: 'Overview · VCF',
    band: 'Phase guides',
    label: 'Full VCF upgrade sequence',
    icon: 'diagram-project',
    blurb: 'The 9-phase spine, prerequisites, conditional phases, post-upgrade validation, and cleanup for a fleet driven through VCF Management Services.',
    tracks: ['vcf'],
  },
  {
    slug: '14-standalone-vvf-upgrade',
    step: 'Overview · VVF',
    band: 'Phase guides',
    label: 'Standalone VVF upgrade',
    icon: 'layer-group',
    blurb: 'The 6-step manual procedure for VMware vSphere Foundation with no VCF Management Services layer.',
    tracks: ['vvf'],
  },
  {
    slug: '02-disaster-recovery',
    step: 'Pre-upgrade prep',
    band: 'Pre-upgrade prep',
    label: 'Disaster Recovery',
    icon: 'shield-halved',
    blurb: 'SRM / vSphere Replication convergence to VCF Protection and Recovery, before the core upgrade. Applies to VCF, VVF, or pre-9 vSphere.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '06-iwa-ldaps-migration',
    step: 'Pre-upgrade prep',
    band: 'Pre-upgrade prep',
    label: 'IWA to LDAPS migration',
    icon: 'user-lock',
    blurb: 'Move a vCenter off Integrated Windows Authentication to AD-over-LDAPS before Phase 6, with a permissions/roles backup. vCenter-level, applies to VCF and VVF alike.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '08-vss-to-vds-migration',
    step: 'Pre-upgrade prep · VVF only',
    band: 'Pre-upgrade prep',
    label: 'VSS to VDS migration',
    icon: 'network-wired',
    blurb: 'Migrate a cluster off the Virtual Standard Switch to a vSphere Distributed Switch before extending a standalone VVF fleet to full VCF – NSX and SDDC Manager / Fleet Management both require VDS. Standalone VVF extending to full VCF only.',
    tracks: ['vvf'],
  },
  {
    slug: '15-vum-to-vlcm-migration',
    step: 'Pre-upgrade prep',
    band: 'Pre-upgrade prep',
    label: 'VUM to vLCM images migration',
    icon: 'layer-group',
    blurb: 'Transition any remaining vLCM-baseline-managed clusters and standalone hosts to vLCM images before the ESX host phase – the PowerShell script for VCF, the vSphere Client for standalone VVF. Applies to VCF and VVF.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '05-operations-modernization',
    step: 'Phase guide',
    band: 'Phase guides',
    label: 'Operations modernization',
    icon: 'chart-line',
    blurb: 'Aria Operations to VCF Operations: in-place upgrade vs. fresh install, re-IP, HA setup, and vCenter integrations. Phase 1. Applies to fleet-managed VCF and standalone VVF alike.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '07-vcenter-manual-upgrade',
    step: 'Phase guide · VVF only',
    band: 'Phase guides',
    label: 'vCenter manual GUI upgrade',
    icon: 'server',
    blurb: 'Manual GUI upgrade of a standalone vCenter (no Fleet Management), plus the vCenter-specific back-in-time compatibility check. Phase 6 alternate path. Standalone VVF (no VCF Management Services) only.',
    tracks: ['vvf', 'vsphere'],
  },
  {
    slug: '09-avi-license-hub-upgrade',
    step: 'Phase guide',
    band: 'Phase guides',
    label: 'Avi + License Hub upgrade',
    icon: 'scale-balanced',
    blurb: 'Avi Load Balancer Controller/Service Engine upgrade and the separate License Hub appliance, before SDDC Manager. Applies whenever Avi is in use, VCF or VVF.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '10-nsx-edge-finalize',
    step: 'Phase guide',
    band: 'Phase guides',
    label: 'NSX Edge & Finalize',
    icon: 'diagram-project',
    blurb: 'NSX Edge cluster upgrade and NSX finalize, replacing the plain Phase 8 – runs after the ESX / host-cluster phase. Applies whenever NSX Edge nodes are present.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '11-log-management-migration',
    step: 'Phase guide',
    band: 'Phase guides',
    label: 'Log Management migration',
    icon: 'file-lines',
    blurb: 'VCF Operations for Logs migration to Log Management 9.1, after NSX finalize. Path depends on the running source version.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '03-identity-broker-migration',
    step: 'Post-upgrade · VCF only',
    band: 'Post-upgrade',
    label: 'Identity Broker migration',
    icon: 'key',
    blurb: 'VIDM / Workspace ONE Access to VCF Identity Broker, after the core upgrade (or before Phase 1 for the 9.0.x source case). Requires VCF Management Services, so VCF only – not applicable to standalone VVF.',
    tracks: ['vcf'],
  },
  {
    slug: '04-field-notes',
    step: 'Reference',
    band: 'Reference',
    label: 'Field notes',
    icon: 'triangle-exclamation',
    blurb: 'Known issues and gotchas from real VCF 5.2 to 9.x upgrades, grouped by phase.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '16-vcenter-proxy-configuration',
    step: 'Reference',
    band: 'Reference',
    label: 'vCenter proxy configuration',
    icon: 'network-wired',
    blurb: 'Configuring the vCenter appliance\'s own outbound proxy – the 7.0.x/8.0.x file method and the different, JSON-based 9.x method. Applies to VCF, VVF, or standalone vSphere.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '17-vdt-and-lsdoctor-diagnostics',
    step: 'Reference',
    band: 'Reference',
    label: 'VDT and lsdoctor diagnostics',
    icon: 'user-lock',
    blurb: 'Self-service diagnostic tools – VDT for a general appliance health sweep, lsdoctor for deeper VC Lookup Service / SSO / vmdir issues. Applies to VCF, VVF, or standalone vSphere.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '18-vmware-tools-productlocker',
    step: 'Reference',
    band: 'Reference',
    label: 'VMware Tools ProductLocker',
    icon: 'folder-tree',
    blurb: 'Shared VMware Tools repository setup, both PowerCLI methods, and why the location needs re-verifying after every ESXi upgrade. Applies to VCF, VVF, or standalone vSphere.',
    tracks: ['vcf', 'vvf', 'vsphere'],
  },
  {
    slug: '19-vvf-vs-vcf-feature-comparison',
    step: 'Reference',
    band: 'Reference',
    label: 'VVF vs VCF feature comparison',
    icon: 'scale-balanced',
    blurb: 'What is VCF-only, VVF-only, or an add-on regardless of tier – summarized from Broadcom\'s official comparison whitepaper. Applies to the VCF/VVF licensing decision.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: '20-patching-an-existing-vcf9-fleet',
    step: 'Reference',
    band: 'Reference',
    label: 'Patching an existing VCF 9.x fleet',
    icon: 'download',
    blurb: 'Applying a maintenance/patch release to a fleet already on VCF 9.x – depot prep, the mandatory component patching order, UI walkthrough, and known gotchas. Applies to VCF or VVF.',
    tracks: ['vcf', 'vvf'],
  },
  {
    slug: 'vxrail-addendum',
    step: 'Addendum',
    band: 'Hardware addenda',
    label: 'VxRail Addendum',
    icon: 'server',
    blurb: 'Dell VxRail-specific extra steps layered on top of the general upgrade flow.',
    tracks: ['vcf'],
  },
  // 12-vsphere-standard-upgrade is intentionally left out of NAV for now –
  // see the exclusion comment in web/src/content.config.ts. Re-add it here
  // (with tracks: ['vsphere']) when the track gets content of its own.
];

export function navBySlug(slug: string): NavItem | undefined {
  return NAV.find((n) => n.slug === slug);
}

/** Flow items, in order (everything without a `band` – currently just the overview). */
export function navFlowItems(): NavItem[] {
  return NAV.filter((n) => !n.band);
}

/** Guides grouped by band, in REFERENCE_BANDS order. */
export function navReferenceBands(): { band: string; items: NavItem[] }[] {
  return REFERENCE_BANDS.map((band) => ({
    band,
    items: NAV.filter((n) => n.band === band),
  })).filter((group) => group.items.length > 0);
}

/** Items applicable to a given track (VCF / VVF / standalone vSphere), in NAV order. */
export function navByTrack(track: Track): NavItem[] {
  return NAV.filter((n) => n.tracks.includes(track));
}
