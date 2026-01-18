'use client';

import { useState, useMemo } from 'react';
import { Search, Phone, MapPin, Clock, User, ChevronRight, Filter, SortAsc, SortDesc } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    latitude: number;
    longitude: number;
  }>;
  records: Array<{
    id: string;
    dateTime: string;
    location: {
      siteName: string;
      latitude: number;
      longitude: number;
    } | null;
  }>;
}

interface PhoneListProps {
  phoneNumbers: PhoneData[];
  selectedNumber: string | null;
  onSelectNumber: (number: string) => void;
}

type SortField = 'number' | 'activity' | 'locations' | 'calls';
type SortOrder = 'asc' | 'desc';

export default function PhoneList({ phoneNumbers, selectedNumber, onSelectNumber }: PhoneListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('activity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [minLocations, setMinLocations] = useState(0);

  const filteredAndSortedNumbers = useMemo(() => {
    let result = [...phoneNumbers];

    // Filtrer par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.number.toLowerCase().includes(query) ||
          p.identity?.toLowerCase().includes(query)
      );
    }

    // Filtrer par nombre minimum de localisations
    if (minLocations > 0) {
      result = result.filter(p => p.locations.length >= minLocations);
    }

    // Trier
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'number':
          comparison = a.number.localeCompare(b.number);
          break;
        case 'activity':
          const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'locations':
          comparison = a.locations.length - b.locations.length;
          break;
        case 'calls':
          comparison = (a.callCount + a.smsCount) - (b.callCount + b.smsCount);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [phoneNumbers, searchQuery, sortField, sortOrder, minLocations]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header avec recherche */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            Numéros ({filteredAndSortedNumbers.length})
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un numéro ou un nom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Filtres avancés */}
        {showFilters && (
          <div className="pt-2 space-y-3 animate-fadeIn">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleSort('activity')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortField === 'activity'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                Activité
                {sortField === 'activity' && (
                  sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => toggleSort('locations')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortField === 'locations'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <MapPin className="w-3 h-3" />
                Positions
                {sortField === 'locations' && (
                  sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => toggleSort('calls')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  sortField === 'calls'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Phone className="w-3 h-3" />
                Appels
                {sortField === 'calls' && (
                  sortOrder === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Min. positions:</span>
              <input
                type="range"
                min="0"
                max="20"
                value={minLocations}
                onChange={(e) => setMinLocations(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs font-medium text-gray-700 w-6">{minLocations}</span>
            </div>
          </div>
        )}
      </div>

      {/* Liste des numéros */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedNumbers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <Phone className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Aucun numéro trouvé</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredAndSortedNumbers.map((phone) => (
              <button
                key={phone.number}
                onClick={() => onSelectNumber(phone.number)}
                className={`w-full p-4 text-left transition-all duration-200 hover:bg-gray-50 ${
                  selectedNumber === phone.number
                    ? 'bg-blue-50 border-l-4 border-blue-500'
                    : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Numéro de téléphone */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900">
                        {phone.number}
                      </span>
                      {phone.locations.length > 0 && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <MapPin className="w-3 h-3" />
                          {phone.locations.length}
                        </span>
                      )}
                    </div>

                    {/* Identité */}
                    {phone.identity && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                        <User className="w-3 h-3" />
                        <span className="truncate">{phone.identity}</span>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {phone.callCount} appels
                      </span>
                      <span>{phone.smsCount} SMS</span>
                    </div>

                    {/* Dernière activité */}
                    {phone.lastActivity && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatDate(phone.lastActivity)}
                      </div>
                    )}
                  </div>

                  <ChevronRight className={`w-5 h-5 transition-transform ${
                    selectedNumber === phone.number
                      ? 'text-blue-500 translate-x-1'
                      : 'text-gray-300'
                  }`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
