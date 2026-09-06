export const EARTH_RADIUS = 700;
export const seaLevel = (x: number) => Math.sqrt(EARTH_RADIUS ** 2 - x ** 2) - EARTH_RADIUS - .4;
