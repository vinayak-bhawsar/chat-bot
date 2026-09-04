"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  X,
  Loader2,
  Search,
  AlertCircle,
  LocateFixed,
  Check,
  Navigation,
  ExternalLink,
  ChevronRight,
  Compass,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  reverseGeocode,
  getCurrentBrowserLocation,
  searchPlaceSuggestions,
  PlaceSearchResult,
  GeolocationCoordinates,
  saveStoredUserLocation,
} from "@/lib/maps";

export interface MapSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  location?: GeolocationCoordinates | null;
  onUpdateLocation?: (coords: GeolocationCoordinates) => void;
}

export default function MapSidePanel({
  isOpen,
  onClose,
  location,
  onUpdateLocation,
}: MapSidePanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSearchResult[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Selected Pin Coordinates & Formatted Address
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    placeName?: string;
  } | null>(null);

  // Custom marker icon with pulsing styling
  const createCustomIcon = useCallback((L: any) => {
    return L.divIcon({
      className: "custom-map-marker-sidepanel",
      html: `
        <div style="position: relative; width: 40px; height: 40px; transform: translate(-50%, -100%); cursor: grab;">
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 18px; height: 6px; background: rgba(0,0,0,0.28); border-radius: 50%; filter: blur(2px);"></div>
          <div style="width: 40px; height: 40px; background: #0e879c; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(14,135,156,0.5); transition: transform 0.15s ease;">
            <div style="width: 14px; height: 14px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
  }, []);

  // Pan / Fly map and update location state
  const updateMapPosition = useCallback(
    async (
      lat: number,
      lng: number,
      explicitAddress?: string,
      placeName?: string,
      shouldFly: boolean = false,
      zoomLevel?: number
    ) => {
      const L = leafletRef.current;
      const map = mapInstanceRef.current;

      if (map && L) {
        const targetZoom = zoomLevel || map.getZoom() || 15;
        if (shouldFly) {
          map.flyTo([lat, lng], targetZoom, { animate: true, duration: 0.8 });
        } else {
          map.panTo([lat, lng], { animate: true, duration: 0.4 });
        }

        if (markerInstanceRef.current) {
          markerInstanceRef.current.setLatLng([lat, lng]);
        } else {
          const marker = L.marker([lat, lng], {
            draggable: true,
            icon: createCustomIcon(L),
            title: "Drag to refine your position",
          }).addTo(map);

          marker.on("dragend", async () => {
            const pos = marker.getLatLng();
            setIsGeocoding(true);
            const resolved = await reverseGeocode(pos.lat, pos.lng);
            setIsGeocoding(false);
            setCurrentCoords({
              latitude: pos.lat,
              longitude: pos.lng,
              address: resolved || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`,
            });
            if (mapInstanceRef.current) {
              mapInstanceRef.current.panTo([pos.lat, pos.lng], { animate: true, duration: 0.3 });
            }
          });

          markerInstanceRef.current = marker;
        }
      }

      if (explicitAddress) {
        setCurrentCoords({
          latitude: lat,
          longitude: lng,
          address: explicitAddress,
          placeName,
        });
      } else {
        setIsGeocoding(true);
        const resolved = await reverseGeocode(lat, lng);
        setIsGeocoding(false);
        setCurrentCoords({
          latitude: lat,
          longitude: lng,
          address: resolved || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          placeName,
        });
      }
    },
    [createCustomIcon]
  );

  // Initialize Leaflet Map when panel opens
  useEffect(() => {
    if (!isOpen) {
      setSearchText("");
      setError(null);
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    import("leaflet")
      .then(async (leafletModule) => {
        if (isCancelled || !mapContainerRef.current) return;

        const L = leafletModule.default || leafletModule;
        leafletRef.current = L;

        // Destroy previous map instance if any
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const initialLat = location?.latitude ?? 22.7196; // Default: Indore / New Delhi
        const initialLng = location?.longitude ?? 75.8577;
        const initialZoom = location?.latitude ? 15 : 12;

        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: initialZoom,
          zoomControl: false,
        });

        // Add Zoom Control on top right
        L.control.zoom({ position: "topright" }).addTo(map);

        // OpenStreetMap CartoDB Voyager Tile Layer
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20,
          }
        ).addTo(map);

        mapInstanceRef.current = map;

        // Click anywhere on map to move pin
        map.on("click", async (e: any) => {
          const { lat, lng } = e.latlng;
          await updateMapPosition(lat, lng, undefined, undefined, false);
        });

        // Setup initial pin
        if (location?.latitude && location?.longitude) {
          await updateMapPosition(
            location.latitude,
            location.longitude,
            location.address || location.full_address || undefined,
            undefined,
            false,
            15
          );
        } else {
          // If no initial location, attempt to fetch current browser location
          try {
            const browserPos = await getCurrentBrowserLocation({
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            });
            let resolvedAddr = "";
            try {
              resolvedAddr = await reverseGeocode(browserPos.latitude, browserPos.longitude);
            } catch {
              // fallback
            }
            if (!isCancelled) {
              await updateMapPosition(
                browserPos.latitude,
                browserPos.longitude,
                resolvedAddr || undefined,
                undefined,
                true,
                15
              );
            }
          } catch {
            await updateMapPosition(initialLat, initialLng, "Selected Area", undefined, false, 12);
          }
        }

        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 300);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load map side panel:", err);
        setError("Could not load interactive map. Please check your network connection.");
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerInstanceRef.current = null;
    };
  }, [isOpen, location, updateMapPosition]);

  // Handle live place search autocomplete
  useEffect(() => {
    if (!searchText || searchText.trim().length < 2) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaceSuggestions(searchText.trim());
        setSuggestions(results);
        setIsSuggestionsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn("Place search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Select place suggestion
  const handleSelectSuggestion = async (item: PlaceSearchResult) => {
    setIsSuggestionsOpen(false);
    const fullAddr = item.description ? `${item.name}, ${item.description}` : item.name;
    setSearchText(item.name || item.description);
    await updateMapPosition(
      item.latitude,
      item.longitude,
      fullAddr,
      item.name,
      true,
      16
    );
  };

  // Locate Current Browser GPS
  const handleLocateMe = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setError(null);

    try {
      const pos = await getCurrentBrowserLocation({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });

      let resolvedAddr = "";
      try {
        resolvedAddr = await reverseGeocode(pos.latitude, pos.longitude);
      } catch {
        // fallback
      }

      await updateMapPosition(
        pos.latitude,
        pos.longitude,
        resolvedAddr || undefined,
        "My Current Location",
        true,
        16
      );
    } catch (err: any) {
      setError("Location permission denied or unavailable in your browser.");
    } finally {
      setIsLocating(false);
    }
  };

  // Confirm / Save updated location
  const handleConfirmLocation = () => {
    if (!currentCoords) return;
    const payload: GeolocationCoordinates = {
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
      altitude: null,
      address: currentCoords.address,
      full_address: currentCoords.address,
    };

    saveStoredUserLocation(payload);
    onUpdateLocation?.(payload);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#56C5D9]/15 text-[#0e879c]">
            <Compass className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 truncate">
              Interactive Map
            </h3>
            <p className="text-[11.5px] text-zinc-500 truncate">
              View &amp; explore your current pinned location
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 transition cursor-pointer"
          title="Close map"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search Bar & Autocomplete */}
      <div className="relative border-b border-zinc-100 bg-white p-3 z-30 shrink-0">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsSuggestionsOpen(true);
            }}
            placeholder="Search address, city, or area..."
            className="w-full rounded-xl border border-zinc-200/90 bg-zinc-50/60 py-2 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#56C5D9] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#56C5D9]/20 transition shadow-2xs"
          />

          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSuggestions([]);
                setIsSuggestionsOpen(false);
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {isSuggestionsOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-3 right-3 z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.latitude}-${item.longitude}-${idx}`}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-[#eef9fb] hover:text-[#0e879c] cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2ba8be] mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 truncate">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container Area */}
      <div className="relative flex-1 min-h-0 bg-zinc-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/85 backdrop-blur-2xs gap-2 z-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#2ba8be]" />
            <span className="text-xs font-medium text-zinc-600">
              Loading map...
            </span>
          </div>
        )}

        {isGeocoding && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-lg bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-xs shadow-md">
            <Loader2 className="h-3 w-3 animate-spin text-[#56C5D9]" />
            <span>Resolving address...</span>
          </div>
        )}

        {/* Floating Quick GPS Locate Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute top-3 right-12 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-zinc-200/90 text-zinc-700 shadow-md hover:bg-zinc-50 hover:text-[#0e879c] transition active:scale-95 disabled:opacity-60 cursor-pointer"
          title="Recenter to my browser location"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#2ba8be]" />
          ) : (
            <LocateFixed className="h-4 w-4 text-[#2ba8be]" />
          )}
        </button>

        {/* Bottom map tip */}
        <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-medium text-zinc-600 backdrop-blur-xs border border-zinc-200/80 shadow-2xs">
          <MapPin className="h-3 w-3 text-[#2ba8be]" />
          <span>Click anywhere or drag pin to move</span>
        </div>
      </div>

      {/* Selected Location Card & Actions */}
      {currentCoords && (
        <div className="border-t border-zinc-200/90 bg-white p-4 shrink-0 flex flex-col gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#56C5D9]/20 text-[#0e879c] mt-0.5">
              <Navigation className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-900 truncate">
                {currentCoords.placeName || "Pinned Location"}
              </p>
              <p className="text-[11.5px] text-zinc-600 line-clamp-2 leading-relaxed mt-0.5">
                {currentCoords.address}
              </p>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {onUpdateLocation && (
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition active:scale-[0.98] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 text-[#56C5D9]" />
                <span>Update Location</span>
              </button>
            )}

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${currentCoords.latitude},${currentCoords.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              title="Open in Google Maps"
            >
              <span>Google Maps</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
