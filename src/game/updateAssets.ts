/** Immutable pointers for the supplied expansion, normalized to shared foot anchors. */
const pointers = import.meta.glob<{ default: { url: string } }>('./assets/update/*.asset.json', { eager: true });
export const UPDATE_ASSETS: Record<string, string> = {};
for (const [path, pointer] of Object.entries(pointers)) {
  const key = path.split('/').at(-1)?.replace('.png.asset.json', '');
  if (key) UPDATE_ASSETS[key] = pointer.default.url;
}
export function updateAsset(key: string): string {
  const url = UPDATE_ASSETS[key];
  if (!url) throw new Error(`Missing expansion asset: ${key}`);
  return url;
}
export const EXPANSION_OVERRIDES = [
  ...['normal', 'ssj', 'kaioken'].map((form) => ({ texture: `update_goku_punch_${form}`, url: updateAsset(`update_goku_punch_${form}`), keys: [`${form}:punch`], frames: [0,1,2,3,4,5,6,7], fps: 18, repeat: 0 })),
  ...['kaioken', 'ssj'].flatMap((form) => [
    ...['walk', 'run'].map((action) => ({ texture: `update_${form}_${action}`, url: updateAsset(`update_${form}_${action}`), keys: [`${form}:${action}-left`, `${form}:${action}-right`], frames: [0,1,2,3,4,5,6,7], fps: action === 'walk' ? 8 : 12, repeat: -1 })),
    ...[['jump', [1,2,3,4]], ['fall', [5]], ['land', [6,7]]].map(([action, frames]) => ({ texture: `update_${form}_air`, url: updateAsset(`update_${form}_air`), keys: [`${form}:${action}`], frames: frames as number[], fps: 12, repeat: 0 })),
  ]),
  { texture: 'update_ssj_charge', url: updateAsset('update_ssj_charge'), keys: ['ssj:charge-start'], frames: [0,1,2,3,4,5], fps: 10, repeat: 0 },
  { texture: 'update_ssj_charge', url: updateAsset('update_ssj_charge'), keys: ['ssj:charge-loop'], frames: [6,7], fps: 8, repeat: -1 },
  { texture: 'goku_death', url: updateAsset('goku_death'), keys: ['normal:death'], frames: [0,1,2,3,4,5,6,7,8,9,10], fps: 13, repeat: 0 },
];
