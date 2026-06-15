export type PrefectureCode =
  | "osaka"
  | "kyoto"
  | "hyogo"
  | "nara"
  | "shiga"
  | "wakayama";

export interface Zoo {
  id: string;
  name: string;
  nameKana: string;
  prefecture: PrefectureCode;
  address: string;
  lat: number;
  lon: number;
  openingHours: string;
  closedDays: string;
  admission: string;
  website: string;
  wikipediaUrl?: string;
  features: string[];
}
