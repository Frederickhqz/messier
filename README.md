# Messier - Property Housekeeping Management

A real-time property housekeeping management app for overnight rentals.

## Features

- **Property Management**: Add properties with room configurations (bedrooms, bathrooms, kitchens, etc.)
- **Clean Services**: Schedule cleanings, assign cleaners, track status
- **Photo Upload**: Real-time photo uploads by room type
- **Issues Reporting**: Document extra dirty properties, maintenance needs, low inventory
- **Team Management**: Admin and member roles
- **Multilingual**: English, Spanish, Portuguese
- **PWA**: Installable on any device, works offline
- **Push Notifications**: Real-time alerts

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage, FCM)
- **i18n**: next-intl
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project (messier-mavuja)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in your Firebase config:
   ```bash
   cp .env.example .env.local
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Enable Storage
5. Get your web app config from Project Settings

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins can manage properties
    match /properties/{propertyId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // All authenticated users can read/write services
    match /cleanServices/{serviceId} {
      allow read, write: if request.auth != null;
    }
    
    // Photos
    match /photos/{photoId} {
      allow read, write: if request.auth != null;
    }
    
    // Issues
    match /issues/{issueId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Project Structure

```
messier/
├── messages/           # i18n translations (en, es, pt)
├── public/            # Static assets, PWA manifest
├── src/
│   ├── app/           # Next.js app routes
│   │   └── [locale]/  # Internationalized routes
│   ├── components/    # React components
│   ├── lib/           # Firebase, utilities
│   └── types/         # TypeScript types
├── tailwind.config.ts
└── next.config.js
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables

Set these in Vercel dashboard:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## License

MIT