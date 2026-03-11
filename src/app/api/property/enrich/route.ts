import { NextRequest, NextResponse } from 'next/server';

// Uses the Firebase API key (same project, Places API enabled)
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  if (action === 'autocomplete') {
    const input = searchParams.get('input');
    if (!input) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', data);
        return NextResponse.json({ predictions: [] });
      }
      
      return NextResponse.json({ predictions: data.predictions || [] });
    } catch (error) {
      console.error('Autocomplete error:', error);
      return NextResponse.json({ predictions: [] });
    }
  }
  
  if (action === 'details') {
    const placeId = searchParams.get('placeId');
    if (!placeId) {
      return NextResponse.json({ error: 'Place ID required' }, { status: 400 });
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,photos,name,types&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error('Google Places Details API error:', data);
        return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      }
      
      const result = data.result;
      
      // Get photo URLs if available
      let photos: string[] = [];
      if (result.photos && result.photos.length > 0) {
        photos = result.photos.slice(0, 5).map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
        );
      }
      
      // Extract address components
      const addressComponents: Record<string, string> = {};
      if (result.address_components) {
        result.address_components.forEach((comp: any) => {
          comp.types.forEach((type: string) => {
            addressComponents[type] = comp.long_name;
          });
        });
      }
      
      return NextResponse.json({
        placeId,
        name: result.name,
        formattedAddress: result.formatted_address,
        latitude: result.geometry?.location?.lat,
        longitude: result.geometry?.location?.lng,
        photos,
        addressComponents: {
          streetNumber: addressComponents.street_number || '',
          street: addressComponents.route || '',
          city: addressComponents.locality || addressComponents.sublocality || '',
          state: addressComponents.administrative_area_level_1 || '',
          zipCode: addressComponents.postal_code || '',
          country: addressComponents.country || ''
        }
      });
    } catch (error) {
      console.error('Place details error:', error);
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
    }
  }
  
  if (action === 'enrich') {
    const address = searchParams.get('address');
    const placeId = searchParams.get('placeId');
    
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }
    
    try {
      // Use RentCast API for property data (if available)
      // Fallback to estimated data based on address parsing
      
      let propertyData: Record<string, any> = {
        address,
        enriched: true
      };
      
      // If we have a placeId, get Google Places data first
      if (placeId && GOOGLE_API_KEY) {
        const placesResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,photos,name,types&key=${GOOGLE_API_KEY}`
        );
        const placesData = await placesResponse.json();
        
        if (placesData.status === 'OK') {
          const result = placesData.result;
          
          propertyData.latitude = result.geometry?.location?.lat;
          propertyData.longitude = result.geometry?.location?.lng;
          propertyData.formattedAddress = result.formatted_address;
          
          // Get first photo as main photo
          if (result.photos && result.photos.length > 0) {
            propertyData.mainPhoto = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${result.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
            propertyData.photos = result.photos.slice(0, 5).map((photo: any) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
            );
          }
        }
      }
      
      // Try RentCast API for property details (if API key available)
      if (process.env.RENTCAST_API_KEY) {
        try {
          const rentcastResponse = await fetch(
            `https://api.rentcast.io/v1/property?address=${encodeURIComponent(address)}&key=${process.env.RENTCAST_API_KEY}`
          );
          
          if (rentcastResponse.ok) {
            const rentcastData = await rentcastResponse.json();
            
            if (rentcastData) {
              propertyData = {
                ...propertyData,
                propertyType: rentcastData.propertyType || 'house',
                bedrooms: rentcastData.bedrooms,
                bathrooms: rentcastData.bathrooms,
                squareFeet: rentcastData.squareFootage,
                yearBuilt: rentcastData.yearBuilt,
                lotSize: rentcastData.lotSize
              };
              
              // Generate bedroom config based on bedroom count
              if (rentcastData.bedrooms) {
                propertyData.bedroomConfig = generateBedroomConfig(rentcastData.bedrooms);
              }
            }
          }
        } catch (rentcastError) {
          console.log('RentCast API not available, using defaults');
        }
      }
      
      // Generate description
      propertyData.description = generateDescription(propertyData);
      
      return NextResponse.json(propertyData);
    } catch (error) {
      console.error('Enrichment error:', error);
      return NextResponse.json({ error: 'Failed to enrich property' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

function generateBedroomConfig(bedrooms: number): Array<{roomNumber: number; name?: string; beds: Array<{size: string; quantity: number}>}> {
  const config = [];
  
  for (let i = 1; i <= bedrooms; i++) {
    const room: any = {
      roomNumber: i,
      beds: []
    };
    
    if (i === 1) {
      room.name = 'Master Bedroom';
      room.beds.push({ size: 'king', quantity: 1 });
    } else if (i === 2) {
      room.name = 'Guest Bedroom 1';
      room.beds.push({ size: 'queen', quantity: 1 });
    } else if (i === 3) {
      room.name = 'Guest Bedroom 2';
      room.beds.push({ size: 'full', quantity: 1 });
    } else {
      room.name = `Bedroom ${i}`;
      room.beds.push({ size: 'twin', quantity: 2 });
    }
    
    config.push(room);
  }
  
  return config;
}

function generateDescription(data: any): string {
  const parts = [];
  
  if (data.propertyType) {
    parts.push(`Beautiful ${data.propertyType.toLowerCase()}`);
  } else {
    parts.push('Beautiful property');
  }
  
  if (data.bedrooms && data.bathrooms) {
    parts.push(`featuring ${data.bedrooms} bedrooms and ${data.bathrooms} bathrooms`);
  }
  
  if (data.squareFeet) {
    parts.push(`with ${data.squareFeet.toLocaleString()} sq ft of living space`);
  }
  
  if (data.yearBuilt) {
    parts.push(`built in ${data.yearBuilt}`);
  }
  
  parts.push('. Perfect for short-term rentals or vacation stays.');
  
  return parts.join(' ');
}