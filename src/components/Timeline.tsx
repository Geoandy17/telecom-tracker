'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Phone, MessageSquare, MapPin, Clock } from 'lucide-react';

interface Record {
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
}

interface TimelineProps {
  records: Record[];
  phoneNumber: string;
}

export default function Timeline({ records, phoneNumber }: TimelineProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy 'à' HH:mm:ss", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'HH:mm:ss', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatDayHeader = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE dd MMMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  // Grouper par jour
  const groupedByDay = records.reduce((acc, record) => {
    const day = record.dateTime ? new Date(record.dateTime).toDateString() : 'Date inconnue';
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(record);
    return acc;
  }, {} as { [key: string]: Record[] });

  if (records.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun enregistrement</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <div className="text-sm font-semibold text-gray-500 mb-4">
        {records.length} enregistrement{records.length > 1 ? 's' : ''}
      </div>

      {Object.entries(groupedByDay).map(([day, dayRecords]) => (
        <div key={day} className="space-y-3">
          {/* En-tête du jour */}
          <div className="sticky top-0 bg-white z-10 py-2">
            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide bg-gray-100 rounded-lg px-3 py-2">
              {formatDayHeader(dayRecords[0].dateTime)}
            </div>
          </div>

          {/* Enregistrements du jour */}
          <div className="relative pl-6 space-y-3">
            {/* Ligne verticale */}
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-blue-200 to-blue-100"></div>

            {dayRecords.map((record, index) => {
              const isSMS = record.duration === 'SMS';
              const isOutgoing = record.callerNumber === phoneNumber;

              return (
                <div
                  key={record.id || index}
                  className="relative bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Point sur la timeline */}
                  <div className={`absolute -left-4 top-4 w-3 h-3 rounded-full border-2 border-white shadow ${
                    isSMS ? 'bg-purple-500' : isOutgoing ? 'bg-blue-500' : 'bg-green-500'
                  }`}></div>

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Type et heure */}
                      <div className="flex items-center gap-2 mb-1">
                        {isSMS ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            <MessageSquare className="w-3 h-3" />
                            SMS
                          </span>
                        ) : (
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isOutgoing
                              ? 'text-blue-600 bg-blue-50'
                              : 'text-green-600 bg-green-50'
                          }`}>
                            <Phone className="w-3 h-3" />
                            {isOutgoing ? 'Sortant' : 'Entrant'}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatTime(record.dateTime)}
                        </span>
                      </div>

                      {/* Numéros */}
                      <div className="text-sm text-gray-800">
                        {isOutgoing ? (
                          <>
                            <span className="text-gray-500">Vers:</span>{' '}
                            <span className="font-mono font-medium">{record.calledNumber || 'Inconnu'}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">De:</span>{' '}
                            <span className="font-mono font-medium">{record.callerNumber || 'Inconnu'}</span>
                          </>
                        )}
                      </div>

                      {/* Durée */}
                      {!isSMS && record.duration && (
                        <div className="text-xs text-gray-500 mt-1">
                          Durée: {record.duration}
                        </div>
                      )}

                      {/* Localisation */}
                      {record.location && (
                        <div className="flex items-start gap-1 mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                          <MapPin className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium">{record.location.siteName}</div>
                            <div className="text-gray-400">
                              {record.location.latitude.toFixed(6)}, {record.location.longitude.toFixed(6)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
