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
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, '[]');
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Vérifier si l'email existe déjà
    const users = getUsers();
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Cet email est déjà utilisé' },
        { status: 400 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    // Créer la session (cookie)
    const sessionData = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
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
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
    });
  } catch (error) {
    console.error('Erreur register:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
