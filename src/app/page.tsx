'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import FileUpload from '@/components/FileUpload';
import PhoneList from '@/components/PhoneList';
import Timeline from '@/components/Timeline';
import { Upload, Map as MapIcon, Phone, Activity, Shield, ChevronLeft } from 'lucide-react';

// Import dynamique de la carte pour éviter les erreurs SSR
const MapComponent = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100 rounded-2xl">
      <div className="text-gray-500">Chargement de la carte...</div>
    </div>
  ),
});

interface PhoneData {
  number: string;
  identity?: string;
  operator?: string;
  callCount: number;
  smsCount: number;
  firstActivity: string | null;
  lastActivity: string | null;
  locations: Array<{
    siteName: string;
    cellId: string;
    latitude: number;
    longitude: number;
  }>;
  records: Array<{
    id: string;
    callerNumber: string;
    calledNumber: string;
    dateTime: string;
    duration: string;
    location: {
      siteName: string;
      latitude: number;
      longitude: number;
    } | null;
    rawLocation: string;
  }>;
}

interface UploadResult {
  fileName: string;
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

export default function Home() {
  const [uploadedData, setUploadedData] = useState<PhoneData[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(true);
  const [activeTab, setActiveTab] = useState<'map' | 'timeline'>('map');

  const handleUploadComplete = useCallback((results: UploadResult[]) => {
    // Fusionner toutes les données de tous les fichiers
    const allPhoneNumbers: PhoneData[] = [];

    for (const result of results) {
      if (result.success && result.data?.phoneNumbers) {
        for (const phone of result.data.phoneNumbers) {
          // Vérifier si ce numéro existe déjà
          const existing = allPhoneNumbers.find(p => p.number === phone.number);
          if (existing) {
            // Fusionner les données
            existing.callCount += phone.callCount;
            existing.smsCount += phone.smsCount;
            existing.records = [...existing.records, ...phone.records].sort(
              (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
            );
            // Ajouter les nouvelles localisations
            for (const loc of phone.locations) {
              const locExists = existing.locations.some(
                l => l.latitude === loc.latitude && l.longitude === loc.longitude
              );
              if (!locExists) {
                existing.locations.push(loc);
              }
            }
          } else {
            allPhoneNumbers.push(phone);
          }
        }
      }
    }

    if (allPhoneNumbers.length > 0) {
      setUploadedData(allPhoneNumbers);
      setShowUpload(false);
    }
  }, []);

  const selectedPhoneData = useMemo(() => {
    if (!selectedNumber) return null;
    return uploadedData.find(p => p.number === selectedNumber) || null;
  }, [selectedNumber, uploadedData]);

  const mapPositions = useMemo(() => {
    if (!selectedPhoneData) return [];

    // Créer les positions à partir des enregistrements (triés par date)
    const positions = selectedPhoneData.records
      .filter(r => r.location)
      .map((r, index) => ({
        lat: r.location!.latitude,
        lng: r.location!.longitude,
        timestamp: r.dateTime,
        siteName: r.location!.siteName,
        index,
      }));

    return positions;
  }, [selectedPhoneData]);

  const stats = useMemo(() => {
    return {
      totalNumbers: uploadedData.length,
      numbersWithLocation: uploadedData.filter(p => p.locations.length > 0).length,
      totalRecords: uploadedData.reduce((sum, p) => sum + p.records.length, 0),
      totalLocations: uploadedData.reduce((sum, p) => sum + p.locations.length, 0),
    };
  }, [uploadedData]);

  // Vue upload
  if (showUpload) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {/* Header */}
        <header className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">TelecomTracker</h1>
                <p className="text-sm text-blue-300">Analyse des Données Télécom</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Analyse de Localisation Téléphonique
            </h2>
            <p className="text-lg text-blue-200 max-w-2xl mx-auto">
              Importez vos fichiers de réquisition télécom pour visualiser les trajectoires
              et analyser les communications sur une carte interactive.
            </p>
          </div>

          {/* Upload zone */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
              <FileUpload
                onUploadComplete={handleUploadComplete}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="p-3 bg-green-500/20 rounded-xl w-fit mb-4">
                <Upload className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Import Multi-fichiers</h3>
              <p className="text-sm text-gray-400">
                Importez plusieurs fichiers Excel simultanément. Support des formats MTN, Orange et Nexttel.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="p-3 bg-blue-500/20 rounded-xl w-fit mb-4">
                <MapIcon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Cartographie Interactive</h3>
              <p className="text-sm text-gray-400">
                Visualisez les déplacements sur une carte avec le tracé du parcours chronologique.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="p-3 bg-purple-500/20 rounded-xl w-fit mb-4">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Timeline Détaillée</h3>
              <p className="text-sm text-gray-400">
                Consultez l&apos;historique complet des appels et SMS avec leurs localisations.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 mt-auto">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <p className="text-center text-sm text-gray-500">
              Application d&apos;analyse des données télécom - Usage autorisé uniquement
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Vue principale avec données
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Retour</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">TelecomTracker</h1>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.totalNumbers}</div>
                <div className="text-xs text-gray-500">Numéros</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.numbersWithLocation}</div>
                <div className="text-xs text-gray-500">Avec position</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalRecords}</div>
                <div className="text-xs text-gray-500">Enregistrements</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Liste des numéros */}
        <aside className="w-96 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <PhoneList
            phoneNumbers={uploadedData.filter(p => p.locations.length > 0)}
            selectedNumber={selectedNumber}
            onSelectNumber={setSelectedNumber}
          />
        </aside>

        {/* Zone principale */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedPhoneData ? (
            <>
              {/* Info du numéro sélectionné */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 font-mono">
                        {selectedPhoneData.number}
                      </h2>
                      {selectedPhoneData.identity && (
                        <p className="text-sm text-gray-600">{selectedPhoneData.identity}</p>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setActiveTab('map')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'map'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <MapIcon className="w-4 h-4" />
                      Carte
                    </button>
                    <button
                      onClick={() => setActiveTab('timeline')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'timeline'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      Timeline
                    </button>
                  </div>
                </div>

                {/* Stats du numéro */}
                <div className="flex items-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">{selectedPhoneData.callCount} appels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-gray-600">{selectedPhoneData.smsCount} SMS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">{selectedPhoneData.locations.length} positions</span>
                  </div>
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 p-4 overflow-hidden">
                {activeTab === 'map' ? (
                  <MapComponent
                    positions={mapPositions}
                    phoneNumber={selectedPhoneData.number}
                    identity={selectedPhoneData.identity}
                  />
                ) : (
                  <div className="h-full bg-white rounded-2xl shadow-lg overflow-hidden">
                    <Timeline
                      records={selectedPhoneData.records}
                      phoneNumber={selectedPhoneData.number}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* État vide */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="p-6 bg-gray-100 rounded-full w-fit mx-auto mb-6">
                  <MapIcon className="w-16 h-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Sélectionnez un numéro
                </h3>
                <p className="text-gray-500 max-w-md">
                  Choisissez un numéro dans la liste de gauche pour afficher ses positions
                  et son parcours sur la carte.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
