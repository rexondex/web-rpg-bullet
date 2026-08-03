import type { GameProtocol } from '../types';

export class ContentError extends Error { constructor(public issues: string[]) { super(`게임 설정 오류 ${issues.length}개`); } }

export async function loadGameContent(url = './game-data/game.json'): Promise<GameProtocol> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`게임 설정을 불러오지 못했습니다. (${response.status})`);
  const data = await response.json() as GameProtocol;
  const issues = validateContent(data);
  if (!issues.length) issues.push(...await validateAssetFiles(data));
  if (issues.length) throw new ContentError(issues);
  return data;
}

async function validateAssetFiles(data: GameProtocol): Promise<string[]> {
  const files = [
    ...Object.entries(data.assets.images).map(([id, value]) => [`assets.images.${id}`, value.src] as const),
    ...Object.entries(data.assets.spritesheets).map(([id, value]) => [`assets.spritesheets.${id}`, value.src] as const),
    ...Object.entries(data.assets.audio).flatMap(([id, value]) => value.src.map((src) => [`assets.audio.${id}`, src] as const)),
    ...Object.entries(data.maps).filter(([, map]) => !!map.tiled).map(([id, map]) => [`maps.${id}.tiled.json`, map.tiled!.json] as const),
  ];
  const results = await Promise.all(files.map(async ([path, src]) => {
    try { const response = await fetch(src, { method: 'HEAD' }); return response.ok ? null : `${path}.src: 파일을 찾을 수 없습니다. '${src}'`; }
    catch { return `${path}.src: 파일에 접근할 수 없습니다. '${src}'`; }
  }));
  return results.filter((issue): issue is string => issue !== null);
}

export function validateContent(data: GameProtocol): string[] {
  const issues: string[] = [];
  const gridCells = new Map<string, string>();
  const hasVisual = (id: string | undefined) => !!id && (!!data.assets?.images?.[id] || !!data.assets?.spritesheets?.[id]);
  const insidePolygon = (point:{x:number;y:number},vertices:{x:number;y:number}[]):boolean => {let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
  if (data.protocolVersion !== 3) issues.push(`protocolVersion: 지원 버전은 3입니다.`);
  if (!data.game?.id || !data.game?.version) issues.push('game.id와 game.version은 필수입니다.');
  if (!data.maps?.[data.player?.startMap]) issues.push(`player.startMap: 존재하지 않는 맵 '${data.player?.startMap}'`);
  if (!data.assets) issues.push('assets: 에셋 매니페스트는 필수입니다.');
  if (!hasVisual(data.player?.texture)) issues.push(`player.texture: 존재하지 않는 에셋 '${data.player?.texture}'`);
  if (data.player?.portrait && !data.assets?.images?.[data.player.portrait]) issues.push(`player.portrait: 존재하지 않는 이미지 '${data.player.portrait}'`);
  (data.player?.startingSkills ?? []).forEach((id) => { if (!data.skills?.[id]) issues.push(`player.startingSkills: 존재하지 않는 스킬 '${id}'`); });
  Object.entries(data.maps ?? {}).forEach(([mapId, map]) => {
    const cellKey = `${map.grid?.x},${map.grid?.y}`; if (gridCells.has(cellKey)) issues.push(`maps.${mapId}.grid: '${gridCells.get(cellKey)}' 맵과 좌표가 겹칩니다.`); else gridCells.set(cellKey, mapId);
    const walkable=(point:{x:number;y:number})=>!map.walkableAreas?.length||map.walkableAreas.some(area=>insidePolygon(point,area.points));
    map.walkableAreas?.forEach((area,i)=>{if(area.points.length<3)issues.push(`maps.${mapId}.walkableAreas[${i}]: 점이 3개 이상 필요합니다.`);area.points.forEach((point,j)=>{if(point.x<0||point.x>960||point.y<0||point.y>540)issues.push(`maps.${mapId}.walkableAreas[${i}].points[${j}]: 960×540 맵 범위를 벗어났습니다.`);});});
    if(!walkable(map.spawn))issues.push(`maps.${mapId}.spawn: 보행 가능 영역 밖에 있습니다.`);
    map.exits.forEach((exit, i) => { const target = data.maps[exit.to]; if (!target) issues.push(`maps.${mapId}.exits[${i}].to: 존재하지 않는 맵 '${exit.to}'`); else if(exit.targetX===undefined||exit.targetY===undefined){ const dx=target.grid.x-map.grid.x,dy=target.grid.y-map.grid.y,expected=exit.direction==='east'?[1,0]:exit.direction==='west'?[-1,0]:exit.direction==='north'?[0,-1]:[0,1]; if(dx!==expected[0]||dy!==expected[1])issues.push(`maps.${mapId}.exits[${i}]: ${exit.direction} 출구와 '${exit.to}'의 격자 좌표가 맞지 않습니다.`); } });
    map.npcs.forEach((placement, i) => { if (!data.npcs[placement.npcId]) issues.push(`maps.${mapId}.npcs[${i}]: 존재하지 않는 NPC '${placement.npcId}'`); if(!walkable(placement))issues.push(`maps.${mapId}.npcs[${i}]: 보행 가능 영역 밖에 있습니다.`); placement.route?.forEach((point,j)=>{if(!walkable(point))issues.push(`maps.${mapId}.npcs[${i}].route[${j}]: 보행 가능 영역 밖에 있습니다.`);}); });
    map.spawns.forEach((spawn, i) => { if (!data.monsters[spawn.monsterId]) issues.push(`maps.${mapId}.spawns[${i}]: 존재하지 않는 몬스터 '${spawn.monsterId}'`); if (spawn.max < 0 || spawn.respawnMs < 500) issues.push(`maps.${mapId}.spawns[${i}]: max와 respawnMs 값이 유효하지 않습니다.`); });
    if (map.backgroundImage && !data.assets?.images?.[map.backgroundImage]) issues.push(`maps.${mapId}.backgroundImage: 존재하지 않는 이미지 '${map.backgroundImage}'`);
    if (map.music && !data.assets?.audio?.[map.music]) issues.push(`maps.${mapId}.music: 존재하지 않는 오디오 '${map.music}'`);
    map.objects?.forEach((object, i) => { if (object.texture && !hasVisual(object.texture)) issues.push(`maps.${mapId}.objects[${i}].texture: 존재하지 않는 에셋 '${object.texture}'`); });
    map.tiled?.tilesets.forEach((tileset, i) => { if (!hasVisual(tileset.image)) issues.push(`maps.${mapId}.tiled.tilesets[${i}].image: 존재하지 않는 에셋 '${tileset.image}'`); });
  });
  Object.entries(data.npcs ?? {}).forEach(([id, npc]) => { if (!data.dialogues[npc.dialogue]) issues.push(`npcs.${id}.dialogue: 존재하지 않는 대화 '${npc.dialogue}'`); if (!hasVisual(npc.texture)) issues.push(`npcs.${id}.texture: 존재하지 않는 에셋 '${npc.texture}'`); if (npc.portrait && !data.assets?.images?.[npc.portrait]) issues.push(`npcs.${id}.portrait: 존재하지 않는 이미지 '${npc.portrait}'`); });
  Object.entries(data.monsters ?? {}).forEach(([id, monster]) => { if (!hasVisual(monster.texture)) issues.push(`monsters.${id}.texture: 존재하지 않는 에셋 '${monster.texture}'`); monster.drops.forEach((drop, i) => { if (!data.items[drop.itemId]) issues.push(`monsters.${id}.drops[${i}]: 존재하지 않는 아이템 '${drop.itemId}'`); if (drop.chance < 0 || drop.chance > 1) issues.push(`monsters.${id}.drops[${i}].chance: 0~1이어야 합니다.`); }); });
  Object.entries(data.quests ?? {}).forEach(([id, quest]) => { quest.objectives.forEach((objective, i) => { if (!['kill', 'talk', 'visit', 'collect', 'custom'].includes(objective.type)) issues.push(`quests.${id}.objectives[${i}].type: 알 수 없는 타입`); }); Object.keys(quest.rewards.items ?? {}).forEach((itemId) => { if (!data.items[itemId]) issues.push(`quests.${id}.rewards: 존재하지 않는 아이템 '${itemId}'`); }); });
  const slots = new Set((data.equipmentSlots ?? []).map((slot) => slot.id));
  Object.entries(data.items ?? {}).forEach(([id, item]) => { if (item.type === 'equipment' && (!item.slot || !slots.has(item.slot))) issues.push(`items.${id}.slot: 존재하지 않는 장비 슬롯 '${item.slot}'`); if (item.icon && !data.assets?.images?.[item.icon]) issues.push(`items.${id}.icon: 존재하지 않는 이미지 '${item.icon}'`); });
  Object.entries(data.shops ?? {}).forEach(([id, shop]) => { if (!data.currencies?.[shop.currency]) issues.push(`shops.${id}.currency: 존재하지 않는 화폐 '${shop.currency}'`); shop.items.forEach((item, i) => { if (!data.items[item.itemId]) issues.push(`shops.${id}.items[${i}]: 존재하지 않는 아이템 '${item.itemId}'`); }); });
  Object.entries(data.npcs ?? {}).forEach(([id, npc]) => { if (npc.shop && !data.shops?.[npc.shop]) issues.push(`npcs.${id}.shop: 존재하지 않는 상점 '${npc.shop}'`); });
  Object.entries(data.assets?.animations ?? {}).forEach(([id, animation]) => { if (!data.assets.spritesheets[animation.texture]) issues.push(`assets.animations.${id}.texture: 존재하지 않는 스프라이트시트 '${animation.texture}'`); });
  Object.entries(data.dialogues ?? {}).forEach(([id, nodes]) => { const ids = new Set(nodes.map((n) => n.id)); nodes.forEach((node) => { if (node.next && !ids.has(node.next)) issues.push(`dialogues.${id}.${node.id}.next: 존재하지 않는 노드 '${node.next}'`); if (node.portrait && !data.assets?.images?.[node.portrait]) issues.push(`dialogues.${id}.${node.id}.portrait: 존재하지 않는 이미지 '${node.portrait}'`); }); });
  return issues;
}
