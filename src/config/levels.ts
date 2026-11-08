import shapes from './colliders.json';
export const LEVELS = shapes.map((shape) => ({...shape, points: shape.level === 1 ? 0 : 2 ** shape.level, diameter: 30 * 1.18 ** (shape.level - 1)}));
export const levelData = (level: number) => LEVELS[level - 1];
export function pickLevel(random: () => number = Math.random): number {
  const value = random();
  return value < .35 ? 1 : value < .65 ? 2 : value < .85 ? 3 : 4;
}
export const mergePoints = (level: number) => level === 11 ? 4096 : 2 ** (level + 1);
