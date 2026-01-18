'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'leaflet/dist/leaflet.css';

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
}

// Composant pour ajuster la vue de la carte
function MapController({ positions }: { positions: Position[] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions, map]);

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

export default function MapComponent({ positions, phoneNumber, identity }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null);

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
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-2xl">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Aucune position disponible</p>
          <p className="text-sm mt-1">Sélectionnez un numéro avec des localisations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative rounded-2xl overflow-hidden shadow-lg">
      {/* Légende */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg min-w-[180px]">
        <div className="text-sm font-bold text-gray-800 mb-1">
          {phoneNumber}
        </div>
        {identity && (
          <div className="text-xs text-gray-600 mb-3">{identity}</div>
        )}
        <div className="text-xs text-gray-500 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold">1</div>
            <span>Départ</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span>Arrivée</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-12 h-2 rounded" style={{background: 'linear-gradient(to right, #10B981, #EAB308, #EF4444)'}}></div>
            <span>Trajet</span>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-200">
          {positions.length} position{positions.length > 1 ? 's' : ''}
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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapController positions={positions} />

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
          >
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
          >
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
          >
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
