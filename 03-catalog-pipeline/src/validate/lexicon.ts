import type { Locale } from '../types.ts';

/**
 * Every word list the gate uses. Kept as data, in one file, so a merchant can
 * read the rules without reading the code.
 */

/* ------------------------------------------------- banned brand vocabulary --- */

/** 00-brand-demo/brand.md, "Words we avoid". */
export const BANNED_WORDS_EN = [
  'artisanal',
  'curated',
  'elevated',
  'journey',
  'passion',
  'handcrafted',
  'liquid gold',
  'game-changing',
  'exquisite',
  'unlock',
] as const;

/** The same list in Spanish. English entries stay banned in Spanish copy too. */
export const BANNED_WORDS_ES = [
  'artesanal',
  'artesanales',
  'curado',
  'curada',
  'curados',
  'curadas',
  'elevado',
  'elevada',
  'viaje',
  'pasion',
  'hecho a mano',
  'hecha a mano',
  'oro liquido',
  'revolucionario',
  'exquisito',
  'exquisita',
  'desbloquear',
  'desbloquea',
] as const;

/* ----------------------------------------------------- certification claims --- */

/**
 * The hardest rule in the system. Cerro Alto holds NO certification of any kind
 * (brand.md: "we do not call ourselves carbon neutral, organic-certified, or
 * direct trade, because we are none of those things").
 *
 * This list covers the certifications themselves and the phrasings that imply
 * one without naming it.
 */
export const CERTIFICATION_TERMS_EN = [
  'organic',
  'organically',
  'certified',
  'certification',
  'fair trade',
  'fairtrade',
  'carbon neutral',
  'carbon-neutral',
  'carbon footprint',
  'climate neutral',
  'net zero',
  'direct trade',
  'rainforest alliance',
  'bird friendly',
  'smithsonian',
  'utz',
  'b corp',
  'non gmo',
  'biodynamic',
  'sustainably sourced',
  'sustainably grown',
  'ethically sourced',
  'ethically grown',
  'responsibly sourced',
  'eco friendly',
  'eco-friendly',
  'pesticide free',
  'chemical free',
  'regenerative',
] as const;

export const CERTIFICATION_TERMS_ES = [
  'organico',
  'organica',
  'organicos',
  'organicas',
  'certificado',
  'certificada',
  'certificacion',
  'comercio justo',
  'carbono neutral',
  'neutro en carbono',
  'huella de carbono',
  'cero emisiones',
  'comercio directo',
  'alianza para bosques',
  'amigable con las aves',
  'biodinamico',
  'sostenible',
  'sostenibles',
  'sostenibilidad',
  'ecologico',
  'ecologica',
  'de origen etico',
  'eticamente',
  'responsablemente',
  'libre de pesticidas',
  'regenerativo',
] as const;

/* --------------------------------------------------------- domain lexicon --- */

/**
 * Value-level coffee vocabulary: terms that ASSERT something about a specific
 * product. Category names ("altitude", "process", "tasting notes") are
 * deliberately absent — naming a category is not a claim, and gating on it would
 * be pedantry rather than protection.
 *
 * If one of these appears in generated copy, the ledger must back it.
 */
export const DOMAIN_LEXICON = [
  // process
  'washed', 'natural', 'honey process', 'anaerobic', 'carbonic maceration', 'wet hulled',
  'semi washed', 'sugarcane', 'decaf', 'decaffeinated', 'swiss water', 'methylene chloride',
  'ethyl acetate', 'fermented', 'double fermented',
  // varietal
  'caturra', 'castillo', 'bourbon', 'pink bourbon', 'typica', 'geisha', 'gesha', 'tabi',
  'maragogipe', 'pacamara', 'catuai', 'sl28', 'sl34', 'mundo novo', 'cenicafe',
  // origin
  'colombia', 'huila', 'narino', 'tolima', 'antioquia', 'cauca', 'quindio', 'risaralda',
  'santander', 'caldas', 'valle del cauca', 'sierra nevada', 'ethiopia', 'kenya', 'brazil',
  'guatemala', 'honduras', 'peru', 'sumatra', 'yirgacheffe', 'sidamo',
  // roast level — the bare level is the claim; "medium roast" is caught by "medium"
  'light', 'medium', 'dark', 'city roast', 'french roast', 'italian roast', 'blonde',
  // tasting notes
  'plum', 'prune', 'brown sugar', 'cane sugar', 'orange', 'tangerine', 'raspberry', 'hibiscus',
  'chocolate', 'dark chocolate', 'milk chocolate', 'molasses', 'walnut', 'almond', 'red apple',
  'apple', 'caramel', 'pear', 'cocoa', 'blueberry', 'strawberry', 'blackberry', 'cherry',
  'peach', 'apricot', 'vanilla', 'cinnamon', 'nutmeg', 'lemon', 'lime', 'grapefruit', 'toffee',
  'hazelnut', 'pecan', 'maple', 'tobacco', 'leather', 'jasmine', 'bergamot', 'floral', 'citrus',
  'stone fruit', 'tropical', 'mango', 'papaya', 'melon', 'grape', 'wine', 'black tea',
  'green tea', 'earl grey', 'cardamom', 'clove', 'butterscotch', 'marzipan', 'praline', 'fig',
  'raisin', 'currant', 'cranberry', 'lychee', 'guava', 'passion fruit', 'rose', 'lavender',
  // sourcing claims
  'single origin', 'single estate', 'microlot', 'micro lot', 'smallholder', 'family farm',
  'estate', 'shade grown', 'hand picked', 'sun dried', 'small batch', 'heirloom',
  // brew method
  'espresso', 'filter', 'pour over', 'french press', 'aeropress', 'moka', 'drip', 'cold brew',
  'chemex', 'siphon', 'whole bean',
  // materials
  'ceramic', 'porcelain', 'stainless steel', 'steel', 'plastic', 'glass', 'borosilicate',
  'walnut wood', 'bamboo', 'silicone', 'copper', 'bleached', 'unbleached', 'dishwasher safe',
  'microwave safe', 'bpa free',
  // Spanish claim vocabulary — resolved to the English fact through DOMAIN_ALIASES
  // so that Spanish copy is checked against the same ledger with the same rigour.
  'ciruela', 'azucar moreno', 'naranja', 'frambuesa', 'hibisco', 'azucar de cana',
  'chocolate negro', 'melaza', 'nuez', 'almendra', 'manzana roja', 'caramelo', 'pera', 'cacao',
  'arandano', 'fresa', 'cereza', 'durazno', 'jazmin', 'canela', 'vainilla', 'limon', 'avellana',
  'uva', 'lavado', 'descafeinado', 'cloruro de metileno', 'claro', 'medio', 'oscuro',
  'grano entero', 'filtro', 'prensa francesa', 'ceramica', 'acero', 'plastico', 'vidrio',
  'blanqueado', 'origen unico',
] as const;

/**
 * Terms that assert the same underlying fact as another term. A claim written as
 * "Colombian" is backed by an origin of "Colombia": same fact, different
 * morphology. Without this the gate would reject correct copy, which is how a
 * gate loses its credibility.
 */
export const DOMAIN_ALIASES: Record<string, string> = {
  colombian: 'colombia',
  ethiopian: 'ethiopia',
  kenyan: 'kenya',
  brazilian: 'brazil',
  guatemalan: 'guatemala',
  decaffeinated: 'decaf',
  'micro lot': 'microlot',
  'honey process': 'honey',
  // Spanish → the English fact it asserts. A translation is the same claim in
  // another language, so it is backed by the same ledger entry.
  ciruela: 'plum',
  'azucar moreno': 'brown sugar',
  naranja: 'orange',
  frambuesa: 'raspberry',
  hibisco: 'hibiscus',
  'azucar de cana': 'cane sugar',
  'chocolate negro': 'dark chocolate',
  melaza: 'molasses',
  nuez: 'walnut',
  almendra: 'almond',
  'manzana roja': 'red apple',
  caramelo: 'caramel',
  pera: 'pear',
  cacao: 'cocoa',
  arandano: 'blueberry',
  fresa: 'strawberry',
  cereza: 'cherry',
  durazno: 'peach',
  jazmin: 'jasmine',
  canela: 'cinnamon',
  vainilla: 'vanilla',
  limon: 'lemon',
  avellana: 'hazelnut',
  uva: 'grape',
  lavado: 'washed',
  descafeinado: 'decaf',
  'cloruro de metileno': 'methylene chloride',
  claro: 'light',
  medio: 'medium',
  oscuro: 'dark',
  'grano entero': 'whole bean',
  filtro: 'filter',
  'prensa francesa': 'french press',
  ceramica: 'ceramic',
  acero: 'steel',
  plastico: 'plastic',
  vidrio: 'glass',
  blanqueado: 'bleached',
  'origen unico': 'single origin',
};

/* --------------------------------------------------------------- alt text --- */

export const IMAGE_PREFIXES_EN = [
  'image of',
  'an image of',
  'a photo of',
  'photo of',
  'photograph of',
  'picture of',
  'a picture of',
  'graphic of',
  'this image shows',
] as const;

export const IMAGE_PREFIXES_ES = [
  'imagen de',
  'una imagen de',
  'foto de',
  'una foto de',
  'fotografia de',
  'imagen que muestra',
  'ilustracion de',
] as const;

/* ------------------------------------------------------------ locale packs --- */

export interface LocalePack {
  locale: Locale;
  bannedWords: readonly string[];
  certificationTerms: readonly string[];
  imagePrefixes: readonly string[];
  secondPersonMarkers: readonly string[];
  exclamationPattern: RegExp;
}

const PACKS: Record<Locale, LocalePack> = {
  en: {
    locale: 'en',
    bannedWords: BANNED_WORDS_EN,
    certificationTerms: CERTIFICATION_TERMS_EN,
    imagePrefixes: IMAGE_PREFIXES_EN,
    secondPersonMarkers: ['you', 'your', 'yours', "you're", 'yourself'],
    exclamationPattern: /[!¡]/,
  },
  es: {
    locale: 'es',
    bannedWords: [...BANNED_WORDS_ES, ...BANNED_WORDS_EN],
    certificationTerms: [...CERTIFICATION_TERMS_ES, ...CERTIFICATION_TERMS_EN],
    imagePrefixes: [...IMAGE_PREFIXES_ES, ...IMAGE_PREFIXES_EN],
    secondPersonMarkers: [
      'tu', 'tú', 'tus', 'te', 'ti', 'tuyo', 'tuya', 'contigo', 'usted', 'ustedes',
      'puedes', 'quieres', 'tienes', 'prefieres', 'buscas', 'pides', 'eliges', 'usas',
      'sabes', 'necesitas', 'pones', 'notas', 'muelas', 'esperas', 'pagas',
    ],
    exclamationPattern: /[!¡]/,
  },
};

export function localePack(locale: Locale): LocalePack {
  return PACKS[locale];
}
