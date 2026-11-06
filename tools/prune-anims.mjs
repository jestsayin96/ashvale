/* KayKit characters carry 76 clips each and the animation data, not the textures, is what
   makes them heavy. Keep only the ones the simulation asks for. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const KEEP = new Set(['Idle','Unarmed_Idle','Walking_A','Walking_B','Walking_C','Running_A',
  'Death_A','Death_A_Pose','Hit_A','Block','Blocking','Cheer','Interact','PickUp','Throw',
  '1H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop','2H_Melee_Attack_Spin','2H_Melee_Idle',
  '1H_Ranged_Aiming','1H_Ranged_Shoot','2H_Ranged_Aiming','2H_Ranged_Shoot',
  'Spellcast_Raise','Spellcast_Shoot','Spellcasting',
  'Sit_Chair_Idle','Sit_Floor_Idle','Lie_Idle','Lie_Pose']);

const dir = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of readdirSync(dir).filter(n => n.endsWith('.glb'))) {
  const path = join(dir, f);
  const doc = await io.read(path);
  const root = doc.getRoot();
  const before = root.listAnimations().length;
  for (const a of root.listAnimations()) if (!KEEP.has(a.getName())) a.dispose();
  await doc.transform(resample({ tolerance: 1e-3 }), dedup(), prune());
  await io.write(path, doc);
  console.log(`  ${f.padEnd(22)} ${before} -> ${root.listAnimations().length} clips`);
}
