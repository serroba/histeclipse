/**
 * A date a story lends deep time while it has the globe (#492): the boundaries' Holocene chart
 * runs by years, where deep time counts in thousands, so through the last centuries its header
 * and bar would read "Today". An event watched in its own time lends its clock's moment too
 * (#1222). Not part of the view state, so no link opens on a borrowed date.
 */
export interface StoryDate {
  /** What the moment reads, as the story's own cursor says it. */
  readonly when: string;
  /** What the globe shows then, in place of the period's name; null keeps the period's. */
  readonly what: string | null;
  /**
   * The moment it reads, Ma, where it is not the view's: an event's own clock (#1222), whose
   * period is then the one named.
   */
  readonly ma?: number;
}
