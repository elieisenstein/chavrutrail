// src/lib/mapbox.ts
import MapboxGL from '@rnmapbox/maps';

// Initialize Mapbox with your access token
import Constants from "expo-constants";
const token = Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN;

console.log("MAPBOX_ACCESS_TOKEN (Constants.extra):", token ? "SET" : "MISSING");

// Optional: only call setAccessToken if token exists
if (token) {
  MapboxGL.setAccessToken(token);
}

// Default map settings
export const DEFAULT_MAP_STYLE = MapboxGL.StyleURL.Outdoors;

// Israel center coordinates (for default view)
export const ISRAEL_CENTER = {
  latitude: 31.5,
  longitude: 34.75,
  latitudeDelta: 2.5,
  longitudeDelta: 2.5,
};

// Closer zoom for user location
export const USER_LOCATION_ZOOM = {
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

// Israel Hiking Map tile URLs
export const getIsraelHikingTiles = (language: 'he' | 'en') => {
  const baseTiles = language === 'he'
    ? 'https://israelhiking.osm.org.il/Hebrew/Tiles/{z}/{x}/{y}.png'
    : 'https://israelhiking.osm.org.il/English/Tiles/{z}/{x}/{y}.png';
  
  const trailTiles = 'https://israelhiking.osm.org.il/OverlayTiles/{z}/{x}/{y}.png';
  
  return { baseTiles, trailTiles };
};

export default MapboxGL;
