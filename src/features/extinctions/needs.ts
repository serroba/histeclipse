/** What the extinctions ask of the app, front and body alike (#220). */
export const NEEDS = ['cards', 'timeline', 'ownTime', 'strikes'] as const;
export type ExtinctionsNeeds = (typeof NEEDS)[number];
