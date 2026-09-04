// ================================================================
// Google Maps & Geolocation Utilities
// ================================================================

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number;
  address?: string | null;
  full_address?: string | null;
}

interface GoogleGeocoderResult {
  formatted_address?: string;
  name?: string;
}

export interface GoogleMapPlaceData {
  name?: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number | (() => number);
      lng: number | (() => number);
    };
  };
}

export interface GoogleMapInstance {
  setCenter: (latLng: { lat: number; lng: number } | unknown) => void;
  panTo: (latLng: unknown) => void;
  setZoom: (zoom: number) => void;
  addListener: (
    event: string,
    handler: (e: { latLng: { lat: () => number; lng: () => number } }) => void
  ) => void;
}

export interface GoogleMarkerInstance {
  position?: unknown;
  map?: unknown;
  setPosition?: (latLng: unknown) => void;
  addListener: (
    event: string,
    handler: (e?: { latLng: { lat: () => number; lng: () => number } }) => void
  ) => void;
}

export interface GoogleAutocompleteInstance {
  addListener: (event: string, handler: () => void) => void;
  getPlace: () => GoogleMapPlaceData;
}

export interface GoogleMapsObject {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts?: Record<string, unknown>
      ) => GoogleAutocompleteInstance;
    };
    marker?: {
      AdvancedMarkerElement: new (options: {
        map?: unknown;
        position?: unknown;
        gmpDraggable?: boolean;
        title?: string;
      }) => GoogleMarkerInstance;
    };
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>
    ) => GoogleMapInstance;
    Marker?: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    LatLng: new (lat: number, lng: number) => unknown;
    Geocoder?: new () => {
      geocode: (
        request: { location: { lat: number; lng: number } },
        callback: (results: GoogleGeocoderResult[] | null, status: string) => void
      ) => void;
    };
    Animation?: {
      DROP: number;
    };
    event?: {
      clearInstanceListeners: (instance: unknown) => void;
    };
  };
}

let googleMapsPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

/**
 * Loads the Google Maps JavaScript SDK (with Places, Geometry, and Marker libraries)
 * and returns a promise that resolves when Google Maps is ready.
 */
export function loadGoogleMapsScript(apiKey?: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const win = window as unknown as { google?: GoogleMapsObject };
  const key = apiKey || getGoogleMapsApiKey();

  // If already loaded on window
  if (win.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script element already exists in document
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    if (existingScript) {
      if (win.google?.maps) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }

    if (!key) {
      googleMapsPromise = null;
      reject(new Error("Google Maps API key is not configured."));
      return;
    }

    const script = document.createElement("script");
    // loading=async prevents the suboptimal performance warning
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places,geometry,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => {
      googleMapsPromise = null;
      reject(err);
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

/**
 * Free fallback reverse geocoding via OpenStreetMap / BigDataCloud
 * Used when Google Cloud Project billing is disabled or limits are exceeded.
 */
async function fallbackReverseGeocode(lat: number, lng: number): Promise<string | null> {
  const addr = await reverseGeocode(lat, lng);
  return addr || null;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
}

/**
 * Searches place / address suggestions globally without requiring Google Cloud Billing.
 * Uses Komoot Photon & OpenStreetMap Nominatim with cascading fallbacks.
 */
export async function searchPlaceSuggestions(
  query: string
): Promise<PlaceSearchResult[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  // 1. Try Komoot Photon (Fast, free OSM geocoder, global coverage, no rate limit friction)
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.features) && data.features.length > 0) {
        return data.features.map(
          (
            feat: {
              geometry: { coordinates: [number, number] };
              properties: {
                osm_id?: number | string;
                name?: string;
                city?: string;
                state?: string;
                country?: string;
                street?: string;
                housenumber?: string;
              };
            },
            idx: number
          ) => {
            const props = feat.properties || {};
            const [lng, lat] = feat.geometry.coordinates;
            const title = props.name || props.street || props.city || "Place";
            const details = [
              props.street && props.street !== title ? props.street : null,
              props.city && props.city !== title ? props.city : null,
              props.state,
              props.country,
            ]
              .filter(Boolean)
              .join(", ");

            return {
              id: `photon-${props.osm_id || idx}-${lat}-${lng}`,
              name: title,
              description: details || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              latitude: lat,
              longitude: lng,
            };
          }
        );
      }
    }
  } catch {
    // Fallback to Nominatim
  }

  // 2. Try OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&addressdetails=1&limit=6`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );
    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item: any, idx: number) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const parts = (item.display_name || "").split(",");
          const title = parts[0]?.trim() || item.name || "Location";
          const details = parts.slice(1).join(",").trim();

          return {
            id: `nom-${item.place_id || idx}-${lat}-${lng}`,
            name: title,
            description:
              details || item.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            latitude: lat,
            longitude: lng,
          };
        });
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Reverse geocodes latitude and longitude into a formatted human-readable address.
 * Uses BigDataCloud Client Geocoder and OpenStreetMap Nominatim without Google Cloud billing errors.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return "";
  }

  // 1. Try Google Maps Geocoder if Google Maps JS is loaded
  if (typeof window !== "undefined" && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const res = await new Promise<string | null>((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === "OK" && Array.isArray(results) && results[0]?.formatted_address) {
            resolve(results[0].formatted_address);
          } else {
            resolve(null);
          }
        });
      });
      if (res && res.trim()) {
        return res.trim();
      }
    } catch {
      // fallback to next provider
    }
  }

  // 2. Try OpenStreetMap Nominatim (High detail, full address with street, area, city, pincode, country)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name && typeof data.display_name === "string" && data.display_name.trim()) {
        return data.display_name.trim();
      }
    }
  } catch {
    // try next fallback
  }

  // 3. Try BigDataCloud with full hierarchical address compilation
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const parts: string[] = [];

      const addPart = (val?: string | null) => {
        if (!val || typeof val !== "string") return;
        const trimmed = val.trim();
        if (trimmed && !parts.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
          parts.push(trimmed);
        }
      };

      // Extract detailed informative points (neighborhood, landmark, street)
      if (Array.isArray(data?.localityInfo?.informative)) {
        for (const item of data.localityInfo.informative) {
          if (item?.name) addPart(item.name);
        }
      }

      // Extract administrative hierarchy
      if (Array.isArray(data?.localityInfo?.administrative)) {
        for (const item of data.localityInfo.administrative) {
          if (item?.name) addPart(item.name);
        }
      }

      addPart(data.locality || data.city);
      addPart(data.principalSubdivision);
      addPart(data.postcode);
      addPart(data.countryName);

      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
  } catch {
    // try next fallback
  }

  // 4. Coordinates string fallback
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Queries the current geolocation permission status from the browser Permissions API.
 * Returns 'granted' | 'prompt' | 'denied' | 'unsupported'.
 */
export async function getGeolocationPermissionStatus(): Promise<
  "granted" | "prompt" | "denied" | "unsupported"
> {
  if (typeof window === "undefined") return "unsupported";
  if (!navigator?.geolocation) return "unsupported";

  try {
    if (navigator.permissions && typeof navigator.permissions.query === "function") {
      const result = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      return (result.state as "granted" | "prompt" | "denied") || "prompt";
    }
  } catch {
    // Some browsers like Safari or older Firefox may not support permissions.query for geolocation
  }

  return "prompt";
}

/**
 * Retrieves the device's current position via browser geolocation.
 * Features automatic multi-tier fallback (Standard Network/Wi-Fi -> High Accuracy GPS)
 * and clear user guidance when permissions are denied or context is insecure.
 */
export function getCurrentBrowserLocation(options?: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<{
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      reject(
        new Error(
          "Geolocation is not supported by your browser or environment. Please choose 'Drop your location'."
        )
      );
      return;
    }

    // Check secure context (browsers restrict geolocation on non-localhost HTTP)
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      reject(
        new Error(
          "Location access requires a secure connection (HTTPS). Please open this site via HTTPS or choose 'Drop your location'."
        )
      );
      return;
    }

    const highAccuracy = options?.enableHighAccuracy ?? false;
    const timeoutMs = options?.timeout ?? 12000;
    const maxAge = options?.maximumAge ?? 30000;

    // First attempt: trigger browser prompt immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, altitude, accuracy } = position.coords;
        resolve({
          latitude,
          longitude,
          altitude: typeof altitude === "number" && !isNaN(altitude) ? altitude : null,
          accuracy: typeof accuracy === "number" ? accuracy : 0,
        });
      },
      (firstErr) => {
        // If permission was denied by the user in browser prompt
        if (firstErr.code === firstErr.PERMISSION_DENIED) {
          reject(new Error("Location permission denied"));
          return;
        }

        // If position was unavailable or timed out, retry with high accuracy if not already tried
        if (!highAccuracy) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const { latitude, longitude, altitude, accuracy } = fallbackPos.coords;
              resolve({
                latitude,
                longitude,
                altitude:
                  typeof altitude === "number" && !isNaN(altitude) ? altitude : null,
                accuracy: typeof accuracy === "number" ? accuracy : 0,
              });
            },
            (fallbackErr) => {
              reject(fallbackErr || new Error("Could not retrieve location"));
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }
          );
        } else {
          reject(firstErr || new Error("Could not retrieve location"));
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: timeoutMs,
        maximumAge: maxAge,
      }
    );
  });
}

/**
 * Detects if a text prompt/query is asking for location-dependent or proximity information.
 */
export function isLocationQuery(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  const q = text.toLowerCase().trim();

  const locationPatterns = [
    // Direct proximity keywords
    /\bnear\s+me\b/i,
    /\bnearby\b/i,
    /\bnearest\b/i,
    /\bclosest\b/i,
    /\bclose\s+by\b/i,
    /\baround\s+(me|here|us|this\s+place|this\s+area)\b/i,
    /\bclose\s+to\s+(me|here|us)\b/i,
    /\bin\s+my\s+(area|city|locality|neighborhood|town|vicinity)\b/i,
    /\bnear\s+here\b/i,
    /\bfrom\s+(here|my\s+location|my\s+place|where\s+i\s+am)\b/i,
    /\bin\s+this\s+(area|city|vicinity|neighborhood)\b/i,
    /\blocal\s+(places|spots|food|restaurants|cafes|weather|events|attractions|stores|shops)\b/i,

    // Route / Directions / Navigation (including typos like 'rout' / 'rout for')
    /\b(best\s+)?(rout|route|routes|way|directions?|path|navigation|drive|commute)\s+(for|to|towards|from|of)\b/i,
    /\b(how\s+to\s+(reach|get\s+to|go\s+to|travel\s+to|drive\s+to|walk\s+to|navigate\s+to))\b/i,
    /\b(how\s+can\s+i\s+(reach|get\s+to|go\s+to|travel\s+to))\b/i,
    /\b(distance\s+(to|from|between)|how\s+far\s+is)\b/i,
    /\b(directions?\s+to|route\s+to|rout\s+for|route\s+for|path\s+to|way\s+to)\b/i,
    /\b(best\s+way\s+to\s+(get|go|reach|travel))\b/i,

    // User asking about their own location
    /\bwhere\s+am\s+i\b/i,
    /\bwhat\s+is\s+my\s+(current\s+)?(location|address|city|area|coordinates)\b/i,
    /\bmy\s+(current\s+)?(location|gps|coordinates|position)\b/i,
    /\bcurrent\s+location\b/i,
    /\bdetect\s+(my\s+)?location\b/i,
    /\bget\s+(my\s+)?(current\s+)?location\b/i,

    // Finding places/activities around/near
    /\b(places|things)\s+to\s+(visit|see|do|eat|hangout|explore|go)\b/i,
    /\b(good|best|top|famous)\s+(restaurants?|cafes?|places?|hotels?|spots?|food|places\s+to\s+eat)\s+(near|around|in|at|nearby|here)\b/i,

    // Specific explicit location entities / services
    /\b(gas\s+station|petrol\s+pump|fuel\s+station|ev\s+station|ev\s+charger|charging\s+station|coffee\s+shop|shopping\s+mall|movie\s+theater|medical\s+store|police\s+station|car\s+repair|bike\s+repair|railway\s+station|bus\s+stand|metro\s+station|airport)\b/i,

    // Finding/Searching specific amenities
    /\b(find|search|show|suggest|recommend|list|look\s+for|give\s+me)\s+(some\s+|the\s+|best\s+|good\s+|top\s+)?(restaurants?|cafes?|coffee\s+shops?|hotels?|spots?|food\s+places?|hospitals?|pharmacies|clinics?|atms?|banks?|petrol\s+pumps?|fuel\s+stations?|gas\s+stations?|ev\s+chargers?|gyms?|malls?|parks?|garages?|mechanics?|places?)\b/i,

    // Where is the closest/nearest...
    /\bwhere\s+is\s+the\s+(closest|nearest|nearest\s+available|best)\b/i,
    /\bwhere\s+can\s+i\s+(find|get|buy|eat|drink|stay|park|charge)\b/i,
    /\b(find|search|show|suggest|recommend|list)\s+.*(near\s+me|nearby|nearest|closest|around\s+here|in\s+my\s+area|in\s+this\s+city)\b/i,

    // Weather / temperature at current place
    /\b(weather|temperature|forecast|rain|climate)\s+(today|now|here|outside|currently|in\s+my\s+area|near\s+me)\b/i,
  ];

  return locationPatterns.some((pattern) => pattern.test(q));
}

/**
 * Storage key for persisting detected/selected user location across sessions
 */
export const LOCATION_STORAGE_KEY = "ai_chat_saved_location";

export interface StoredUserLocation extends GeolocationCoordinates {
  timestamp: number;
}

/**
 * Persists the user's location coordinates and formatted address in localStorage.
 */
export function saveStoredUserLocation(location: GeolocationCoordinates): void {
  if (typeof window === "undefined" || !location) return;
  try {
    const payload: StoredUserLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      altitude: location.altitude ?? null,
      accuracy: location.accuracy,
      address:
        location.address ||
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      full_address:
        location.full_address ||
        location.address ||
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      timestamp: Date.now(),
    };
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to save location to localStorage:", e);
  }
}

/**
 * Retrieves the stored user location from localStorage.
 * Defaults to valid within 24 hours.
 */
export function getStoredUserLocation(maxAgeHours: number = 24): GeolocationCoordinates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUserLocation;
    if (
      typeof parsed?.latitude === "number" &&
      !isNaN(parsed.latitude) &&
      typeof parsed?.longitude === "number" &&
      !isNaN(parsed.longitude)
    ) {
      if (maxAgeHours > 0 && parsed.timestamp) {
        const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
        if (ageHours > maxAgeHours) {
          return null;
        }
      }
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        altitude: parsed.altitude ?? null,
        accuracy: parsed.accuracy,
        address:
          parsed.address ||
          `${parsed.latitude.toFixed(5)}, ${parsed.longitude.toFixed(5)}`,
        full_address: parsed.full_address || parsed.address,
      };
    }
  } catch (e) {
    console.warn("Failed to parse stored location:", e);
  }
  return null;
}

/**
 * Clears the stored user location from localStorage.
 */
export function clearStoredUserLocation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear stored location:", e);
  }
}

/**
 * Checks if an AI response is requesting the user's location or if the query requires location.
 */
export function isLocationPromptRequired(
  message: {
    content?: string;
    locationRequired?: boolean;
    requires_location?: boolean;
    location_required?: boolean;
    locationCoordinates?: any;
    locationMethods?: string[];
    role?: string;
    isError?: boolean;
  },
  precedingUserText?: string
): boolean {
  // If explicitly flagged as an error, never show location prompts
  if (message.isError) return false;

  // If already satisfied with coordinates on this specific message, no prompt needed
  if (message.locationCoordinates) return false;

  const content = typeof message.content === "string" ? message.content.toLowerCase().trim() : "";

  // Never treat error responses as location requests
  if (
    /(unable\s+to\s+generate|failed\s+to|an\s+error\s+occurred|something\s+went\s+wrong|internal\s+server\s+error|network\s+error|request\s+timed\s+out|upload\s+failed|could\s+not\s+generate|service\s+unavailable|error\s+processing|try\s+again\s+later)/i.test(
      content
    )
  ) {
    return false;
  }

  // Direct backend flags: backend explicitly requested location
  if (
    message.locationRequired === true ||
    message.requires_location === true ||
    message.location_required === true ||
    (Array.isArray(message.locationMethods) && message.locationMethods.length > 0)
  ) {
    return true;
  }

  // Check if AI message asks or mentions needing user location or starting point
  const aiLocationPhrases = [
    /(please|could\s+you|kindly)?\s*(share|provide|grant|allow|drop|select|choose|enable|send|give|set|tell\s+me|enter|let\s+me\s+know)\s+(me\s+)?(your\s+)?(starting\s+)?(location|point|place|gps|pin|coordinates|area|address|city)/i,
    /(starting\s+(point|location|place|address|city|from))/i,
    /(where\s+you('re|\s+are)\s+(traveling|starting|coming)\s+from)/i,
    /(location|gps|coordinates)\s+(is|are)\s*(required|needed|necessary|helpful)/i,
    /i\s+(need|require|don't\s+have|do\s+not\s+have)\s+(your\s+)?(current\s+)?(location|coordinates|gps|pin|city|area|starting)/i,
    /(to\s+(help|assist|find|show|give|provide|recommend|suggest)\s+.*(need|require|share|know|enter)\s+.*(location|area|city|pin|starting|route|point))/i,
    /where\s+(are\s+you|is\s+your\s+current)\s+(located|location|city)/i,
    /(drop|pin)\s+(your\s+)?location\s+on\s+the\s+map/i,
    /access\s+(to\s+)?(your\s+)?location/i,
    /enable\s+(browser\s+|device\s+)?location/i,
    /which\s+(city|area|neighborhood|location)\s+are\s+you\s+(in|at|currently)/i,
    /without\s+(your\s+)?(location|coordinates|gps|pin|starting)/i,
    /permission\s+to\s+access\s+your\s+location/i,
    /location\s+picker/i,
    /starting\s+location/i,
  ];

  if (aiLocationPhrases.some((p) => p.test(content))) {
    return true;
  }

  return false;
}




