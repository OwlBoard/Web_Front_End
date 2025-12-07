// API route for chat room info
import { NextRequest, NextResponse } from 'next/server';

// Use the API gateway for server-side requests (set via docker-compose environment)
const CHAT_API_URL = process.env.CHAT_SERVICE_URL || 'https://api_gateway/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;

    // Fetch room info from Chat Service
    const response = await fetch(
      `${CHAT_API_URL}/chat/rooms/${dashboardId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch room info' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching room info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
