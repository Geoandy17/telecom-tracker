import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const user = JSON.parse(sessionCookie.value);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Erreur me:', error);
    return NextResponse.json(
      { success: false, error: 'Session invalide' },
      { status: 401 }
    );
  }
}
