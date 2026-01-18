// Types pour l'application de suivi télécom

export interface CallRecord {
  id: string;
  callerNumber: string;
  calledNumber: string;
  imei: string;
  dateTime: Date;
  duration: string;
  location: LocationData | null;
  rawLocation: string;
}

export interface LocationData {
  siteName: string;
  cellId: string;
  longitude: number;
  latitude: number;
  azimuth: string;
  region?: string;
}

export interface PhoneNumber {
  number: string;
  identity?: string;
  operator?: string;
  imei?: string;
  callCount: number;
  smsCount: number;
  firstActivity: Date | null;
  lastActivity: Date | null;
  locations: LocationData[];
  records: CallRecord[];
}

export interface SubscriberInfo {
  number: string;
  fullName: string;
  birthDate?: string;
  cniNumber?: string;
  cniExpiration?: string;
  address?: string;
}

export interface ParsedExcelData {
  fileName: string;
  fileType: 'NUMERO' | 'IMEI' | 'CC';
  subscriber?: SubscriberInfo;
  phoneNumbers: Map<string, PhoneNumber>;
  allRecords: CallRecord[];
  subscribers: SubscriberInfo[];
}

export interface FileUploadResult {
  success: boolean;
  data?: ParsedExcelData;
  error?: string;
}

export interface MapPosition {
  lat: number;
  lng: number;
  timestamp: Date;
  siteName: string;
  cellId: string;
}

export interface TrajectoryData {
  phoneNumber: string;
  positions: MapPosition[];
  totalDistance?: number;
}
