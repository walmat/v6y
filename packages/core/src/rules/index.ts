import { Rule } from '../rule';
import {
  DuplicateLabelOptions,
  InputMissingLabelOptions,
  MeaninglessLabelOptions,
  duplicateLabel,
  imageMissingLabel,
  inputMissingLabel,
  meaninglessLabel,
  missingLabel,
} from './names';
import { missingHeading, missingRole, nestedInteractive, stateNotExposed } from './roles';
import {
  FontScalingOptions,
  TextContrastOptions,
  TouchTargetOptions,
  fontScalingDisabled,
  textContrast,
  touchTargetSize,
} from './visual';

export * from './names';
export * from './roles';
export * from './visual';

/** Options per rule id; drives autocomplete in `defineConfig`. */
export interface RuleOptionsMap {
  'missing-label': Record<string, never>;
  'meaningless-label': MeaninglessLabelOptions;
  'image-missing-label': Record<string, never>;
  'input-missing-label': InputMissingLabelOptions;
  'duplicate-label': DuplicateLabelOptions;
  'missing-role': Record<string, never>;
  'nested-interactive': Record<string, never>;
  'state-not-exposed': Record<string, never>;
  'missing-heading': Record<string, never>;
  'touch-target-size': TouchTargetOptions;
  'text-contrast': TextContrastOptions;
  'font-scaling-disabled': FontScalingOptions;
}

export type RuleId = keyof RuleOptionsMap;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allRules: Rule<any>[] = [
  missingLabel,
  meaninglessLabel,
  imageMissingLabel,
  inputMissingLabel,
  duplicateLabel,
  missingRole,
  nestedInteractive,
  stateNotExposed,
  missingHeading,
  touchTargetSize,
  textContrast,
  fontScalingDisabled,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rulesById: Record<RuleId, Rule<any>> = Object.fromEntries(allRules.map((r) => [r.meta.id, r])) as never;
