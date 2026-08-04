import type { ShooterProtocol } from './types';

export const ENGINE_CAPABILITIES = new Set([
  'formation.line','formation.v','formation.sweep',
  'movement.linear','movement.sine','movement.stationary',
  'pattern.radial','pattern.aimed','pattern.fan','pattern.spiral','pattern.rain',
  'shot.parallel','shot.fan','bomb.clear-and-damage','bomb.clear-only',
]);

export function collectRequiredCapabilities(data:ShooterProtocol):Set<string>{
  const required=new Set<string>();
  data.stages?.forEach(stage=>stage.waves?.forEach(wave=>required.add(`formation.${wave.formation?.type}`)));
  Object.values(data.enemies??{}).forEach(enemy=>{if(enemy.movement)required.add(`movement.${enemy.movement.type}`);enemy.patterns?.forEach(pattern=>required.add(`pattern.${pattern.type}`));});
  Object.values(data.players??{}).forEach(player=>{player.shotLevels?.forEach(level=>required.add(`shot.${level.type}`));if(player.bomb)required.add(`bomb.${player.bomb.type}`);});
  Object.values(data.bosses??{}).forEach(boss=>{required.add(`movement.${boss.movement?.type}`);boss.phases?.forEach(phase=>phase.patterns?.forEach(pattern=>required.add(`pattern.${pattern.type}`)));});
  return required;
}
