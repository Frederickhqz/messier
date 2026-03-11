# Firebase Security Rules for Messier

## Deploy Status

✅ **Rules files created:** `firestore.rules`, `storage.rules`, `firestore.indexes.json`

⚠️ **Deployment requires Firebase Console access** - The service account lacks IAM permissions for CLI deployment.

## Deploy via Firebase Console

### Firestore Rules
1. Go to: https://console.firebase.google.com/project/messier-mavuja/firestore/rules
2. Copy the contents of `firestore.rules` (below)
3. Paste and publish

### Firestore Indexes
1. Go to: https://console.firebase.google.com/project/messier-mavuja/firestore/indexes
2. Add indexes manually or use the error links from console

### Storage Rules
1. Go to: https://console.firebase.google.com/project/messier-mavuja/storage/rules
2. Copy the contents of `storage.rules` (below)
3. Paste and publish

---

## Firestore Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check admin role
    function isAdmin() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
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

## Storage Rules (storage.rules)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Helper function to check admin role
    function isAdmin() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user is authenticated and active
    function isActiveUser() {
      return request.auth != null && 
        firestore.exists(/databases/(default)/documents/users/$(request.auth.uid)) &&
        firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.active == true;
    }
    
    // Photos folder - authenticated active users can upload, anyone can read (for service sharing)
    match /photos/{allPaths=**} {
      allow read: if true;
      allow write: if isActiveUser();
    }
    
    // Issue photos
    match /issues/{allPaths=**} {
      allow read: if true;
      allow write: if isActiveUser();
    }
    
    // User profile photos
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Firestore Indexes (firestore.indexes.json)

Recommended indexes for optimized queries:

| Collection | Fields |
|------------|--------|
| cleanServices | `date` ASC, `status` ASC |
| cleanServices | `assignedCleaners` ASC, `date` ASC |
| cleanServices | `propertyId` ASC, `date` ASC |
| issues | `status` ASC, `createdAt` DESC |
| photos | `serviceId` ASC, `uploadedAt` DESC |

## IAM Permissions for CLI Deployment

To deploy rules via Firebase CLI, the service account needs these roles:
- `roles/serviceusage.serviceUsageConsumer`
- `roles/firebaserules.admin`
- `roles/firestore.admin`
- `roles/firebaseadmin.admin`

Apply at: https://console.developers.google.com/iam-admin/iam?project=messier-mavuja