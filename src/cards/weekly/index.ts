import type { CardDef } from '../card.ts';
import { renderWeekly } from './classic.ts';
import { renderDisplayWeekly } from './display.ts';

export interface WeeklySettings {
  title: string | null;
}

export const weekly: CardDef<'weekly', WeeklySettings> = {
  name: 'weekly',
  on: true,
  alt: 'Weekly rhythm',
  settings: { title: 'Weekly rhythm' },
  shape: { title: 'string?' },
  classic: (model, theme, config) => renderWeekly(model.weekly, theme, config),
  display: (model, style, config) => renderDisplayWeekly(model.weekly, config.cards.weekly.title, style),
};
