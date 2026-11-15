import type { CardDef } from '../card.ts';
import { renderStreaks } from './classic.ts';
import { renderDisplayStreaks } from './display.ts';

export interface StreaksSettings {
  title: string | null;
}

export const streaks: CardDef<'streaks', StreaksSettings> = {
  name: 'streaks',
  on: false,
  alt: 'Streaks',
  settings: { title: 'Streaks' },
  shape: { title: 'string?' },
  classic: (model, theme, config) => renderStreaks(model.streaks, model.streakDays, theme, config),
  display: (model, style, config) => renderDisplayStreaks(model.streaks, model.streakDays, config.cards.streaks.title, style),
};
