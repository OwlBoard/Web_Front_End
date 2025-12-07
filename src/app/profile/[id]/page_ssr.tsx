// Server Component with SSR - Profile Page
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://api_gateway/api/users';

async function getUserData(userId: string) {
  try {
    const response = await fetch(`${USER_SERVICE_URL}/users/${userId}`, {
      cache: 'no-store', // Always fetch fresh data for SSR
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  // Get auth from cookies (server-side)
  const cookieStore = await cookies();
  const loggedUserId = cookieStore.get('user_id')?.value;

  // If no logged-in user, redirect to login
  if (!loggedUserId) {
    redirect('/login');
  }

  const profileId = params.id;

  // Fetch user data SERVER-SIDE before rendering
  const user = await getUserData(profileId);

  if (!user) {
    // User not found or error
    return (
      <div className="container mt-5">
        <div className="alert alert-danger">
          <h4>User not found</h4>
          <p>The requested user profile could not be found.</p>
          <a href="/my-boards" className="btn btn-primary">Go to My Boards</a>
        </div>
      </div>
    );
  }

  // Check if viewing own profile
  const isOwnProfile = loggedUserId === profileId;

  // Pass server-fetched data to Client Component
  return (
    <ProfileClient 
      user={user} 
      isOwnProfile={isOwnProfile}
      loggedUserId={loggedUserId}
    />
  );
}
