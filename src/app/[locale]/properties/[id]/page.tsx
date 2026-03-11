'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Property, CleanService, UserProfile } from '@/types';
import { Building2, Bed, Bath, Maximize, Calendar, MapPin, Clock, Users, ChevronLeft, Edit2 } from 'lucide-react';
import Link from 'next/link';

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const t = useTranslations();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [services, setServices] = useState<Array<CleanService & { cleanerNames: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  
  const propertyId = params.id as string;

  useEffect(() => {
    if (!user) return;
    
    const loadProperty = async () => {
      try {
        // Load property
        const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
        if (!propertyDoc.exists()) {
          router.push(`/${locale}/properties`);
          return;
        }
        
        const propertyData = { id: propertyDoc.id, ...propertyDoc.data() } as Property;
        setProperty(propertyData);
        
        // Load services for this property
        const servicesQuery = query(
          collection(db, 'cleanServices'),
          where('propertyId', '==', propertyId),
          orderBy('date', 'desc')
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        
        const servicesData = servicesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: data.date?.toDate(),
            createdAt: data.createdAt?.toDate(),
            clockIn: data.clockIn?.toDate(),
            clockOut: data.clockOut?.toDate()
          };
        }) as CleanService[];
        
        // Load cleaner names for each service
        const servicesWithNames = await Promise.all(
          servicesData.map(async (service) => {
            const cleanerNames = await Promise.all(
              (service.assignedCleaners || []).map(async (uid) => {
                const userDoc = await getDoc(doc(db, 'users', uid));
                return userDoc.exists() ? userDoc.data().displayName : uid;
              })
            );
            return { ...service, cleanerNames };
          })
        );
        
        setServices(servicesWithNames);
      } catch (error) {
        console.error('Error loading property:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadProperty();
  }, [user, propertyId, locale, router]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!property) return null;

  const isAdmin = profile?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push(`/${locale}/properties`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Properties
        </button>

        {/* Property Header */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Main photo */}
          {property.mainPhoto && (
            <div className="h-64 bg-gray-100">
              <img 
                src={property.mainPhoto} 
                alt={property.name} 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
          
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
                <div className="flex items-center gap-1 text-gray-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{property.address}</span>
                </div>
              </div>
              {isAdmin && (
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Edit2 className="w-5 h-5 text-gray-600" />
                </button>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <p className="mt-4 text-gray-600">{property.description}</p>
            )}

            {/* Quick Stats */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Bed className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-lg font-semibold">{property.bedrooms || '-'}</div>
                  <div className="text-xs text-gray-500">Bedrooms</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Bath className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-lg font-semibold">{property.bathrooms || '-'}</div>
                  <div className="text-xs text-gray-500">Bathrooms</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Maximize className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-lg font-semibold">{property.squareFeet ? property.squareFeet.toLocaleString() : '-'}</div>
                  <div className="text-xs text-gray-500">Sq Ft</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-lg font-semibold">{property.yearBuilt || '-'}</div>
                  <div className="text-xs text-gray-500">Year Built</div>
                </div>
              </div>
            </div>

            {/* Property Type */}
            {property.propertyType && (
              <div className="mt-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600 capitalize">{property.propertyType}</span>
              </div>
            )}

            {/* Bedroom Configuration */}
            {property.bedroomConfig && property.bedroomConfig.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-3">Bedroom Configuration</h3>
                <div className="space-y-2">
                  {property.bedroomConfig.map((room, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{room.name || `Bedroom ${room.roomNumber}`}</span>
                        {room.bathroomType === 'full' && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Ensuite</span>
                        )}
                        {room.bathroomType === 'half' && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">½ Bath</span>
                        )}
                      </div>
                      <span className="text-gray-600 capitalize">{room.beds.map(b => `${b.quantity}×${b.size}`).join(' + ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service History */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Service History
          </h2>

          {services.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No services yet</p>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <Link
                  key={service.id}
                  href={`/${locale}/services/${service.id}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{new Date(service.date).toLocaleDateString()}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <Users className="w-4 h-4" />
                        {service.cleanerNames.length > 0 ? service.cleanerNames.join(', ') : 'Unassigned'}
                      </div>
                    </div>
                    <div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        service.status === 'completed' ? 'bg-green-100 text-green-700' :
                        service.status === 'inProgress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {service.status === 'completed' ? 'Completed' : 
                         service.status === 'inProgress' ? 'In Progress' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  {service.clockIn && (
                    <div className="mt-2 text-xs text-gray-400">
                      {service.clockIn && `Clock in: ${new Date(service.clockIn).toLocaleTimeString()}`}
                      {service.clockOut && ` • Clock out: ${new Date(service.clockOut).toLocaleTimeString()}`}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Walkthrough Link */}
        <Link
          href={`/${locale}/properties/${propertyId}/walkthrough`}
          className="block w-full text-center py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
        >
          Configure Walkthrough Steps
        </Link>
      </div>
    </DashboardLayout>
  );
}