import * as THREE from "three";

/** Shared materials: one allocation for the whole scene keeps draw state cheap. */
const std = (color: string, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export const mat = {
  wall: std("#f1ece4", 0.9),
  trim: std("#cfc6b8", 0.8),
  glass: new THREE.MeshStandardMaterial({
    color: "#bcd8e6",
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
  woodFloor: std("#a9784c", 0.6),
  stoneFloor: std("#bdb7ad", 0.45),
  carpetFloor: std("#6b7686", 0.95),
  corridorFloor: std("#d3cdc2", 0.5),
  wood: std("#8a5a36", 0.55),
  woodDark: std("#5b3b24", 0.55),
  stone: std("#d9d4cb", 0.35),
  metal: std("#3a3f47", 0.4, 0.7),
  fabric: std("#44556b", 0.95),
  fabricWarm: std("#9a7b5f", 0.95),
  chair: std("#2f343c", 0.8),
  leaf: std("#3f7d4e", 0.85),
  leafLight: std("#5aa469", 0.85),
  pot: std("#e8e3da", 0.6),
  soil: std("#3b2c20", 1),
  screenOff: std("#14181d", 0.3),
  screenGlow: new THREE.MeshStandardMaterial({
    color: "#7fd0ff",
    emissive: "#4fb4f0",
    emissiveIntensity: 0.9,
    roughness: 0.3,
  }),
  holo: new THREE.MeshBasicMaterial({
    color: "#8fe3ff",
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  }),
  player: std("#1f3a5f", 0.6),
  skin: std("#e0b48f", 0.7),
  accent: new THREE.MeshStandardMaterial({
    color: "#d9a441",
    emissive: "#d9a441",
    emissiveIntensity: 0.25,
    roughness: 0.4,
  }),
};
