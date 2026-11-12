/**
 * Places on a map painted over Earth's surface, each a layer's part (#379): painted in order,
 * the whole map again whenever one changes.
 */

export interface PaintSlot<Painter> {
  /** Paint this from now on (the whole map is painted again); null takes it away. */
  show(painter: Painter | null): void;
}

export interface PaintSlots<Painter> {
  /** A new place on the map, painted in `order` (lower first). */
  add(order: number): PaintSlot<Painter>;
  /** The painters shown, in order. */
  painters(): readonly Painter[];
  /** Whether the place painted in `order` paints anything now. */
  shows(order: number): boolean;
}

/** Places on a map, painted again by `repaint` when any of them changes. */
export function createPaintSlots<Painter>(repaint: () => void): PaintSlots<Painter> {
  const slots: { readonly order: number; painter: Painter | null }[] = [];
  return {
    add(order) {
      const slot: { readonly order: number; painter: Painter | null } = { order, painter: null };
      slots.push(slot);
      slots.sort((a, b) => a.order - b.order);
      return {
        show(painter) {
          slot.painter = painter;
          repaint();
        },
      };
    },
    painters() {
      return slots.flatMap(({ painter }) => (painter === null ? [] : [painter]));
    },
    shows(order) {
      return slots.some((slot) => slot.order === order && slot.painter !== null);
    },
  };
}
