/**
 * The proton–proton chain, as the 3D story plays it in the Sun's core (#317): one chain followed
 * from start to end, over and over, its stages timed. Values: the pp-I branch, which makes most
 * of the Sun's helium; energies as released per reaction (Adelberger et al. 2011).
 */

export type ChainStage = 'pp' | 'dp' | 'hehe' | 'done';

export interface ChainStageInfo {
  readonly stage: ChainStage;
  /** When it begins, ms into the chain. */
  readonly at: number;
  /** What happens, as the reaction is written. */
  readonly equation: string;
  /** What it gives off, in words. */
  readonly gives: string;
}

/** The chain's stages, in order. */
export const CHAIN: readonly ChainStageInfo[] = [
  {
    stage: 'pp',
    at: 0,
    equation: '¹H + ¹H → ²H + e⁺ + ν',
    gives: 'a positron, which meets an electron as two gamma rays of 0.511 MeV, and a neutrino',
  },
  {
    stage: 'dp',
    at: 2600,
    equation: '²H + ¹H → ³He + γ',
    gives: 'a gamma ray of 5.49 MeV',
  },
  {
    stage: 'hehe',
    at: 4800,
    equation: '³He + ³He → ⁴He + 2 ¹H',
    gives: 'two protons, back into the core, and 12.86 MeV',
  },
  {
    stage: 'done',
    at: 7400,
    equation: '4 ¹H → ⁴He + energy',
    gives: 'in all, 26.7 MeV for each helium nucleus made',
  },
];

/** How long one chain plays before it starts again, ms. */
export const CHAIN_MS = 9000;

/** The stage at `t` ms into the story's fusion step, the chain playing over and over. */
export function stageAt(t: number): ChainStageInfo {
  const into = ((t % CHAIN_MS) + CHAIN_MS) % CHAIN_MS;
  const current = CHAIN.filter((info) => into >= info.at).at(-1);
  if (current === undefined) throw new Error('The chain has no stage at its start');
  return current;
}

/** How far through its stage `t` is, from 0 to 1. */
export function stageProgress(t: number): number {
  const into = ((t % CHAIN_MS) + CHAIN_MS) % CHAIN_MS;
  const { stage, at } = stageAt(t);
  const index = CHAIN.findIndex((info) => info.stage === stage);
  const end = CHAIN[index + 1]?.at ?? CHAIN_MS;
  return Math.min(1, Math.max(0, (into - at) / (end - at)));
}

/** The moment that shows the chain complete, for readers who ask for less motion. */
export const SETTLED_T = CHAIN.find(({ stage }) => stage === 'done')?.at ?? 0;
