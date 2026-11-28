/**
 * Finding an animal by the name a reader knows: the names in a group's file (its
 * genera and the lineages over them, with PBDB's common names), and the everyday names below for
 * the animals most asked after. The fossil record's unit is the genus, so "lion" finds
 * Panthera, the lion's genus, which it shares with the tiger, the leopard and the jaguar.
 */

import type { LifeData, LifeGroup, LifeNode } from '../../data/lifeStories';

/** Everyday names, each with the genus or lineage it is found under. */
const EVERYDAY: Readonly<Record<LifeGroup, Readonly<Record<string, string>>>> = {
  mammals: {
    lion: 'Panthera',
    tiger: 'Panthera',
    leopard: 'Panthera',
    jaguar: 'Panthera',
    'big cats': 'Panthera',
    cat: 'Felis',
    'house cat': 'Felis',
    cats: 'Felidae',
    cheetah: 'Acinonyx',
    puma: 'Puma',
    cougar: 'Puma',
    lynx: 'Lynx',
    'sabre-toothed cat': 'Smilodon',
    'saber-toothed tiger': 'Smilodon',
    'sabre-toothed tiger': 'Smilodon',
    dog: 'Canis',
    wolf: 'Canis',
    dogs: 'Canidae',
    fox: 'Vulpes',
    bear: 'Ursus',
    bears: 'Ursidae',
    panda: 'Ailuropoda',
    hyena: 'Crocuta',
    horse: 'Equus',
    zebra: 'Equus',
    donkey: 'Equus',
    horses: 'Equidae',
    'dawn horse': 'Eohippus',
    rhino: 'Rhinoceros',
    rhinoceros: 'Rhinocerotidae',
    'woolly rhino': 'Coelodonta',
    tapir: 'Tapirus',
    elephant: 'Loxodonta',
    'african elephant': 'Loxodonta',
    'asian elephant': 'Elephas',
    elephants: 'Proboscidea',
    mammoth: 'Mammuthus',
    'woolly mammoth': 'Mammuthus',
    mastodon: 'Mammut',
    human: 'Homo',
    people: 'Homo',
    orangutan: 'Pongo',
    gibbon: 'Hylobates',
    baboon: 'Papio',
    macaque: 'Macaca',
    monkeys: 'Primates',
    apes: 'Hominoidea',
    kangaroo: 'Macropus',
    kangaroos: 'Macropodidae',
    koala: 'Phascolarctos',
    wombat: 'Vombatus',
    'tasmanian tiger': 'Thylacinus',
    thylacine: 'Thylacinus',
    'tasmanian devil': 'Sarcophilus',
    'marsupial lion': 'Thylacoleo',
    opossum: 'Didelphis',
    marsupials: 'Metatheria',
    platypus: 'Ornithorhynchus',
    echidna: 'Tachyglossus',
    whale: 'Balaenoptera',
    'blue whale': 'Balaenoptera',
    'humpback whale': 'Megaptera',
    'sperm whale': 'Physeter',
    whales: 'Cetacea',
    dolphin: 'Delphinus',
    'bottlenose dolphin': 'Tursiops',
    orca: 'Orcinus',
    'killer whale': 'Orcinus',
    narwhal: 'Monodon',
    beluga: 'Delphinapterus',
    'walking whale': 'Pakicetus',
    seal: 'Phoca',
    walrus: 'Odobenus',
    'sea lion': 'Zalophus',
    manatee: 'Trichechus',
    dugong: 'Dugong',
    'sea cow': 'Hydrodamalis',
    bison: 'Bison',
    buffalo: 'Syncerus',
    cow: 'Bos',
    cattle: 'Bos',
    sheep: 'Ovis',
    goat: 'Capra',
    gazelle: 'Gazella',
    wildebeest: 'Connochaetes',
    'musk ox': 'Ovibos',
    pronghorn: 'Antilocapra',
    deer: 'Cervus',
    reindeer: 'Rangifer',
    moose: 'Alces',
    'irish elk': 'Megaloceros',
    giraffe: 'Giraffa',
    hippo: 'Hippopotamus',
    hippopotamus: 'Hippopotamus',
    pig: 'Sus',
    camel: 'Camelus',
    camels: 'Camelidae',
    llama: 'Lama',
    'giant sloth': 'Megatherium',
    'ground sloth': 'Megatherium',
    sloths: 'Folivora',
    glyptodon: 'Glyptodon',
    armadillo: 'Dasypus',
    aardvark: 'Orycteropus',
    pangolin: 'Manis',
    hyrax: 'Procavia',
    beaver: 'Castor',
    'giant beaver': 'Castoroides',
    mouse: 'Mus',
    rat: 'Rattus',
    squirrel: 'Sciurus',
    porcupine: 'Hystrix',
    capybara: 'Hydrochoerus',
    'guinea pig': 'Cavia',
    rodents: 'Rodentia',
    rabbit: 'Oryctolagus',
    hare: 'Lepus',
    hedgehog: 'Erinaceus',
    mole: 'Talpa',
    shrew: 'Sorex',
    bat: 'Myotis',
    bats: 'Chiroptera',
    raccoon: 'Procyon',
    otter: 'Lutra',
    'sea otter': 'Enhydra',
    badger: 'Meles',
    wolverine: 'Gulo',
    weasel: 'Mustela',
  },
  dinosaurs: {
    't. rex': 'Tyrannosaurus',
    't rex': 'Tyrannosaurus',
    tyrannosaurs: 'Tyrannosauridae',
    raptor: 'Velociraptor',
    'three-horned dinosaur': 'Triceratops',
    'horned dinosaurs': 'Ceratopsia',
    'duck-billed dinosaurs': 'Hadrosauridae',
    'long-necked dinosaurs': 'Sauropoda',
    sauropods: 'Sauropoda',
    'armoured dinosaurs': 'Ankylosauria',
    'plated dinosaurs': 'Stegosauria',
    dinosaurs: 'Dinosauria',
  },
};

/** Animals to offer before anything is typed. */
export const SUGGESTED: readonly string[] = [
  'lion',
  'horse',
  'elephant',
  'whale',
  'kangaroo',
  'mammoth',
  'camel',
  'human',
  'Tyrannosaurus',
  'Triceratops',
];

export interface Found {
  readonly group: LifeGroup;
  readonly node: LifeNode;
  /** The name it was found by, as the reader would say it; '' when found by its own. */
  readonly known: string;
}

/**
 * The everyday names a genus or lineage is found by, as written above: the first as it is, then
 * the others of a single word ("lion", "tiger"…), without the respellings of the first.
 */
export function everydayNames(group: LifeGroup, name: string): readonly string[] {
  const [first, ...rest] = Object.entries(EVERYDAY[group]).flatMap(([known, target]) =>
    target === name ? [known] : [],
  );
  return first === undefined ? [] : [first, ...rest.filter((known) => /^[a-z]+$/.test(known))];
}

function folded(text: string): string {
  return text.trim().toLowerCase();
}

/** How well a name answers what was asked: 0 the same, 1 starts with it, 2 a word of it starts
 * with it, 3 holds it (three letters or more); null if it does not. */
function rate(name: string, asked: string): number | null {
  const candidate = folded(name);
  if (candidate === '') return null;
  if (candidate === asked) return 0;
  if (candidate.startsWith(asked)) return 1;
  if (candidate.includes(` ${asked}`)) return 2;
  return asked.length >= 3 && candidate.includes(asked) ? 3 : null;
}

interface Scored {
  readonly found: Found;
  readonly score: number;
}

/** The everyday names that answer, each with the genus or lineage it is found under. */
function byEveryday(data: LifeData, asked: string): Scored[] {
  const byName = new Map(data.nodes.map((node) => [node.name, node]));
  return Object.entries(EVERYDAY[data.id]).flatMap(([known, name]) => {
    const node = byName.get(name);
    const score = rate(known, asked);
    return node === undefined || score === null
      ? []
      : [{ found: { group: data.id, node, known }, score }];
  });
}

/** The file's own names that answer, scientific or common: after the everyday ones on a tie. */
function byOwnName(data: LifeData, asked: string): Scored[] {
  return data.nodes.flatMap((node) => {
    const own = rate(node.name, asked) ?? Infinity;
    const common = rate(node.common, asked) ?? Infinity;
    const best = Math.min(own, common);
    return best === Infinity
      ? []
      : [
          {
            found: { group: data.id, node, known: common < own ? node.common : '' },
            score: best + 0.5,
          },
        ];
  });
}

/**
 * The animals a reader's words find, the best first: an everyday name, a common name or a
 * scientific one that is the query, then those that start with it, then those that hold it.
 */
export function findAnimals(groups: readonly LifeData[], query: string, most = 12): Found[] {
  const asked = folded(query);
  if (asked === '') return [];
  const scored = groups
    .flatMap((data) => [...byEveryday(data, asked), ...byOwnName(data, asked)])
    .sort((a, b) => a.score - b.score || a.found.node.name.length - b.found.node.name.length);
  const seen = new Map<string, Found>();
  for (const { found } of scored) {
    const key = `${found.group}:${String(found.node.pbdb)}`;
    if (!seen.has(key)) seen.set(key, found);
  }
  return [...seen.values()].slice(0, most);
}

/**
 * The lineage an animal's story is told of: a genus's family (its nearest ancestor of that
 * rank, else its parent), with the genus picked out in it; a lineage's own.
 */
export function storyFor(
  data: LifeData,
  node: LifeNode,
): { readonly pbdb: number; readonly focus: number | null } {
  if (node.sites.length === 0) return { pbdb: node.pbdb, focus: null };
  let family: LifeNode | undefined;
  for (let at = node.parent; at >= 0; at = data.nodes[at]?.parent ?? -1) {
    const ancestor = data.nodes[at];
    if (ancestor?.rank === 'family') {
      family = ancestor;
      break;
    }
  }
  const within = family ?? data.nodes[node.parent];
  return { pbdb: within?.pbdb ?? node.pbdb, focus: node.pbdb };
}
