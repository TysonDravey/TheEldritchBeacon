import type { FaceId, ReversibleTile } from './types';

/**
 * Produces an ordinary territoryMap (number[][]) for one face, given its base
 * map and the CURRENT flip state of each reversible tile. This is the only
 * new piece of game logic in the whole prototype — everything downstream
 * (Board rendering, canPlaceWatcher, findContradictions, isSolved) consumes
 * the result as if it were any other Beacon puzzle's territoryMap and has no
 * idea a tile is "reversible" at all.
 */
export function deriveTerritoryMap(
  face: FaceId,
  baseTerritoryMap: number[][],
  reversibleTiles: ReversibleTile[],
  flips: boolean[],
): number[][] {
  const map = baseTerritoryMap.map(row => [...row]);
  reversibleTiles.forEach((tile, i) => {
    const flipped = flips[i];
    const homeColor = face === 'A' ? tile.colorOnA : tile.colorOnB;
    const awayColor = face === 'A' ? tile.colorOnB : tile.colorOnA;
    map[tile.row][tile.col] = flipped ? awayColor : homeColor;
  });
  return map;
}
