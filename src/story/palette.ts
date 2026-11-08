/**
 * The carbon-14 story's colours, one place for all its scenes and diagrams (#338). The stage's
 * captions name some of them ("nitrogen, blue"; "carbon-14, violet"), so every drawing of the
 * story has to use the same ones.
 */

export const PALETTE = {
  /** Nitrogen-14, and the air's nitrogen molecules: blue. */
  nitrogen: 0x5a99ff,
  /** Carbon-14, as nucleus and as atom: violet. */
  carbon14: 0xb87aff,
  /** The proton the capture frees: yellow. */
  freedProton: 0xffd94d,
  /** A free neutron, as the reaction draws it; and hydrogen, the same near-white. */
  neutron: 0xf2f2f2,
  hydrogen: 0xf2f2f2,
  /** Oxygen: red. */
  oxygen: 0xff6b6b,
  /** The nucleons inside a nucleus: protons red, neutrons grey-blue, each with its glow. */
  nucleonProton: 0xff5a48,
  nucleonProtonGlow: 0x401008,
  nucleonNeutron: 0xa8bccf,
  nucleonNeutronGlow: 0x101820,
  /** Behind every scene: near-black, a little blue. */
  night: 0x02040a,
} as const;

/** A colour as CSS writes it, `#rrggbb`. */
export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
