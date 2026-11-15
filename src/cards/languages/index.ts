import type { CardDef } from '../card.ts';
import { renderLanguages } from './classic.ts';
import { renderDisplayLanguages } from './display.ts';

export interface LanguagesSettings {
  title: string | null;
  count: number;
  /** Languages left out: their share is dropped. */
  hide: string[];
  /** Weight per repo; 1 is neutral, 0 leaves it out. */
  repos: Record<string, number>;
  /** Fold the remaining languages into an "Other" entry. */
  other: boolean;
}

export const languages: CardDef<'languages', LanguagesSettings> = {
  name: 'languages',
  on: true,
  alt: 'Most used languages',
  settings: { title: 'Most used languages', count: 6, hide: [], repos: {}, other: true },
  shape: { title: 'string?', count: 'number', hide: 'string[]', repos: 'weights', other: 'boolean' },
  classic: (model, theme, config) => renderLanguages(model.languages, theme, config),
  display: (model, style, config) => renderDisplayLanguages(model.languages, config.cards.languages.title, style),
};
