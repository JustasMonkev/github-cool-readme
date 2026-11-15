// What a card is: its name, its settings and how it's drawn, in each style. Every card's folder has
// one (index.ts), next to its two renderers: classic.ts and display.ts (dot matrix and OLED). The
// list in cards/index.ts is the cards there are, in their usual order.
import type { Model } from '../compute.ts';
import type { Config } from '../config.ts';
import type { Style } from '../display/dmd.ts';
import type { Theme } from '../render/svg.ts';
import type { Shape } from '../shape.ts';

export interface CardDef<Name extends string, Settings> {
  /** Its name in show: and under cards:, and its files': <name>-light.svg, <name>-dark.svg. */
  name: Name;
  /** In show: unless the settings say otherwise. */
  on: boolean;
  /** Its alt text in a README, as setup writes it. */
  alt: string;
  /** Its settings under cards: <name>, unless the settings file says otherwise. */
  settings: Settings;
  /** What its settings may hold. */
  shape: Shape;
  /** Checks on its settings beyond their shape: throws a ConfigError. */
  check?: (settings: Settings) => void;
  /** The card in the classic style. */
  classic: (model: Model, theme: Theme, config: Config) => string;
  /** The card as a display: dot matrix or OLED. */
  display: (model: Model, style: Style, config: Config) => string;
}
