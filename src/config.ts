import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { fromOld, markOld, oldKeys } from './legacy.ts';
import { ConfigError, background, check, emptyMappings, isMap, type Raw, type Shape } from './shape.ts';

export { ConfigError };

export const CARDS = ['summary', 'languages', 'contributions', 'weekly', 'streaks', 'about'] as const;
export type Card = (typeof CARDS)[number];
/** The cards made when the settings don't list any; the others are there to turn on. */
export const DEFAULT_CARDS: Card[] = ['summary', 'languages', 'contributions', 'weekly'];

export const STYLES = ['classic', 'oled', 'dotmatrix'] as const;
export type Style = (typeof STYLES)[number];
export const COLORS = ['github', 'amber', 'green', 'purple', 'cyan', 'red', 'blue'] as const;
export type Color = (typeof COLORS)[number];

export interface Config {
  /** GitHub login. Defaults to the token's owner. */
  user: string | null;
  /** The cards to make, in README order; the others are left out. [] turns them all off: nothing is made. */
  show: Card[];
  /** Which repositories count in the numbers. */
  count: {
    /** Private repositories. */
    private: boolean;
    /** Repositories of organizations you belong to. */
    orgs: boolean;
  };
  look: {
    /** classic: GitHub-style cards. oled: displays of square pixels. dotmatrix: of round LEDs. */
    style: Style;
    /** github: GitHub's own blue and greens. amber, green, purple, cyan, red, blue: everything that highlights in that colour. */
    color: Color;
    animations: boolean;
    /**
     * Behind the cards: "none" lets the page show through; a colour ("#030506") is the same for every
     * viewer, and the text takes the shades that suit it. "solid" only comes from the old settings (legacy.ts): the
     * style's own (classic: GitHub's page colour, following the viewer; the displays: the colour's panel).
     */
    background: string;
    /** classic only: a thin outline. */
    border: boolean;
  };
  cards: {
    summary: {
      /** Shown small and uppercase on the card's header line; null for none. */
      title: string | null;
      /** What sits inside the activity ring: the percentage, or the GitHub logo (the percentage moves to the header). */
      ring: 'percent' | 'github';
    };
    languages: {
      title: string | null;
      count: number;
      /** Languages left out: their share is dropped. */
      hide: string[];
      /** Weight per repo; 1 is neutral, 0 leaves it out. */
      repos: Record<string, number>;
      /** Fold the remaining languages into an "Other" entry. */
      other: boolean;
    };
    contributions: {
      title: string | null;
      /** How many repos to show; 3 are in view at a time, the rest scroll past in a loop. */
      count: number;
      /** Count open pull requests too, not only merged ones. */
      open: boolean;
      /** Shown before the others, if they have a merged (or open) pull request of yours. */
      pin: string[];
      hide: string[];
    };
    weekly: { title: string | null };
    streaks: { title: string | null };
    about: {
      title: string | null;
      /** Shown large; null for none. */
      headline: string | null;
      /** Each is one line of text: they are not wrapped. More than fit scroll past, like the contributions. */
      lines: string[];
      /** Label -> text, one per line under the lines, scrolling with them. */
      facts: Record<string, string>;
    };
  };
}

export const DEFAULT_CONFIG: Config = {
  user: null,
  show: [...DEFAULT_CARDS],
  count: { private: true, orgs: true },
  look: { style: 'classic', color: 'github', animations: true, background: 'none', border: false },
  cards: {
    summary: { title: null, ring: 'percent' },
    languages: { title: 'Most used languages', count: 6, hide: [], repos: {}, other: true },
    contributions: { title: 'Notable contributions', count: 6, open: true, pin: [], hide: [] },
    weekly: { title: 'Weekly rhythm' },
    streaks: { title: 'Streaks' },
    about: { title: 'About', headline: null, lines: [], facts: {} },
  },
};

const SHAPE: Shape = {
  user: 'string?',
  show: 'string[]',
  count: { private: 'boolean', orgs: 'boolean' },
  look: { style: 'string', color: 'string', animations: 'boolean', background: 'string', border: 'boolean' },
  cards: {
    summary: { title: 'string?', ring: 'string' },
    languages: { title: 'string?', count: 'number', hide: 'string[]', repos: 'weights', other: 'boolean' },
    contributions: { title: 'string?', count: 'number', open: 'boolean', pin: 'string[]', hide: 'string[]' },
    weekly: { title: 'string?' },
    streaks: { title: 'string?' },
    about: { title: 'string?', headline: 'string?', lines: 'string[]', facts: 'strings' },
  },
};

function merge<T>(base: T, override: unknown): T {
  if (typeof override !== 'object' || override === null) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, v] of Object.entries(override)) {
    const b = out[key];
    out[key] =
      typeof b === 'object' && b !== null && !Array.isArray(b) && typeof v === 'object' && v !== null && !Array.isArray(v)
        && key !== 'repos' && key !== 'facts'
        ? merge(b, v)
        : v;
  }
  return out as T;
}

export const NEW_KEYS = ['show', 'count', 'look'];

export function parseConfig(text: string): Config {
  const doc = parseDocument(text);
  if (doc.errors.length) throw doc.errors[0];
  const parsed: unknown = doc.toJS() ?? {};
  if (!isMap(parsed)) throw new ConfigError('config must be a mapping');
  let raw: Raw = parsed;

  const old = oldKeys(raw);
  const current = NEW_KEYS.filter((k) => k in raw).concat(isMap(raw.cards) ? ['cards'] : []);
  if (old.length && current.length) {
    throw new ConfigError(`"${current[0]}" is in the new layout of the settings, "${old[0]}" in the old one: use the new one (run setup again to move them)`);
  }
  if (old.length) raw = fromOld(raw, doc); // the layout before v1.5: see legacy.ts
  else {
    emptyMappings(raw, SHAPE);
    if (isMap(raw.look) && 'background' in raw.look) {
      (raw.look as Raw).background = background(doc.getIn(['look', 'background'], true), 'look.background');
    }
  }

  check(raw, SHAPE, '');
  const config = merge(DEFAULT_CONFIG, raw);
  if (!(STYLES as readonly string[]).includes(config.look.style)) {
    throw new ConfigError(`"look.style" must be ${STYLES.map((s) => `"${s}"`).join(', ').replace(/, ([^,]*)$/, ' or $1')}`);
  }
  if (!(COLORS as readonly string[]).includes(config.look.color)) {
    throw new ConfigError(`"look.color" must be ${COLORS.map((c) => `"${c}"`).join(', ').replace(/, ([^,]*)$/, ' or $1')}`);
  }
  for (const card of config.show) {
    if (!(CARDS as readonly string[]).includes(card)) {
      throw new ConfigError(`"show" has "${card}"; the cards are ${CARDS.join(', ')}`);
    }
  }
  if (new Set(config.show).size !== config.show.length) throw new ConfigError('"show" names a card twice');
  if (config.cards.summary.ring !== 'percent' && config.cards.summary.ring !== 'github') {
    throw new ConfigError('"cards.summary.ring" must be "percent" or "github"');
  }
  if (old.length) markOld(config);
  return config;
}

export function loadConfig(path: string): Config {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new ConfigError(`cannot read config file ${path}`);
  }
  return parseConfig(text);
}

/** "repo" means a repo of the user; "owner/repo" is taken as is. Lowercased for matching. */
export function repoKey(ref: string, login: string): string {
  const name = ref.includes('/') ? ref : `${login}/${ref}`;
  return name.toLowerCase();
}
