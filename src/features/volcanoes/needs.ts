/** What the volcanoes ask of the app, front and body alike (#220). */
export const NEEDS = ['cards', 'timeline'] as const;
export type VolcanoesNeeds = (typeof NEEDS)[number];
