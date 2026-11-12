/**
 * What Stylelint checks in the CSS beside each component (#382, #489): mistakes, not style
 * (Prettier formats it). Each file is checked on its own; the order of rules across files is
 * the bundle's, checked when rules move.
 * @type {import('stylelint').Config}
 */
export default {
  rules: {
    // Mistakes.
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': [true, { ignore: ['consecutive-duplicates'] }],
    'declaration-block-no-shorthand-property-overrides': true,
    'function-calc-no-unspaced-operator': true,
    'keyframe-declaration-no-important': true,
    'media-feature-name-no-unknown': true,
    'no-duplicate-at-import-rules': true,
    'no-invalid-double-slash-comments': true,
    'property-no-unknown': true,
    'selector-pseudo-class-no-unknown': true,
    'selector-pseudo-element-no-unknown': true,
    'unit-no-unknown': true,
    // A selector written twice in one file: the second quietly overrides or adds to the first.
    'no-duplicate-selectors': true,
    // Specificity creeping up to win fights: no ids, and no more than a class chain can explain.
    'selector-max-id': 0,
    'selector-max-specificity': '0,4,2',
    'declaration-no-important': true,
  },
  overrides: [
    {
      // The page's states (`#app[data-panels='hidden'] …`, `#app.is-asking-here …`) live here,
      // and only here: the page root is the one id.
      files: ['src/style.css'],
      rules: { 'selector-max-id': 1, 'selector-max-specificity': '1,4,2' },
    },
  ],
};
