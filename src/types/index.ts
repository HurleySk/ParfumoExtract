export interface Brand {
  id?: number;
  name: string;
  country?: string;
  foundedYear?: number;
  description?: string;
  website?: string;
}

export interface Perfumer {
  id?: number;
  name: string;
  bio?: string;
}

export interface Note {
  id?: number;
  name: string;
  categoryId?: number;
  description?: string;
}

export interface Fragrance {
  id?: number;
  parfumoId: string;
  name: string;
  brandId?: number;
  brand?: Brand;
  releaseYear?: number;
  gender?: string;
  fragranceType?: string;
  concentration?: string;
  description?: string;
  ratingValue?: number;
  ratingCount?: number;
  longevityRating?: number;
  sillageRating?: number;
  bottleSize?: string;
  url: string;
  lastCrawled?: Date;
}

export interface FragranceNote {
  fragrance: string;
  note: string;
  position: 'top' | 'middle' | 'base' | 'single';
}

export interface Accord {
  id?: number;
  name: string;
  strength?: number;
}

export interface CrawlResult {
  fragrance: Fragrance;
  brand: Brand;
  notes: {
    top: string[];
    middle: string[];
    base: string[];
  };
  perfumers: string[];
  accords: Array<{ name: string; strength: number }>;
  seasons: Array<{ name: string; suitability: number }>;
  occasions: Array<{ name: string; suitability: number }>;
  fragranceTypes?: Array<{ name: string; votes: number }>;
  votingDistributions?: Record<string, {
    distribution: Record<string, number>;
    average: number | null;
    raw_average: number | null;
  }>;
}

export interface CrawlHistory {
  id?: number;
  url: string;
  status: 'success' | 'failed' | 'skipped';
  responseCode?: number;
  errorMessage?: string;
  itemsExtracted?: number;
  durationMs?: number;
  createdAt?: Date;
}

export interface CrawlerOptions {
  maxPages?: number;
  startUrl?: string;
  categoryFilter?: string[];
  skipExisting?: boolean;
}