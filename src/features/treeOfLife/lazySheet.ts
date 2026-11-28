/**
 * A sheet whose code loads the first time it is asked to show (#220): until then a hidden stand-in
 * holds its place on the page, and the sheet's dialog takes that place once made. What is shown
 * is always the view asked for last, however long the load took. Here while the tree of life's
 * sheets are its only users; to `ui/` when another feature's sheet loads this way.
 */

/** What a sheet is, to be shown lazily: its dialog, and how a view is shown in it. */
export interface Sheet<View> {
  readonly dialog: HTMLElement;
  show(view: View | null): void;
}

export interface LazySheet<View> {
  /** Where the sheet goes on the page: a stand-in until it loads, then its dialog. */
  readonly element: HTMLElement;
  /** Show a view, loading the sheet first if need be; null shows nothing, and loads nothing. */
  show(view: View | null): void;
}

export function lazySheet<View>(
  make: () => Promise<Sheet<View>>,
  /** The load failed: said, and tried again at the next view asked for. */
  failed: (error: unknown) => void,
): LazySheet<View> {
  const standIn = document.createElement('span');
  standIn.hidden = true;
  let sheet: Sheet<View> | null = null;
  let loading = false;
  let wanted: View | null = null;

  function load(): void {
    if (loading) return;
    loading = true;
    make().then(
      (made) => {
        sheet = made;
        standIn.replaceWith(made.dialog);
        made.show(wanted);
      },
      (error: unknown) => {
        loading = false;
        failed(error);
      },
    );
  }

  return {
    element: standIn,
    show(view) {
      wanted = view;
      if (sheet !== null) sheet.show(view);
      else if (view !== null) load();
    },
  };
}
