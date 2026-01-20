import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

function getUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    // Chercher l'utilisateur
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Créer la session (cookie)
    const sessionData = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const cookieStore = await cookies();
    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Erreur login:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
