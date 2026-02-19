# User Authentication Setup for Keystone Web

## Overview
This PR integrates Supabase Authentication into Keystone Web, allowing users to:
- Create accounts with email/password
- Own and manage their created sites
- Sign out and protect their data

## Changes Made

### 1. Auth Context (`lib/auth/context.tsx`)
- Created `AuthProvider` component to manage global auth state
- Provides `useAuth()` hook with:
  - `user`: Current authenticated user (or null)
  - `session`: Current session object
  - `loading`: Whether auth is initializing
  - `signUp()`: Create new account
  - `signIn()`: Log in existing user
  - `signOut()`: Sign out current user

### 2. Root Layout Update (`app/(app)/layout.tsx`)
- Wrapped app with `<AuthProvider>` to enable auth context throughout
- Updated metadata to reflect Keystone branding

### 3. Real Sign-Up Modal (`app/components/SignUpModal.tsx`)
- Replaced placeholder form with functional component
- Handles email validation and password strength (min 6 chars)
- Uses Supabase Auth API directly
- Shows loading state and error messages
- Calls `onSuccess()` callback after successful sign-up

### 4. Design Editor Updates (`app/(app)/design/[siteId]/page.tsx`)
- Integrated `useAuth()` hook
- Shows sign-in status with user email
- Only shows sign-up modal if user is not authenticated
- Saves userId when design is updated
- Shows success message after save

### 5. Header Updates (`app/components/Header.tsx`)
- Shows user email when authenticated
- Displays "Sign Out" button instead of "Get Started" for logged-in users
- Mobile menu includes sign-out option

## How It Works

### Sign-Up Flow
1. User creates site and clicks "Save Design"
2. If not authenticated → Sign-Up modal appears
3. User enters email + password + business name
4. Submit → `signUp(email, password)` called
5. Supabase creates auth user
6. Auth state updates globally
7. Modal closes, design is saved with `userId`

### Sign-In (Future)
In the next phase, we'll add a Sign-In modal for returning users.

### Sign-Out
Click "Sign Out" in header → User is logged out, session cleared.

## Testing Locally

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Create a Test Account
- Go to http://localhost:3000/onboarding
- Complete the 3-step flow to create a site
- Click "Save Design"
- In the sign-up modal:
  - Email: `test@example.com`
  - Password: `password123`
  - Business Name: `Test Business`
- Click "Create Account & Save"

### 3. Verify in Supabase
Go to your Supabase dashboard:
- **Authentication** → **Users**
  - You should see your new user with email `test@example.com`
- **Table Editor** → **sites**
  - Your site should now have a `user_id` (not NULL)

### 4. Sign Out & Sign Back In
- Click "Sign Out" in header (top right)
- The "Sign Out" button disappears, "Get Started" returns
- Go back to `/design/[siteId]` to verify you're logged out

## Environment Setup

Your `.env.local` needs:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

These are already set if you completed PR #18 setup.

## Security Considerations

### Current State
- Auth tokens handled entirely by Supabase (secure)
- `userId` is sent from client on design saves
- **Future**: Add server-side verification (RLS policies)

### Next Steps (PR #20)
- Enable Row-Level Security (RLS) policies on `sites` table
- Verify `userId` from JWT token on server-side
- Only allow users to modify their own sites
- Add role-based access control if needed

## API Changes

### PATCH `/api/sites` (Updated)
Now accepts optional `userId` from request body:
```json
{
  "siteId": "uuid",
  "designData": { ... },
  "userId": "user-uuid" // Optional, will be from auth token in future
}
```

### POST `/api/sites` (Ready for Update)
Next PR will update to automatically capture `userId` from Supabase JWT.

## Known Limitations

1. **No Sign-In UI Yet** - Users can only create new accounts
   - Add a sign-in modal in PR #20

2. **No Email Verification** - Users are auto-confirmed
   - Consider adding email verification in production

3. **No Password Reset** - Users can't reset if forgotten
   - Add password reset flow in PR #20

4. **Client-Side userId** - Not verified server-side yet
   - RLS policies will enforce this in PR #20

## Next Steps

### PR #20: Enhanced Design Customization + RLS
- [ ] Enable RLS policies on sites table
- [ ] Add server-side userId verification
- [ ] Add color picker to design editor
- [ ] Add font selector
- [ ] Add section editor (hero, about, features, footer)

### PR #21: Sign-In UI
- [ ] Create sign-in modal
- [ ] Add "Forgot Password?" flow
- [ ] Add email verification (optional)

### PR #22: Payment System
- [ ] Stripe integration
- [ ] Subscription tiers
- [ ] Payment method storage

## Files Changed
- `lib/auth/context.tsx` (new)
- `app/components/SignUpModal.tsx` (refactored)
- `app/(app)/design/[siteId]/page.tsx` (updated for auth)
- `app/components/Header.tsx` (added sign-out)
- `app/(app)/layout.tsx` (added AuthProvider)
- `AUTH_SETUP.md` (this file)
