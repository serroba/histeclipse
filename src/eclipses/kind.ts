import type { CalendarDate } from '../time/julianDay';

export const ECLIPSE_KINDS = ['lunar', 'solar'] as const;
export type EclipseKind = (typeof ECLIPSE_KINDS)[number];

export interface Selection {
  readonly kind: EclipseKind;
  /** Day of greatest eclipse, as a whole calendar day. */
  readonly date: CalendarDate;
}
