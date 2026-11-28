/** What the borders of past states ask of the app, front and body alike (#220). */
export const NEEDS = ['stateBorders', 'yearsTrack', 'whyHere'] as const;
export type EmpiresNeeds = (typeof NEEDS)[number];
