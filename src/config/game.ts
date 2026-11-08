export const FIELD = { width: 420, height: 650, left: 30, right: 390, top: 28, floor: 609, danger: 108 };
export const RULES = {step: 1000/60, dropCooldown: 500, dropTimeout: 1500, dangerTime: 2000};
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
