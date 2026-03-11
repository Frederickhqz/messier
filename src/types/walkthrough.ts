// Walkthrough item within a space (bed, toilet, sink, etc.)
export interface WalkthroughItem {
  id: string;
  name: string; // "Bunk Bed", "Twin Bed", "Toilet", "Sink", etc.
  type: ItemType;
  subType?: string; // "full+twin" for bunk bed, "single" for sink, etc.
  photoRequests: PhotoRequest[];
  order: number;
}

export type ItemType = 
  | 'bed' 
  | 'bunkbed' 
  | 'sofa' 
  | 'dining_table'
  | 'tv'
  | 'toilet' 
  | 'sink' 
  | 'shower' 
  | 'bathtub' 
  | 'hot_tub'
  | 'pool'
  | 'patio_furniture'
  | 'appliances'
  | 'other';

// Walkthrough space (per actual room, not room type)
export interface WalkthroughSpace {
  id: string;
  name: string; // "Bedroom 1", "Master Bedroom", "Shared Bathroom", "Pool"
  type: SpaceType;
  location?: string; // "First floor on the right", "Second floor, left of stairs"
  order: number;
  
  // Items within this space (beds, furniture, fixtures)
  items: WalkthroughItem[];
  
  // General photo requests for the space (overall view, etc.)
  photoRequests: PhotoRequest[];
  
  // If this space is shared (e.g., shared bathroom)
  sharedWith?: string[]; // IDs of spaces that share this
}

export type SpaceType = 
  | 'bedroom' 
  | 'bathroom' 
  | 'kitchen' 
  | 'livingRoom' 
  | 'diningRoom' 
  | 'office' 
  | 'garage' 
  | 'patio' 
  | 'pool'
  | 'laundry' 
  | 'other';

export interface PhotoRequest {
  id: string;
  instruction: string; // "Take photo under the bed"
  instructionTranslations?: Record<string, string>;
  hint?: string;
  hintTranslations?: Record<string, string>;
  required: boolean;
  multiplePhotos: boolean; // Allow multiple photos for this request
  order: number;
}

// Walkthrough configuration for a property
export interface WalkthroughConfig {
  id: string;
  propertyId: string;
  spaces: WalkthroughSpace[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Bed count aggregation for linen calculations
export interface BedCount {
  king: number;
  queen: number;
  full: number;
  twin: number;
  twinXL: number;
  californiaKing: number;
  total: number;
}