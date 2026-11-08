export const FIELD = { width: 760, height: 440, left: 26, right: 734, top: 22, floor: 410, danger: 82 };
export const RULES = {step: 1000/60, dropCooldown: 500, dropTimeout: 1500, dangerTime: 2000};
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
