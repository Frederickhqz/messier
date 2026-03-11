// Walkthrough space (per actual room, not room type)
export interface WalkthroughSpace {
  id: string;
  name: string; // "Bedroom 1", "Master Bedroom", "Bathroom 1", etc.
  type: 'bedroom' | 'bathroom' | 'kitchen' | 'livingRoom' | 'diningRoom' | 'office' | 'garage' | 'patio' | 'laundry' | 'other';
  order: number;
  
  // Photo requests for this space
  photoRequests: PhotoRequest[];
}

export interface PhotoRequest {
  id: string;
  instruction: string; // "Take photo of bed made"
  instructionTranslations?: Record<string, string>; // { es: "Tomar foto de la cama hecha", ... }
  location?: string; // "Near the window", "Inside closet"
  hint?: string; // "Make sure curtains are open"
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

// Walkthrough completion for a service
export interface WalkthroughCompletion {
  id: string;
  serviceId: string;
  propertyId: string;
  spaceId: string;
  photoRequestId: string;
  photoUrls: string[];
  notes?: string;
  completedBy: string;
  completedAt: Date;
  approved?: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}