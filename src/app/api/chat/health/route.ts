// API route for chat service health check
import { NextRequest, NextResponse } from 'next/server';

// Use the API gateway for server-side requests (set via docker-compose environment)
const CHAT_API_URL = process.env.CHAT_SERVICE_URL || 'https://api_gateway/api';

export async function GET(request: NextRequest) {
  try {
    // Check Chat Service health
    const response = await fetch(
      `${CHAT_API_URL}/chat/health`,
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
        { status: 'unhealthy', error: 'Chat service unavailable' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error checking chat service health:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
