import { NextRequest, NextResponse } from 'next/server';

// Google Places API key - dedicated for Places API
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  // Check if API key is available
  if (!GOOGLE_API_KEY) {
    console.warn('Google Places API key not configured');
    return NextResponse.json({ 
      error: 'API key not configured',
      predictions: [],
      note: 'Set GOOGLE_PLACES_API_KEY or enable Places API in Google Cloud Console'
    });
  }
  
  if (action === 'autocomplete') {
    const input = searchParams.get('input');
    if (!input) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }
    
    // Don't call API for very short inputs
    if (input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }
    
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&key=${GOOGLE_API_KEY}`;
      console.log('Calling Google Places autocomplete for:', input);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Google Places response:', data.status, data.error_message || '');
      
      if (data.status === 'REQUEST_DENIED') {
        console.error('Places API access denied:', data.error_message);
        return NextResponse.json({ 
          predictions: [],
          error: 'Places API not enabled. Please enable Places API in Google Cloud Console.',
          details: data.error_message
        });
      }
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', data.status, data.error_message);
        return NextResponse.json({ predictions: [] });
      }
      
      return NextResponse.json({ 
        predictions: data.predictions || [],
        status: data.status 
      });
    } catch (error) {
      console.error('Autocomplete error:', error);
      return NextResponse.json({ 
        predictions: [],
        error: 'Failed to fetch address suggestions'
      });
    }
  }
  
  if (action === 'details') {
    const placeId = searchParams.get('placeId');
    if (!placeId) {
      return NextResponse.json({ error: 'Place ID required' }, { status: 400 });
    }
    
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,photos,name,types,address_components&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error('Google Places Details API error:', data.status, data.error_message);
        return NextResponse.json({ error: 'Place not found', details: data.error_message }, { status: 404 });
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
    
    // Always return success with the address, even if enrichment fails
    let propertyData: Record<string, any> = {
      address,
      enriched: false
    };
    
    try {
      // If we have a placeId, get Google Places data
      if (placeId && GOOGLE_API_KEY) {
        try {
          const placesResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,photos,name,types&key=${GOOGLE_API_KEY}`
          );
          const placesData = await placesResponse.json();
          
          if (placesData.status === 'OK') {
            const result = placesData.result;
            
            propertyData = {
              ...propertyData,
              enriched: true,
              latitude: result.geometry?.location?.lat,
              longitude: result.geometry?.location?.lng,
              formattedAddress: result.formatted_address
            };
            
            // Get first photo as main photo
            if (result.photos && result.photos.length > 0) {
              propertyData.mainPhoto = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${result.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
              propertyData.photos = result.photos.slice(0, 5).map((photo: any) =>
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photo.photo_reference}&key=${GOOGLE_API_KEY}`
              );
            }
          } else {
            console.log('Places enrichment failed:', placesData.status, placesData.error_message);
          }
        } catch (e) {
          console.log('Places API error:', e);
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
              
              if (rentcastData.bedrooms) {
                propertyData.bedroomConfig = generateBedroomConfig(rentcastData.bedrooms);
              }
            }
          }
        } catch (e) {
          console.log('RentCast API not available:', e);
        }
      }
      
      // Generate description
      if (propertyData.enriched) {
        propertyData.description = generateDescription(propertyData);
      }
      
      return NextResponse.json(propertyData);
    } catch (error) {
      console.error('Enrichment error:', error);
      // Return address even on error
      return NextResponse.json({ address, enriched: false });
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