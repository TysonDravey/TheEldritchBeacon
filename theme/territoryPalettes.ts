import { TERRITORY_COLORS, TERRITORY_NAMES } from './colors';

export function getTerritoryStyle(territoryId: number) {
  return TERRITORY_COLORS[territoryId] ?? TERRITORY_COLORS[0];
}

export function getTerritoryName(territoryId: number): string {
  return TERRITORY_NAMES[territoryId] ?? `Territory ${territoryId}`;
}
