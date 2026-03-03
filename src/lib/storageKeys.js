export const STORAGE_KEYS = {
  characters: 'koa:characters:v2',
  quests: 'koa:quests:v2',
  relationships: 'koa:relationships:v1',
  launcher: 'koa:launcher:v1',
  launcherNotes: 'koa:launcher:notes:v1',
  bag: 'koa:bagofholding:v1',
  worldNpcs: 'koa:worldnpcs:v1',
  worldNpcDeepLink: 'koa:worldnpcs:deeplink:v1',
  charNpcs: 'koa:char:npcs:v1',
  combat: 'koa:combat:v4',
  // persisted world lore gallery (maps/scenes/locations/factions)
  worldLore: 'koa:worldlore:v1',
  menuCampaignBrief: 'koa:menu:campaignBrief:v2',
  menuNotePrefix: 'koa:menu:note:v2:',
};

export function menuNoteKey(section) {
  return `${STORAGE_KEYS.menuNotePrefix}${section}`;
}
