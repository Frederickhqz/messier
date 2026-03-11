// User roles
export type UserRole = 'admin' | 'member';

// Room types for property configuration
export type RoomType = 
  | 'bedroom' 
  | 'bathroom' 
  | 'kitchen' 
  | 'livingRoom' 
  | 'diningRoom' 
  | 'office' 
  | 'garage' 
  | 'patio' 
  | 'laundry' 
  | 'other';

export interface RoomConfig {
  type: RoomType;
  count: number;
}

// Property
export interface Property {
  id: string;
  name: string;
  address: string;
  rooms: RoomConfig[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// User profile (extends Firebase Auth)
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Service status
export type ServiceStatus = 'pending' | 'inProgress' | 'completed';

// Clean Service
export interface CleanService {
  id: string;
  propertyId: string;
  propertyName: string;
  date: Date;
  assignedCleaners: string[]; // user UIDs
  status: ServiceStatus;
  clockIn?: Date;
  clockOut?: Date;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

// Photo
export interface Photo {
  id: string;
  serviceId: string;
  roomType: RoomType;
  url: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// Issue types
export type IssueType = 'extraDirty' | 'maintenance' | 'inventory';

// Issue
export interface Issue {
  id: string;
  serviceId: string;
  propertyId: string;
  type: IssueType;
  description: string;
  photos: string[]; // photo URLs
  reportedBy: string;
  reportedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}