import { TOWER_DEFS, type TowerKind } from '../sim/combat';

export type BuildMenuOption = {
  kind: TowerKind;
  label: string;
  cost: number;
  canAfford: boolean;
  description: string;
};

export type BuildMenuState =
  | {
      open: true;
      padId: string;
      options: BuildMenuOption[];
    }
  | {
      open: false;
      padId?: undefined;
      options: [];
    };

const TOWER_ORDER: TowerKind[] = ['blaster', 'laser', 'forge'];

export function getBuildMenuOptions(coins: number): BuildMenuOption[] {
  return TOWER_ORDER.map((kind) => ({
    kind,
    label: kind[0].toUpperCase() + kind.slice(1),
    cost: TOWER_DEFS[kind].cost,
    canAfford: coins >= TOWER_DEFS[kind].cost,
    description: TOWER_DEFS[kind].description
  }));
}

export function getBuildMenuState({
  padId,
  occupiedPadIds,
  coins
}: {
  padId: string;
  occupiedPadIds: string[];
  coins: number;
}): BuildMenuState {
  if (occupiedPadIds.includes(padId)) {
    return {
      open: false,
      options: []
    };
  }

  return {
    open: true,
    padId,
    options: getBuildMenuOptions(coins)
  };
}
