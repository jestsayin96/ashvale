/* Bundled with esbuild into vendor/three.bundle.js: three plus the loaders the game
   needs, exposed as one global so the artifact can inline it as a plain script. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
globalThis.THREE = Object.assign({}, THREE, { GLTFLoader, skeletonClone });
