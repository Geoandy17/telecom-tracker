import * as XLSX from 'xlsx';
import {
  CallRecord,
  LocationData,
  PhoneNumber,
  ParsedExcelData,
  SubscriberInfo
} from './types';

// Regex pour extraire les coordonnées du format:
// "Nom-Site (Cell: XXX Long: 15.024612 Lat: 12.086185 Azimut: 230)"
const LOCATION_REGEX = /Long:\s*([\d.-]+)\s*Lat:\s*([\d.-]+)/i;

/**
 * Parse une chaîne de localisation pour extraire les coordonnées GPS
 */
export function parseLocationString(locationStr: string): LocationData | null {
  if (!locationStr || locationStr === '--' || locationStr.trim() === '' || locationStr === 'Site inconnu') {
    return null;
  }

  const match = locationStr.match(LOCATION_REGEX);
  if (match) {
    const longitude = parseFloat(match[1]);
    const latitude = parseFloat(match[2]);

    // Validation des coordonnées
    if (isNaN(longitude) || isNaN(latitude)) {
      return null;
    }

    // Vérifier que les coordonnées sont dans des plages valides
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }

    // Extraire le nom du site (tout avant le premier parenthèse ou "Long:")
    let siteName = locationStr.split('(')[0].trim();
    if (!siteName || siteName.toLowerCase().includes('long:')) {
      siteName = locationStr.split('Long:')[0].trim();
    }
    if (!siteName) {
      siteName = 'Site inconnu';
    }

    // Extraire le Cell ID
    const cellMatch = locationStr.match(/Cell:\s*([^\s)]+)/i);
    const cellId = cellMatch ? cellMatch[1] : '';

    // Extraire l'azimuth
    const azimuthMatch = locationStr.match(/Azimut:\s*([^\s)]*)/i);
    const azimuth = azimuthMatch ? azimuthMatch[1] || '-' : '-';

    return {
      siteName,
      cellId,
      longitude,
      latitude,
      azimuth,
    };
  }

  return null;
}

/**
 * Parse une date depuis différents formats Excel
 */
export function parseExcelDate(dateValue: unknown): Date | null {
  if (!dateValue) return null;

  // Si c'est déjà une Date
  if (dateValue instanceof Date) {
    return dateValue;
  }

  // Si c'est un nombre (date Excel sérialisée)
  if (typeof dateValue === 'number') {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
    }
  }

  // Si c'est une chaîne
  if (typeof dateValue === 'string') {
    // Format: "DD/MM/YYYY HH:MM:SS"
    const match1 = dateValue.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match1) {
      return new Date(
        parseInt(match1[3]),
        parseInt(match1[2]) - 1,
        parseInt(match1[1]),
        parseInt(match1[4]),
        parseInt(match1[5]),
        parseInt(match1[6])
      );
    }

    // Format: "DD-MM-YYYY HH:MM:SS"
    const match2 = dateValue.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match2) {
      return new Date(
        parseInt(match2[3]),
        parseInt(match2[2]) - 1,
        parseInt(match2[1]),
        parseInt(match2[4]),
        parseInt(match2[5]),
        parseInt(match2[6])
      );
    }

    // Format ISO
    const isoDate = new Date(dateValue);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  return null;
}

/**
 * Normalise un numéro de téléphone
 */
export function normalizePhoneNumber(phone: unknown): string {
  if (!phone) return '';

  let phoneStr = String(phone).trim();

  // Supprimer le préfixe 237 si présent
  if (phoneStr.startsWith('237')) {
    phoneStr = phoneStr.substring(3);
  }

  // Ne garder que les chiffres
  phoneStr = phoneStr.replace(/\D/g, '');

  return phoneStr;
}

/**
 * Normalise une chaîne en supprimant les accents
 */
function normalizeString(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Détecte le type de fichier basé sur la structure des feuilles
 */
function detectFileType(sheetNames: string[]): 'NUMERO' | 'IMEI' | 'CC' {
  const normalizedNames = sheetNames.map(n => normalizeString(n));

  if (normalizedNames.some(n => n.includes('listing appel') || n.includes('listing sms'))) {
    return 'NUMERO';
  }

  if (normalizedNames.some(n => n.includes('imei partage'))) {
    return 'IMEI';
  }

  return 'CC';
}

/**
 * Trouve les feuilles contenant les données de localisation (appels ET SMS)
 */
function findListingSheets(workbook: XLSX.WorkBook): { calls: string | null; sms: string | null } {
  const sheetNames = workbook.SheetNames;
  let callsSheet: string | null = null;
  let smsSheet: string | null = null;

  // Chercher "Listing Appel" et "Listing SMS" (fichiers NUMERO)
  for (const name of sheetNames) {
    const normalized = normalizeString(name);

    if (normalized.includes('listing appel')) {
      callsSheet = name;
    }

    if (normalized.includes('listing sms')) {
      smsSheet = name;
    }

    // Chercher "Listing" comme fallback (fichiers IMEI/CC)
    if (normalized === 'listing' && !callsSheet) {
      callsSheet = name;
    }
  }

  return { calls: callsSheet, sms: smsSheet };
}

/**
 * Trouve la feuille d'identification des abonnés
 */
function findSubscribersSheet(workbook: XLSX.WorkBook): string | null {
  for (const name of workbook.SheetNames) {
    const normalized = normalizeString(name);
    if (normalized.includes('identification')) {
      return name;
    }
  }
  return null;
}

/**
 * Identifie les colonnes du fichier Excel
 */
function identifyColumns(columns: string[]): {
  callerNumberCol: string | null;
  calledNumberCol: string | null;
  imeiCol: string | null;
  dateCol: string | null;
  durationCol: string | null;
  locationCol: string | null;
} {
  let callerNumberCol: string | null = null;
  let calledNumberCol: string | null = null;
  let imeiCol: string | null = null;
  let dateCol: string | null = null;
  let durationCol: string | null = null;
  let locationCol: string | null = null;

  for (const col of columns) {
    const normalized = normalizeString(col);

    // Localisation - vérifier EN PREMIER car contient aussi "numero appelant"
    if (normalized.includes('localisation')) {
      locationCol = col;
    }
    // IMEI - vérifier AVANT numéro appelant
    else if (normalized.includes('imei')) {
      imeiCol = col;
    }
    // Numéro appelant ou émetteur - SEULEMENT si ça commence par "numero"
    else if (normalized.startsWith('numero appelant') || normalized.startsWith('numero emetteur')) {
      callerNumberCol = col;
    }
    // Numéro appelé ou récepteur
    else if (normalized.startsWith('numero appele') || normalized.startsWith('numero recepteur')) {
      calledNumberCol = col;
    }
    // Date
    else if (normalized.includes('date')) {
      dateCol = col;
    }
    // Durée
    else if (normalized.includes('duree')) {
      durationCol = col;
    }
  }

  // Debug: log identified columns
  console.log('Colonnes identifiées:', {
    callerNumberCol,
    calledNumberCol,
    imeiCol,
    dateCol,
    durationCol,
    locationCol
  });

  return { callerNumberCol, calledNumberCol, imeiCol, dateCol, durationCol, locationCol };
}

/**
 * Parse la feuille de listing pour extraire les enregistrements d'appels
 */
function parseListingSheet(worksheet: XLSX.WorkSheet): CallRecord[] {
  const records: CallRecord[] = [];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (data.length === 0) return records;

  // Identifier les colonnes à partir de la première ligne
  const columns = Object.keys(data[0] as object);
  const { callerNumberCol, calledNumberCol, imeiCol, dateCol, durationCol, locationCol } = identifyColumns(columns);

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, unknown>;

    // Extraire les valeurs en utilisant les colonnes identifiées
    const callerNumber = callerNumberCol ? normalizePhoneNumber(row[callerNumberCol]) : '';
    const calledNumber = calledNumberCol ? normalizePhoneNumber(row[calledNumberCol]) : '';
    const imei = imeiCol ? String(row[imeiCol] || '').trim() : '';
    const dateTime = dateCol ? parseExcelDate(row[dateCol]) : null;
    const duration = durationCol ? String(row[durationCol] || '').trim() : '';
    const locationStr = locationCol ? String(row[locationCol] || '').trim() : '';

    // Parser la localisation
    const location = parseLocationString(locationStr);

    // Ajouter l'enregistrement si on a au moins un numéro
    if (callerNumber || calledNumber) {
      records.push({
        id: `record-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        callerNumber,
        calledNumber,
        imei,
        dateTime: dateTime || new Date(),
        duration,
        location,
        rawLocation: locationStr,
      });
    }
  }

  console.log(`Parsed ${records.length} records, ${records.filter(r => r.location).length} with location`);

  return records;
}

/**
 * Parse la feuille d'identification des abonnés
 */
function parseSubscribersSheet(worksheet: XLSX.WorkSheet): SubscriberInfo[] {
  const subscribers: SubscriberInfo[] = [];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  for (const row of data) {
    const rowData = row as Record<string, unknown>;
    const subscriber: SubscriberInfo = {
      number: '',
      fullName: '',
    };

    for (const [key, value] of Object.entries(rowData)) {
      const normalizedKey = normalizeString(key);

      // Numéro (exactement "numero" ou commençant par "numero" sans "cni")
      if (normalizedKey === 'numero' || (normalizedKey.startsWith('numero') && !normalizedKey.includes('cni'))) {
        if (!subscriber.number) {
          subscriber.number = normalizePhoneNumber(value);
        }
      }
      // Nom et prénom
      else if (normalizedKey.includes('nom') && normalizedKey.includes('prenom')) {
        subscriber.fullName = String(value || '').trim();
      }
      // Date de naissance
      else if (normalizedKey.includes('date') && normalizedKey.includes('naissance')) {
        const date = parseExcelDate(value);
        subscriber.birthDate = date ? date.toLocaleDateString('fr-FR') : undefined;
      }
      // Numéro CNI
      else if (normalizedKey.includes('numero') && normalizedKey.includes('cni')) {
        subscriber.cniNumber = String(value || '').trim();
      }
      // Expiration CNI
      else if (normalizedKey.includes('expiration')) {
        const date = parseExcelDate(value);
        subscriber.cniExpiration = date ? date.toLocaleDateString('fr-FR') : undefined;
      }
      // Adresse
      else if (normalizedKey === 'adresse') {
        subscriber.address = String(value || '').trim();
      }
    }

    if (subscriber.number) {
      subscribers.push(subscriber);
    }
  }

  return subscribers;
}

/**
 * Agrège les enregistrements par numéro de téléphone
 */
function aggregateByPhoneNumber(
  records: CallRecord[],
  subscribers: SubscriberInfo[]
): Map<string, PhoneNumber> {
  const phoneMap = new Map<string, PhoneNumber>();
  const subscriberMap = new Map(subscribers.map(s => [s.number, s]));

  for (const record of records) {
    // Traiter le numéro appelant
    const number = record.callerNumber;
    if (!number || number.length < 6) continue; // Ignorer les numéros trop courts

    if (!phoneMap.has(number)) {
      const subscriber = subscriberMap.get(number);
      phoneMap.set(number, {
        number,
        identity: subscriber?.fullName,
        callCount: 0,
        smsCount: 0,
        firstActivity: null,
        lastActivity: null,
        locations: [],
        records: [],
      });
    }

    const phoneData = phoneMap.get(number)!;

    // Incrémenter les compteurs
    if (record.duration === 'SMS' || record.duration.toLowerCase() === 'sms') {
      phoneData.smsCount++;
    } else {
      phoneData.callCount++;
    }

    // Mettre à jour les dates
    if (record.dateTime) {
      if (!phoneData.firstActivity || record.dateTime < phoneData.firstActivity) {
        phoneData.firstActivity = record.dateTime;
      }
      if (!phoneData.lastActivity || record.dateTime > phoneData.lastActivity) {
        phoneData.lastActivity = record.dateTime;
      }
    }

    // Ajouter la localisation si disponible
    if (record.location) {
      // Vérifier si cette localisation existe déjà (avec une tolérance)
      const exists = phoneData.locations.some(
        loc => Math.abs(loc.latitude - record.location!.latitude) < 0.0001 &&
               Math.abs(loc.longitude - record.location!.longitude) < 0.0001
      );
      if (!exists) {
        phoneData.locations.push(record.location);
      }
    }

    // Ajouter l'enregistrement
    phoneData.records.push(record);
  }

  // Trier les enregistrements par date pour chaque numéro
  for (const phoneData of phoneMap.values()) {
    phoneData.records.sort((a, b) => {
      const dateA = a.dateTime?.getTime() || 0;
      const dateB = b.dateTime?.getTime() || 0;
      return dateA - dateB;
    });
  }

  return phoneMap;
}

/**
 * Parse un fichier Excel complet
 */
export function parseExcelFile(buffer: ArrayBuffer, fileName: string): ParsedExcelData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  console.log('Parsing file:', fileName);
  console.log('Sheets:', workbook.SheetNames);

  const fileType = detectFileType(workbook.SheetNames);
  console.log('File type detected:', fileType);

  // Trouver et parser les feuilles de listing (appels ET SMS)
  const listingSheets = findListingSheets(workbook);
  console.log('Listing sheets:', listingSheets);

  let allRecords: CallRecord[] = [];

  // Parser la feuille des appels
  if (listingSheets.calls) {
    const callsSheet = workbook.Sheets[listingSheets.calls];
    const callRecords = parseListingSheet(callsSheet);
    allRecords.push(...callRecords);
    console.log(`Parsed ${callRecords.length} call records`);
  }

  // Parser la feuille des SMS
  if (listingSheets.sms) {
    const smsSheet = workbook.Sheets[listingSheets.sms];
    const smsRecords = parseListingSheet(smsSheet);
    // Marquer les enregistrements SMS avec duration = 'SMS'
    smsRecords.forEach(record => {
      if (!record.duration || record.duration === '') {
        record.duration = 'SMS';
      }
    });
    allRecords.push(...smsRecords);
    console.log(`Parsed ${smsRecords.length} SMS records`);
  }

  // Parser la feuille des abonnés
  const subscribersSheetName = findSubscribersSheet(workbook);
  let subscribers: SubscriberInfo[] = [];

  if (subscribersSheetName) {
    const subscribersSheet = workbook.Sheets[subscribersSheetName];
    subscribers = parseSubscribersSheet(subscribersSheet);
  }

  // Agréger par numéro de téléphone
  const phoneNumbers = aggregateByPhoneNumber(allRecords, subscribers);

  console.log('Total phone numbers:', phoneNumbers.size);
  console.log('Phone numbers with locations:', Array.from(phoneNumbers.values()).filter(p => p.locations.length > 0).length);

  return {
    fileName,
    fileType,
    phoneNumbers,
    allRecords,
    subscribers,
  };
}

/**
 * Convertit les données parsées en format JSON sérialisable
 */
export function serializeParsedData(data: ParsedExcelData): object {
  const phoneNumbersArray = Array.from(data.phoneNumbers.entries()).map(([phoneNum, phoneData]) => ({
    number: phoneNum,
    identity: phoneData.identity,
    operator: phoneData.operator,
    imei: phoneData.imei,
    callCount: phoneData.callCount,
    smsCount: phoneData.smsCount,
    locations: phoneData.locations,
    records: phoneData.records.map(r => ({
      ...r,
      dateTime: r.dateTime?.toISOString(),
    })),
    firstActivity: phoneData.firstActivity?.toISOString(),
    lastActivity: phoneData.lastActivity?.toISOString(),
  }));

  return {
    fileName: data.fileName,
    fileType: data.fileType,
    phoneNumbers: phoneNumbersArray,
    allRecords: data.allRecords.map(r => ({
      ...r,
      dateTime: r.dateTime?.toISOString(),
    })),
    subscribers: data.subscribers,
  };
}
