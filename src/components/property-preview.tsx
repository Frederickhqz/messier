'use client';

import { useState } from 'react';
import { Property, PropertyType, BedroomConfig, BedSize } from '@/types';
import { Building2, Bed, Bath, Maximize, Calendar, MapPin, Edit2, Check, X } from 'lucide-react';

interface PropertyPreviewProps {
  data: Partial<Property>;
  onEdit?: () => void;
  onConfirm?: (data: Partial<Property>) => void;
  isEditing?: boolean;
  loading?: boolean;
}

const bedSizeLabels: Record<BedSize, string> = {
  king: 'King',
  queen: 'Queen',
  full: 'Full',
  twin: 'Twin',
  twinXL: 'Twin XL',
  californiaKing: 'California King'
};

const propertyTypeLabels: Record<PropertyType, string> = {
  house: 'House',
  apartment: 'Apartment',
  condo: 'Condo',
  townhouse: 'Townhouse',
  villa: 'Villa',
  cabin: 'Cabin',
  other: 'Other'
};

export default function PropertyPreview({
  data,
  onEdit,
  onConfirm,
  isEditing = false,
  loading = false
}: PropertyPreviewProps) {
  const [editedData, setEditedData] = useState<Partial<Property>>(data);

  const handleBedroomChange = (roomIndex: number, bedIndex: number, field: 'size' | 'quantity', value: any) => {
    setEditedData(prev => {
      const bedroomConfig = [...(prev.bedroomConfig || [])];
      if (!bedroomConfig[roomIndex]) {
        bedroomConfig[roomIndex] = { roomNumber: roomIndex + 1, beds: [] };
      }
      if (!bedroomConfig[roomIndex].beds[bedIndex]) {
        bedroomConfig[roomIndex].beds[bedIndex] = { size: 'queen', quantity: 1 };
      }
      bedroomConfig[roomIndex].beds[bedIndex] = {
        ...bedroomConfig[roomIndex].beds[bedIndex],
        [field]: value
      };
      return { ...prev, bedroomConfig };
    });
  };

  const addBedroom = () => {
    setEditedData(prev => {
      const bedroomConfig = [...(prev.bedroomConfig || [])];
      const roomNumber = bedroomConfig.length + 1;
      bedroomConfig.push({
        roomNumber,
        name: roomNumber === 1 ? 'Master Bedroom' : `Bedroom ${roomNumber}`,
        beds: [{ size: 'queen', quantity: 1 }]
      });
      return { ...prev, bedroomConfig, bedrooms: roomNumber };
    });
  };

  const removeBedroom = (index: number) => {
    setEditedData(prev => {
      const bedroomConfig = [...(prev.bedroomConfig || [])];
      bedroomConfig.splice(index, 1);
      return { ...prev, bedroomConfig, bedrooms: bedroomConfig.length };
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header with photo */}
      {data.mainPhoto && (
        <div className="relative h-48 bg-gray-100">
          <img
            src={data.mainPhoto}
            alt={data.name || 'Property'}
            className="w-full h-full object-cover"
          />
          {data.enriched && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              Enriched
            </div>
          )}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Address */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {data.name || 'New Property'}
              </h3>
              <div className="flex items-center gap-1 text-gray-500 mt-1">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{data.address}</span>
              </div>
            </div>
            {onEdit && !isEditing && (
              <button
                onClick={onEdit}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Edit2 className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
          
          {data.description && (
            <p className="mt-3 text-gray-600">{data.description}</p>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Bed className="w-5 h-5 text-primary-600" />
            <div>
              <div className="text-lg font-semibold">{data.bedrooms || '-'}</div>
              <div className="text-xs text-gray-500">Bedrooms</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Bath className="w-5 h-5 text-primary-600" />
            <div>
              <div className="text-lg font-semibold">{data.bathrooms || '-'}</div>
              <div className="text-xs text-gray-500">Bathrooms</div>
            </div>
          </div>
          
          {data.squareFeet && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Maximize className="w-5 h-5 text-primary-600" />
              <div>
                <div className="text-lg font-semibold">{data.squareFeet.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Sq Ft</div>
              </div>
            </div>
          )}
          
          {data.yearBuilt && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-primary-600" />
              <div>
                <div className="text-lg font-semibold">{data.yearBuilt}</div>
                <div className="text-xs text-gray-500">Year Built</div>
              </div>
            </div>
          )}
        </div>

        {/* Property type */}
        {data.propertyType && (
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {propertyTypeLabels[data.propertyType] || data.propertyType}
            </span>
          </div>
        )}

        {/* Bedroom configuration */}
        {data.bedroomConfig && data.bedroomConfig.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Bedroom Configuration</h4>
            <div className="space-y-3">
              {data.bedroomConfig.map((room, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-700 mb-2">
                    {room.name || `Bedroom ${room.roomNumber}`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.beds.map((bed, bedIndex) => (
                      <span
                        key={bedIndex}
                        className="px-2 py-1 bg-white text-sm rounded border border-gray-200"
                      >
                        {bed.quantity}x {bedSizeLabels[bed.size as BedSize] || bed.size}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amenities */}
        {data.amenities && data.amenities.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Amenities</h4>
            <div className="flex flex-wrap gap-2">
              {data.amenities.map((amenity, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {onConfirm && (
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => onConfirm(editedData)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirm & Create
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}