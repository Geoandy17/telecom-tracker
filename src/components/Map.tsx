'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Maximize2, Minimize2, Navigation, Calendar, X } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'leaflet/dist/leaflet.css';

// Enregistrer la locale française pour le date picker
registerLocale('fr', fr);

// Fix pour les icônes Leaflet avec Next.js
const createIcon = (color: string, isStart?: boolean, isEnd?: boolean) => {
  let svgContent: string;

  if (isStart) {
    // Icône de départ (cercle vert avec flèche)
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r="18" fill="#10B981" stroke="#fff" stroke-width="3"/>
        <text x="20" y="26" text-anchor="middle" fill="#fff" font-size="16" font-weight="bold">1</text>
      </svg>
    `;
  } else if (isEnd) {
    // Icône de fin (cercle rouge avec icône de lieu/pin)
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
        <circle cx="20" cy="20" r="18" fill="#EF4444" stroke="#fff" stroke-width="3"/>
        <path d="M 20 11 C 17.24 11 15 13.24 15 16 C 15 19.5 20 27 20 27 S 25 19.5 25 16 C 25 13.24 22.76 11 20 11 Z M 20 18 C 18.9 18 18 17.1 18 16 C 18 14.9 18.9 14 20 14 C 21.1 14 22 14.9 22 16 C 22 17.1 21.1 18 20 18 Z"
              fill="#fff" stroke="none"/>
      </svg>
    `;
  } else {
    // Icône standard (point)
    svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10" fill="${color}" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="#fff"/>
      </svg>
    `;
  }

  return L.divIcon({
    html: svgContent,
    className: 'custom-marker',
    iconSize: isStart || isEnd ? [40, 40] : [24, 24],
    iconAnchor: isStart || isEnd ? [20, 20] : [12, 12],
    popupAnchor: [0, -12],
  });
};

// Créer une icône numérotée pour les points intermédiaires
const createNumberedIcon = (number: number, color: string) => {
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">${number}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgContent,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

interface Position {
  lat: number;
  lng: number;
  timestamp: string;
  siteName: string;
  cellId?: string;
  index: number;
}

interface MapComponentProps {
  positions: Position[];
  phoneNumber: string;
  identity?: string;
  dateRange?: { start: Date | null; end: Date | null };
  onDateRangeChange?: (range: { start: Date | null; end: Date | null }) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  availableDateRange?: { min: string; max: string; minFull: string; maxFull: string };
}

// Composant pour ajuster la vue de la carte et gérer la navigation
function MapController({ positions, targetPosition, onNavigationComplete, isFullscreen }: {
  positions: Position[];
  targetPosition?: { lat: number; lng: number } | null;
  onNavigationComplete?: () => void;
  isFullscreen?: boolean;
}) {
  const map = useMap();

  // Rafraîchir la carte quand le mode plein écran change
  useEffect(() => {
    // Petit délai pour laisser le DOM se mettre à jour
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  useEffect(() => {
    if (positions.length > 0 && !targetPosition) {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions, map, targetPosition]);

  // Naviguer vers un point spécifique
  useEffect(() => {
    if (targetPosition) {
      map.flyTo([targetPosition.lat, targetPosition.lng], 16, {
        duration: 1.5,
      });
      if (onNavigationComplete) {
        setTimeout(onNavigationComplete, 1600);
      }
    }
  }, [targetPosition, map, onNavigationComplete]);

  return null;
}

// Fonction pour interpoler une couleur entre vert -> jaune -> rouge
function getGradientColor(ratio: number): string {
  // Vert: rgb(16, 185, 129) -> Jaune: rgb(234, 179, 8) -> Rouge: rgb(239, 68, 68)
  let r: number, g: number, b: number;

  if (ratio < 0.5) {
    // Première moitié : Vert -> Jaune
    const localRatio = ratio * 2; // 0 à 1
    r = Math.round(16 + localRatio * (234 - 16));
    g = Math.round(185 + localRatio * (179 - 185));
    b = Math.round(129 + localRatio * (8 - 129));
  } else {
    // Deuxième moitié : Jaune -> Rouge
    const localRatio = (ratio - 0.5) * 2; // 0 à 1
    r = Math.round(234 + localRatio * (239 - 234));
    g = Math.round(179 + localRatio * (68 - 179));
    b = Math.round(8 + localRatio * (68 - 8));
  }

  return `rgb(${r}, ${g}, ${b})`;
}

export default function MapComponent({
  positions,
  phoneNumber,
  identity,
  dateRange,
  onDateRangeChange,
  isFullscreen = false,
  onToggleFullscreen,
  availableDateRange,
}: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [targetPosition, setTargetPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [localStartDate, setLocalStartDate] = useState<Date | null>(null);
  const [localEndDate, setLocalEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');

  // Calculer les dates min et max disponibles
  const availableDates = useMemo(() => {
    if (availableDateRange) {
      return {
        min: new Date(availableDateRange.min),
        max: new Date(availableDateRange.max),
        minFull: availableDateRange.minFull,
        maxFull: availableDateRange.maxFull,
      };
    }
    if (positions.length === 0) return null;
    const dates = positions.map(p => new Date(p.timestamp).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return {
      min: minDate,
      max: maxDate,
      minFull: format(minDate, "dd MMM yyyy", { locale: fr }),
      maxFull: format(maxDate, "dd MMM yyyy", { locale: fr }),
    };
  }, [positions, availableDateRange]);

  // Naviguer vers le point de départ
  const navigateToStart = useCallback(() => {
    if (positions.length > 0) {
      setTargetPosition({ lat: positions[0].lat, lng: positions[0].lng });
    }
  }, [positions]);

  // Naviguer vers le point d'arrivée
  const navigateToEnd = useCallback(() => {
    if (positions.length > 0) {
      const lastPos = positions[positions.length - 1];
      setTargetPosition({ lat: lastPos.lat, lng: lastPos.lng });
    }
  }, [positions]);

  // Réinitialiser la navigation
  const handleNavigationComplete = useCallback(() => {
    setTargetPosition(null);
  }, []);

  // Vérifier si la plage de dates est valide
  const isDateRangeValid = useMemo(() => {
    if (!localStartDate || !localEndDate) return true; // Valide si une des dates est vide

    // Créer les dates avec les heures
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startDateTime = new Date(localStartDate);
    startDateTime.setHours(startH, startM, 0, 0);

    const endDateTime = new Date(localEndDate);
    endDateTime.setHours(endH, endM, 59, 999);

    return endDateTime >= startDateTime;
  }, [localStartDate, localEndDate, startTime, endTime]);

  // Appliquer le filtre de dates
  const applyDateFilter = useCallback(() => {
    if (!isDateRangeValid) return;

    if (onDateRangeChange) {
      let startDateTime = localStartDate;
      let endDateTime = localEndDate;

      // Combiner date et heure de début
      if (startDateTime && startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        startDateTime = new Date(startDateTime);
        startDateTime.setHours(hours, minutes, 0, 0);
      }

      // Combiner date et heure de fin
      if (endDateTime && endTime) {
        const [hours, minutes] = endTime.split(':').map(Number);
        endDateTime = new Date(endDateTime);
        endDateTime.setHours(hours, minutes, 59, 999);
      }

      onDateRangeChange({
        start: startDateTime,
        end: endDateTime,
      });
    }
    setShowDateFilter(false);
  }, [localStartDate, localEndDate, startTime, endTime, onDateRangeChange, isDateRangeValid]);

  // Réinitialiser le filtre
  const resetDateFilter = useCallback(() => {
    setLocalStartDate(null);
    setLocalEndDate(null);
    setStartTime('00:00');
    setEndTime('23:59');
    if (onDateRangeChange) {
      onDateRangeChange({ start: null, end: null });
    }
    setShowDateFilter(false);
  }, [onDateRangeChange]);

  // Gérer la touche Échap pour quitter le mode plein écran
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && onToggleFullscreen) {
        onToggleFullscreen();
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen, onToggleFullscreen]);

  // Calculer les couleurs pour chaque segment du trajet avec gradient fluide
  const segmentData = useMemo(() => {
    if (positions.length < 2) return [];

    const segments: Array<{
      positions: [number, number][];
      color: string;
      fromIndex: number;
      toIndex: number;
    }> = [];

    // Nombre de sous-segments pour créer un gradient fluide (réduit pour meilleures performances)
    const subSegments = 5;

    for (let i = 0; i < positions.length - 1; i++) {
      const startPos = positions[i];
      const endPos = positions[i + 1];

      // Ratio de début et fin pour ce segment complet
      const startRatio = i / (positions.length - 1);
      const endRatio = (i + 1) / (positions.length - 1);

      // Créer plusieurs sous-segments pour un gradient fluide
      for (let j = 0; j < subSegments; j++) {
        const subStart = j / subSegments;
        const subEnd = (j + 1) / subSegments;

        // Interpolation de position
        const lat1 = startPos.lat + (endPos.lat - startPos.lat) * subStart;
        const lng1 = startPos.lng + (endPos.lng - startPos.lng) * subStart;
        const lat2 = startPos.lat + (endPos.lat - startPos.lat) * subEnd;
        const lng2 = startPos.lng + (endPos.lng - startPos.lng) * subEnd;

        // Couleur basée sur le ratio global du trajet
        const ratio = startRatio + (endRatio - startRatio) * ((subStart + subEnd) / 2);
        const color = getGradientColor(ratio);

        segments.push({
          positions: [[lat1, lng1], [lat2, lng2]],
          color,
          fromIndex: i,
          toIndex: i + 1,
        });
      }
    }

    return segments;
  }, [positions]);

  // Couleurs pour chaque point
  const pointColors = useMemo(() => {
    return positions.map((_, index) => {
      if (positions.length <= 1) return getGradientColor(0);
      const ratio = index / (positions.length - 1);
      return getGradientColor(ratio);
    });
  }, [positions]);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy 'à' HH:mm:ss", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  // Position par défaut : Cameroun
  const defaultCenter: [number, number] = [5.9631, 10.1591];
  const defaultZoom = 6;

  if (positions.length === 0) {
    const hasDateFilter = dateRange?.start || dateRange?.end;
    return (
      <div className={`${isFullscreen ? 'fixed inset-0 z-[9999]' : 'h-full'} flex items-center justify-center bg-gray-100 rounded-2xl`}>
        {/* Bouton plein écran même sans positions */}
        {onToggleFullscreen && isFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg hover:bg-gray-100 transition-colors"
            title="Réduire"
          >
            <Minimize2 className="w-5 h-5 text-gray-700" />
          </button>
        )}
        <div className="text-center text-gray-500">
          {hasDateFilter ? (
            <>
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium">Aucune position pour cette période</p>
              <p className="text-sm mt-1">Modifiez les dates ou réinitialisez le filtre</p>
              <button
                onClick={resetDateFilter}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Réinitialiser le filtre
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">Aucune position disponible</p>
              <p className="text-sm mt-1">Sélectionnez un numéro avec des localisations</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[9999] bg-white' : 'h-full relative rounded-2xl shadow-lg'} overflow-hidden`}>
      {/* Panneau de filtre par date avec react-datepicker */}
      {showDateFilter && (
        <div className="absolute top-4 left-4 z-[1001] bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-gray-800">Filtrer par période</div>
            <button
              onClick={() => setShowDateFilter(false)}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          {availableDates && (
            <div className="text-[10px] text-gray-500 mb-2 bg-gray-50 rounded p-1.5">
              Données: {availableDates.minFull} au {availableDates.maxFull}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Début</label>
              <div className="flex gap-2">
                <DatePicker
                  selected={localStartDate}
                  onChange={(date: Date | null) => setLocalStartDate(date)}
                  selectsStart
                  startDate={localStartDate}
                  endDate={localEndDate}
                  minDate={availableDates?.min}
                  maxDate={availableDates?.max}
                  locale="fr"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Date"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  calendarClassName="shadow-lg border-0 rounded-lg"
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  yearDropdownItemNumber={15}
                  popperPlacement="bottom-start"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                  className="w-[85px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Fin</label>
              <div className="flex gap-2">
                <DatePicker
                  selected={localEndDate}
                  onChange={(date: Date | null) => setLocalEndDate(date)}
                  selectsEnd
                  startDate={localStartDate}
                  endDate={localEndDate}
                  minDate={localStartDate || availableDates?.min}
                  maxDate={availableDates?.max}
                  locale="fr"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Date"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  calendarClassName="shadow-lg border-0 rounded-lg"
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  yearDropdownItemNumber={15}
                  popperPlacement="bottom-start"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                  className="w-[85px]"
                />
              </div>
            </div>
            {/* Message d'erreur si plage invalide */}
            {!isDateRangeValid && (
              <div className="text-[10px] text-red-500 bg-red-50 rounded p-1.5">
                La date/heure de fin doit être après la date/heure de début
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={applyDateFilter}
                disabled={(!localStartDate && !localEndDate) || !isDateRangeValid}
                className="flex-1 px-2 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Appliquer
              </button>
              <button
                onClick={resetDateFilter}
                className="px-2 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Légende avec navigation */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 min-w-[180px]">
        <div className="text-sm font-bold text-gray-800 mb-1">{phoneNumber}</div>
        {identity && (
          <div className="text-xs text-gray-600 mb-2">{identity}</div>
        )}
        <div className="text-xs text-gray-500 space-y-2">
          <button
            onClick={navigateToStart}
            className="flex items-center gap-2 w-full hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors group"
            title="Cliquez pour aller au point de départ"
          >
            <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold">1</div>
            <span className="group-hover:text-green-600">Départ</span>
            <Navigation className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-green-600 transition-opacity" />
          </button>
          <button
            onClick={navigateToEnd}
            className="flex items-center gap-2 w-full hover:bg-gray-100 rounded-lg p-1 -m-1 transition-colors group"
            title="Cliquez pour aller au point d'arrivée"
          >
            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-white">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span className="group-hover:text-red-600">Arrivée</span>
            <Navigation className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 text-red-600 transition-opacity" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-1.5 rounded" style={{background: 'linear-gradient(to right, #10B981, #EAB308, #EF4444)'}}></div>
            <span>Trajet</span>
          </div>
        </div>
        {/* Ligne avec positions et boutons */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-400">
            {positions.length} position{positions.length > 1 ? 's' : ''}
            {(dateRange?.start || dateRange?.end) && (
              <span className="text-blue-600 ml-1">•</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {onDateRangeChange && (
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                  (dateRange?.start || dateRange?.end) ? 'text-blue-600' : 'text-gray-400'
                }`}
                title="Filtrer par période"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
                title={isFullscreen ? 'Réduire (Échap)' : 'Plein écran'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats du trajet */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <div className="text-xs text-gray-600 space-y-2">
          <div>
            <span className="font-semibold text-green-600">Première position:</span>
            <div className="text-gray-800 font-medium">{positions[0] && formatDate(positions[0].timestamp)}</div>
            <div className="text-gray-500 text-[10px]">{positions[0]?.siteName}</div>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <span className="font-semibold text-red-600">Dernière position:</span>
            <div className="text-gray-800 font-medium">{positions[positions.length - 1] && formatDate(positions[positions.length - 1].timestamp)}</div>
            <div className="text-gray-500 text-[10px]">{positions[positions.length - 1]?.siteName}</div>
          </div>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        ref={mapRef}
        zoomControl={false}
      >
        {/* Contrôle de zoom repositionné en bas à droite */}
        <ZoomControl position="bottomright" />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapController
          positions={positions}
          targetPosition={targetPosition}
          onNavigationComplete={handleNavigationComplete}
          isFullscreen={isFullscreen}
        />

        {/* Tracé du trajet avec segments colorés - gradient vert -> jaune -> rouge */}
        {segmentData.map((segment, index) => (
          <Polyline
            key={`segment-${index}`}
            positions={segment.positions}
            color={segment.color}
            weight={6}
            opacity={1}
          />
        ))}

        {/* Points intermédiaires numérotés (pas le premier ni le dernier) */}
        {positions.slice(1, -1).map((pos, index) => (
          <Marker
            key={`intermediate-${index}`}
            position={[pos.lat, pos.lng]}
            icon={createNumberedIcon(index + 2, pointColors[index + 1])}
            eventHandlers={{
              click: (e) => {
                const map = e.target._map;
                map.flyTo([pos.lat, pos.lng], 17, { duration: 1 });
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} className="custom-tooltip">
              <div className="text-xs">
                <div className="font-semibold">Position {index + 2}</div>
                <div className="text-gray-600">{formatDate(pos.timestamp)}</div>
                <div className="text-gray-500 truncate max-w-[200px]">{pos.siteName}</div>
              </div>
            </Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-bold text-gray-800 text-base">Position {index + 2}</div>
                <div className="text-gray-600 mt-2">{pos.siteName}</div>
                <div className="text-gray-500 text-xs mt-2 bg-gray-100 p-2 rounded">
                  <div className="font-medium">{formatDate(pos.timestamp)}</div>
                </div>
                <div className="text-gray-400 text-xs mt-2">
                  Coordonnées: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Marqueur de départ (Position 1) */}
        {positions.length > 0 && (
          <Marker
            position={[positions[0].lat, positions[0].lng]}
            icon={createIcon('#10B981', true, false)}
            zIndexOffset={1000}
            eventHandlers={{
              click: (e) => {
                const map = e.target._map;
                map.flyTo([positions[0].lat, positions[0].lng], 17, { duration: 1 });
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -15]} className="custom-tooltip">
              <div className="text-xs">
                <div className="font-semibold text-green-600">DÉPART</div>
                <div className="text-gray-600">{formatDate(positions[0].timestamp)}</div>
                <div className="text-gray-500 truncate max-w-[200px]">{positions[0].siteName}</div>
              </div>
            </Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-bold text-green-600 text-lg">DÉPART - Position 1</div>
                <div className="text-gray-600 mt-2">{positions[0].siteName}</div>
                <div className="text-gray-500 text-xs mt-2 bg-green-50 p-2 rounded">
                  <div className="font-medium">{formatDate(positions[0].timestamp)}</div>
                </div>
                <div className="text-gray-400 text-xs mt-2">
                  Coordonnées: {positions[0].lat.toFixed(6)}, {positions[0].lng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueur d'arrivée (Dernière position) */}
        {positions.length > 1 && (
          <Marker
            position={[positions[positions.length - 1].lat, positions[positions.length - 1].lng]}
            icon={createIcon('#EF4444', false, true)}
            zIndexOffset={1000}
            eventHandlers={{
              click: (e) => {
                const map = e.target._map;
                const lastPos = positions[positions.length - 1];
                map.flyTo([lastPos.lat, lastPos.lng], 17, { duration: 1 });
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -15]} className="custom-tooltip">
              <div className="text-xs">
                <div className="font-semibold text-red-600">ARRIVÉE</div>
                <div className="text-gray-600">{formatDate(positions[positions.length - 1].timestamp)}</div>
                <div className="text-gray-500 truncate max-w-[200px]">{positions[positions.length - 1].siteName}</div>
              </div>
            </Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-bold text-red-600 text-lg">ARRIVÉE - Position {positions.length}</div>
                <div className="text-gray-600 mt-2">
                  {positions[positions.length - 1].siteName}
                </div>
                <div className="text-gray-500 text-xs mt-2 bg-red-50 p-2 rounded">
                  <div className="font-medium">{formatDate(positions[positions.length - 1].timestamp)}</div>
                </div>
                <div className="text-gray-400 text-xs mt-2">
                  Coordonnées: {positions[positions.length - 1].lat.toFixed(6)}, {positions[positions.length - 1].lng.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
