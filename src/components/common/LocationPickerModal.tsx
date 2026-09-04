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
  HelpCircle,
} from "lucide-react";
import {
  reverseGeocode,
  getCurrentBrowserLocation,
  getGeolocationPermissionStatus,
  searchPlaceSuggestions,
  PlaceSearchResult,
  GeolocationCoordinates,
} from "@/lib/maps";
import LocationPermissionGuideModal from "./LocationPermissionGuideModal";

export interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (coords: GeolocationCoordinates) => void;
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
}: LocationPickerModalProps) {
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
  const [isPermissionGuideOpen, setIsPermissionGuideOpen] = useState(false);

  // Selected Pin Coordinates & Formatted Address
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
    address: string;
    placeName?: string;
  } | null>(null);

  // Custom marker icon with pulsing effect
  const createCustomIcon = useCallback((L: any) => {
    return L.divIcon({
      className: "custom-map-marker-container",
      html: `
        <div style="position: relative; width: 38px; height: 38px; transform: translate(-50%, -100%); cursor: grab;">
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 16px; height: 6px; background: rgba(0,0,0,0.25); border-radius: 50%; filter: blur(2px);"></div>
          <div style="width: 38px; height: 38px; background: #0e879c; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(14,135,156,0.45); transition: transform 0.15s ease;">
            <div style="width: 12px; height: 12px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    });
  }, []);

  // Update pin position, map view, and reverse geocode
  const updateLocation = useCallback(
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
            setSelectedCoords({
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
        setSelectedCoords({
          latitude: lat,
          longitude: lng,
          address: explicitAddress,
          placeName,
        });
      } else {
        setIsGeocoding(true);
        const resolved = await reverseGeocode(lat, lng);
        setIsGeocoding(false);
        setSelectedCoords({
          latitude: lat,
          longitude: lng,
          address: resolved || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          placeName,
        });
      }
    },
    [createCustomIcon]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isOpen) {
      setSearchText("");
      setError(null);
      setSelectedCoords(null);
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

        // Destroy previous map instance
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const defaultCenter: [number, number] = [28.6139, 77.209]; // Default: New Delhi

        // Initialize Map
        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          zoomControl: false,
          attributionControl: false,
        });

        // Add Zoom Control at bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Add crisp CartoDB Voyager tiles
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
          }
        ).addTo(map);

        mapInstanceRef.current = map;

        // Click anywhere on map to drop & move pin
        map.on("click", async (e: any) => {
          setIsSuggestionsOpen(false);
          const { lat, lng } = e.latlng;
          await updateLocation(lat, lng, undefined, undefined, false);
        });

        // Ensure map renders all tiles correctly after modal animation
        const invalidate = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        };

        setTimeout(invalidate, 100);
        setTimeout(invalidate, 300);
        setTimeout(invalidate, 600);

        // Try getting initial user coordinates if already granted
        getGeolocationPermissionStatus()
          .then(async (perm) => {
            if (perm === "granted") {
              try {
                const loc = await getCurrentBrowserLocation({
                  enableHighAccuracy: false,
                  timeout: 3500,
                });
                if (!isCancelled) {
                  await updateLocation(loc.latitude, loc.longitude, undefined, undefined, false, 15);
                  return;
                }
              } catch {
                // fall through
              }
            }

            if (!isCancelled) {
              await updateLocation(defaultCenter[0], defaultCenter[1], undefined, undefined, false, 13);
            }
          })
          .catch(() => {
            if (!isCancelled) {
              updateLocation(defaultCenter[0], defaultCenter[1], undefined, undefined, false, 13);
            }
          })
          .finally(() => {
            if (!isCancelled) {
              setLoading(false);
              setTimeout(invalidate, 100);
            }
          });
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to load map module:", err);
          setError("Failed to load map. Please check your network connection.");
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerInstanceRef.current = null;
      leafletRef.current = null;
    };
  }, [isOpen, updateLocation]);

  // Debounced search suggestions as user types
  useEffect(() => {
    const q = searchText.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaceSuggestions(q);
        setSuggestions(results);
        setIsSuggestionsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Select a suggestion and fly map directly to location
  const handleSelectSuggestion = (place: PlaceSearchResult) => {
    setSearchText(place.name);
    setIsSuggestionsOpen(false);
    setSuggestions([]);
    updateLocation(place.latitude, place.longitude, place.description, place.name, true, 16);
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionsOpen || suggestions.length === 0) {
      if (e.key === "Enter" && searchText.trim().length >= 2) {
        // Immediate search on Enter
        e.preventDefault();
        searchPlaceSuggestions(searchText.trim()).then((res) => {
          if (res.length > 0) {
            handleSelectSuggestion(res[0]);
          }
        });
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = selectedIndex >= 0 ? suggestions[selectedIndex] : suggestions[0];
      if (target) {
        handleSelectSuggestion(target);
      }
    } else if (e.key === "Escape") {
      setIsSuggestionsOpen(false);
    }
  };

  // Handle Quick "Locate Me" Button
  const handleLocateMe = async () => {
    setIsLocating(true);
    setError(null);
    try {
      const perm = await getGeolocationPermissionStatus();
      if (perm === "denied") {
        setIsLocating(false);
        const deniedMsg =
          "Location permission is blocked in your browser. Click 'How to allow in browser' below to enable it.";
        setError(deniedMsg);
        setIsPermissionGuideOpen(true);
        return;
      }

      const loc = await getCurrentBrowserLocation({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 30000,
      });
      await updateLocation(loc.latitude, loc.longitude, undefined, undefined, true, 16);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not retrieve your current location. Please check browser permissions.";
      setError(msg);

      const isPermIssue =
        msg.toLowerCase().includes("denied") ||
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("allow");

      if (isPermIssue) {
        setIsPermissionGuideOpen(true);
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Confirm and Submit Location
  const handleConfirmLocation = () => {
    if (!selectedCoords) {
      setError("Please search or drop a pin on the map first.");
      return;
    }

    onSelectLocation({
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      altitude: null,
      address: selectedCoords.address,
      full_address: selectedCoords.address,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/70">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#56C5D9]/15 text-[#2ba8be]">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Drop Your Location
                </h3>
                <p className="text-[12px] text-zinc-500">
                  Search address, city, or click &amp; drag pin on the map
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 flex flex-col gap-3 min-h-0 overflow-visible">
            {error && (
              <div className="flex flex-col gap-2 rounded-xl bg-red-50 border border-red-200/80 p-3 text-xs text-red-700 shrink-0">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <div className="leading-relaxed flex-1">{error}</div>
                </div>
                <div className="flex items-center gap-2 pl-6 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsPermissionGuideOpen(true)}
                    className="inline-flex items-center gap-1 font-semibold text-[#0e879c] hover:underline cursor-pointer"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    How to allow location in browser
                  </button>
                </div>
              </div>
            )}

            {/* Search Row with Live Suggestions Dropdown & Locate Button */}
            <div className="relative z-30 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400">
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
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) setIsSuggestionsOpen(true);
                  }}
                  placeholder="Search city, area, or landmark (e.g. Indore, Times Square)..."
                  className="w-full rounded-xl border border-zinc-200/90 bg-white py-2.5 pl-10 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#56C5D9] focus:outline-hidden focus:ring-2 focus:ring-[#56C5D9]/20 transition shadow-2xs"
                />

                {searchText && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText("");
                      setSuggestions([]);
                      setIsSuggestionsOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Suggestions Dropdown (Floating over Map) */}
                {isSuggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                    {suggestions.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className={`w-full flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition cursor-pointer group ${
                          selectedIndex === idx
                            ? "bg-[#eef9fb] text-zinc-950"
                            : "hover:bg-[#eef9fb]/70 text-zinc-800"
                        }`}
                      >
                        <MapPin
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            selectedIndex === idx
                              ? "text-[#2ba8be]"
                              : "text-zinc-400 group-hover:text-[#2ba8be]"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 truncate leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* GPS Locate button */}
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={loading || isLocating}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Center on my device GPS location"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2ba8be]" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5 text-[#2ba8be]" />
                )}
                <span className="hidden sm:inline">My GPS</span>
              </button>
            </div>

            {/* Interactive Map Container */}
            <div className="relative z-10 w-full h-64 sm:h-72 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-100 shrink-0 shadow-inner">
              <div ref={mapContainerRef} className="w-full h-full" />

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50/85 backdrop-blur-2xs gap-2 z-20">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2ba8be]" />
                  <span className="text-xs font-medium text-zinc-600">
                    Loading interactive map...
                  </span>
                </div>
              )}

              {isGeocoding && (
                <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 rounded-lg bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-xs shadow-md animate-in fade-in duration-100">
                  <Loader2 className="h-3 w-3 animate-spin text-[#56C5D9]" />
                  <span>Resolving address...</span>
                </div>
              )}

              {/* Helper tip overlay on bottom left */}
              {!loading && (
                <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none hidden sm:flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-[10.5px] font-medium text-zinc-600 backdrop-blur-xs border border-zinc-200/80 shadow-2xs">
                  <MapPin className="h-3 w-3 text-[#2ba8be]" />
                  <span>Click anywhere or drag pin to position</span>
                </div>
              )}
            </div>

            {/* Selected Location Card & Confirm Action */}
            {selectedCoords && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#56C5D9]/40 bg-[#eef9fb]/70 p-3.5 shrink-0 shadow-2xs">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#56C5D9]/20 text-[#0e879c] mt-0.5">
                    <Navigation className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-900 truncate">
                      {selectedCoords.placeName || "Selected Location"}
                    </p>
                    <p className="text-[11.5px] text-zinc-600 line-clamp-2 leading-relaxed mt-0.5">
                      {selectedCoords.address}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition active:scale-[0.98] cursor-pointer shrink-0"
                >
                  <Check className="h-3.5 w-3.5 text-[#56C5D9]" />
                  <span>Confirm Location</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <LocationPermissionGuideModal
        isOpen={isPermissionGuideOpen}
        onClose={() => setIsPermissionGuideOpen(false)}
        errorMessage={error}
        onOpenMapPicker={() => setIsPermissionGuideOpen(false)}
        onSelectLocation={(coords) => {
          setIsPermissionGuideOpen(false);
          updateLocation(coords.latitude, coords.longitude, coords.address || undefined, undefined, true, 16);
        }}
      />
    </>
  );
}
