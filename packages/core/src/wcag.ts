/** The WCAG success criteria v6y rules map to. */
export type WcagLevel = 'A' | 'AA' | 'AAA';
export type WcagVersion = '2.0' | '2.1' | '2.2';

export interface WcagCriterion {
  id: string;
  title: string;
  level: WcagLevel;
  /** WCAG version that introduced it. */
  since: WcagVersion;
}

export const WCAG: Record<string, WcagCriterion> = {
  '1.1.1': { id: '1.1.1', title: 'Non-text Content', level: 'A', since: '2.0' },
  '1.3.1': { id: '1.3.1', title: 'Info and Relationships', level: 'A', since: '2.0' },
  '1.4.3': { id: '1.4.3', title: 'Contrast (Minimum)', level: 'AA', since: '2.0' },
  '1.4.4': { id: '1.4.4', title: 'Resize Text', level: 'AA', since: '2.0' },
  '1.4.6': { id: '1.4.6', title: 'Contrast (Enhanced)', level: 'AAA', since: '2.0' },
  '2.4.6': { id: '2.4.6', title: 'Headings and Labels', level: 'AA', since: '2.0' },
  '2.5.5': { id: '2.5.5', title: 'Target Size (Enhanced)', level: 'AAA', since: '2.1' },
  '2.5.8': { id: '2.5.8', title: 'Target Size (Minimum)', level: 'AA', since: '2.2' },
  '3.3.2': { id: '3.3.2', title: 'Labels or Instructions', level: 'A', since: '2.0' },
  '4.1.2': { id: '4.1.2', title: 'Name, Role, Value', level: 'A', since: '2.0' },
};

export function wcagUrl(id: string): string {
  const slugs: Record<string, string> = {
    '1.1.1': 'non-text-content',
    '1.3.1': 'info-and-relationships',
    '1.4.3': 'contrast-minimum',
    '1.4.4': 'resize-text',
    '1.4.6': 'contrast-enhanced',
    '2.4.6': 'headings-and-labels',
    '2.5.5': 'target-size-enhanced',
    '2.5.8': 'target-size-minimum',
    '3.3.2': 'labels-or-instructions',
    '4.1.2': 'name-role-value',
  };
  return `https://www.w3.org/WAI/WCAG22/Understanding/${slugs[id] ?? ''}`;
}
