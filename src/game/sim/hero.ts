export const HERO_RESPAWN_SECONDS = 30;
export const HERO_REGEN_DELAY_SECONDS = 15;
export const HERO_REGEN_PER_SECOND = 6;

export function getHeroRespawnLabel(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return 'Ready';
  }

  return `Recovering in ${Math.ceil(secondsRemaining)}s`;
}

export function getHeroRecoveryProgress(secondsRemaining: number): number {
  return Math.max(0, Math.min(1, 1 - secondsRemaining / HERO_RESPAWN_SECONDS));
}

export function getHeroRegen({
  hp,
  maxHp,
  secondsSinceDamage,
  dt
}: {
  hp: number;
  maxHp: number;
  secondsSinceDamage: number;
  dt: number;
}): number {
  if (hp <= 0 || hp >= maxHp || secondsSinceDamage < HERO_REGEN_DELAY_SECONDS) {
    return hp;
  }

  return Math.min(maxHp, hp + HERO_REGEN_PER_SECOND * dt);
}
