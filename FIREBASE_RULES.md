# Firebase Setup for Messier

## 1. Create Firebase Project (if needed)

You already have project `messier-mavuja` - skip this step.

## 2. Enable Services

In Firebase Console (https://console.firebase.google.com/project/messier-mavuja):

### Authentication
1. Go to **Authentication** > **Sign-in method**
2. Enable **Email/Password**
3. Save

### Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Start in **production mode**
4. Choose location closest to your users
5. Apply security rules below

### Storage
1. Go to **Storage**
2. Click **Get started**
3. Apply security rules below

## 3. Get Web App Config

1. Go to **Project Settings** (gear icon) > **General**
2. Scroll to **Your apps**
3. If no web app exists, click **Add app** > **Web**
4. Copy the config values to `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=messier-mavuja.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=messier-mavuja
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=messier-mavuja.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## 4. Firestore Security Rules

Go to **Firestore Database** > **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check admin role
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user exists and is active
    function isActiveUser() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.active == true;
    }
    
    // Users - read own profile, write own profile (admin can write any)
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Properties - admin only write, all authenticated read
    match /properties/{propertyId} {
      allow read: if isActiveUser();
      allow create, update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // Clean Services - all authenticated users
    match /cleanServices/{serviceId} {
      allow read: if isActiveUser();
      // Admins can create/update any, members can only update assigned services
      allow create: if isAdmin();
      allow update: if isActiveUser() && (
        isAdmin() || 
        request.auth.uid in resource.data.assignedCleaners ||
        request.auth.uid in request.resource.data.assignedCleaners
      );
      allow delete: if isAdmin();
    }
    
    // Photos - all authenticated users
    match /photos/{photoId} {
      allow read: if isActiveUser();
      allow create: if isActiveUser();
      allow update: if isActiveUser() && request.auth.uid == resource.data.uploadedBy;
      allow delete: if isAdmin();
    }
    
    // Issues - all authenticated users
    match /issues/{issueId} {
      allow read: if isActiveUser();
      allow create: if isActiveUser();
      allow update: if isActiveUser();
      allow delete: if isAdmin();
    }
  }
}
```

## 5. Storage Security Rules

Go to **Storage** > **Rules** and paste:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Photos folder - authenticated users can upload, anyone can read
    match /photos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Issue photos
    match /issues/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 6. Create First Admin User

After the app is deployed and running:

1. Go to the app and sign up with your email
2. Go to **Firestore Database** > **Data**
3. Find the `users` collection
4. Edit your user document
5. Change `role` from `"member"` to `"admin"`

## 7. Enable Push Notifications (Optional)

1. Go to **Project Settings** > **Cloud Messaging**
2. Generate a new private key (for server-side FCM)
3. Add to your environment:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here
```

4. For push notifications in browser, you'll need to set up a service worker

## 8. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

## 9. Set Environment Variables in Vercel

Go to your Vercel project dashboard:
1. **Settings** > **Environment Variables**
2. Add all `NEXT_PUBLIC_*` variables from `.env.local`
3. Redeploy

## Firestore Indexes (Recommended)

For optimized queries, add these indexes in Firebase Console:

**cleanServices collection:**
- Fields: `date` (Ascending), `status` (Ascending)
- Fields: `assignedCleaners` (Array contains), `date` (Ascending)

You'll see index errors in the console if queries need indexes - Firebase provides a direct link to create them.