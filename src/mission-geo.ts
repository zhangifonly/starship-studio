import SunCalc from 'suncalc';

export type GeoPoint = { lat: number; lon: number; altitudeM: number };
export type XYZ = { x: number; y: number; z: number };
export const WGS84_A = 6378137;
export const WGS84_B = 6356752.314245;
export const METERS_PER_GLOBE_UNIT = 1000000;
export const METERS_PER_LOCAL_UNIT = 10;
const rad = Math.PI / 180;
const e2 = 1 - (WGS84_B / WGS84_A) ** 2;

// ECEF: X = Greenwich equator, Y = 90 E equator, Z = north pole.
export function geodeticToEcef({ lat, lon, altitudeM }: GeoPoint): XYZ {
  const phi = lat * rad, lambda = lon * rad;
  const n = WGS84_A / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return { x: (n + altitudeM) * Math.cos(phi) * Math.cos(lambda), y: (n + altitudeM) * Math.cos(phi) * Math.sin(lambda), z: (n * (1 - e2) + altitudeM) * Math.sin(phi) };
}

export function ecefToGeodetic(p: XYZ): GeoPoint {
  const r = Math.hypot(p.x, p.y);
  if (r < 1e-8) return { lat: p.z >= 0 ? 90 : -90, lon: 0, altitudeM: Math.abs(p.z) - WGS84_B };
  let phi = Math.atan2(p.z, r * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const n = WGS84_A / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(p.z + e2 * n * Math.sin(phi), r);
  }
  const n = WGS84_A / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return { lat: phi / rad, lon: Math.atan2(p.y, p.x) / rad, altitudeM: r * Math.cos(phi) + p.z * Math.sin(phi) - n * (1 - e2 * Math.sin(phi) ** 2) };
}

export function enuBasis(origin: GeoPoint) {
  const p = origin.lat * rad, l = origin.lon * rad;
  return { east: { x: -Math.sin(l), y: Math.cos(l), z: 0 }, north: { x: -Math.sin(p) * Math.cos(l), y: -Math.sin(p) * Math.sin(l), z: Math.cos(p) }, up: { x: Math.cos(p) * Math.cos(l), y: Math.cos(p) * Math.sin(l), z: Math.sin(p) } };
}
export function enuToEcef(localM: XYZ, origin: GeoPoint): XYZ {
  const p = geodeticToEcef(origin), b = enuBasis(origin);
  return { x: p.x + localM.x * b.east.x + localM.y * b.north.x + localM.z * b.up.x, y: p.y + localM.x * b.east.y + localM.y * b.north.y + localM.z * b.up.y, z: p.z + localM.x * b.east.z + localM.y * b.north.z + localM.z * b.up.z };
}
export function ecefDirectionToEnu(direction: XYZ, origin: GeoPoint): XYZ {
  const b = enuBasis(origin), dot = (a: XYZ) => a.x * direction.x + a.y * direction.y + a.z * direction.z;
  return { x: dot(b.east), y: dot(b.north), z: dot(b.up) };
}
export function ecefToEnu(position: XYZ, origin: GeoPoint): XYZ {
  const p = geodeticToEcef(origin);
  return ecefDirectionToEnu({ x: position.x - p.x, y: position.y - p.y, z: position.z - p.z }, origin);
}
export function localToGeo(local: XYZ, origin: GeoPoint): GeoPoint {
  return ecefToGeodetic(enuToEcef({ x: local.x * METERS_PER_LOCAL_UNIT, y: -local.z * METERS_PER_LOCAL_UNIT, z: local.y * METERS_PER_LOCAL_UNIT }, origin));
}
export function geoToLocal(geo: GeoPoint, origin: GeoPoint): XYZ {
  const p = ecefToEnu(geodeticToEcef(geo), origin);
  return { x: p.x / METERS_PER_LOCAL_UNIT, y: p.z / METERS_PER_LOCAL_UNIT, z: -p.y / METERS_PER_LOCAL_UNIT };
}
export function ecefToGlobe(p: XYZ): XYZ { return { x: p.x / METERS_PER_GLOBE_UNIT, y: p.z / METERS_PER_GLOBE_UNIT, z: -p.y / METERS_PER_GLOBE_UNIT }; }
export function geoToGlobe(p: GeoPoint): XYZ { return ecefToGlobe(geodeticToEcef(p)); }

// SunCalc 1.9 uses radians, azimuth measured from south towards west.
export function sunDirectionEcef(date: Date): XYZ {
  const { azimuth: a, altitude: h } = SunCalc.getPosition(date, 0, 0);
  return { x: Math.sin(h), y: -Math.cos(h) * Math.sin(a), z: -Math.cos(h) * Math.cos(a) };
}
export function solarElevation(date: Date, location: GeoPoint) { return SunCalc.getPosition(date, location.lat, location.lon).altitude / rad; }
export function daylightLabel(elevation: number) { return elevation >= 0 ? '日照' : elevation >= -6 ? '曙暮光' : '夜间'; }

export function interpolateGeo(a: GeoPoint, b: GeoPoint, fraction: number): GeoPoint {
  const f = Math.max(0, Math.min(1, fraction));
  const delta = ((b.lon - a.lon + 540) % 360) - 180;
  return { lat: a.lat + (b.lat - a.lat) * f, lon: ((a.lon + delta * f + 540) % 360) - 180, altitudeM: a.altitudeM + (b.altitudeM - a.altitudeM) * f };
}
