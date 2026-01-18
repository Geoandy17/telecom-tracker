import { NextRequest, NextResponse } from 'next/server';
import { parseExcelFile, serializeParsedData } from '@/lib/excel-parser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      // Vérifier le type de fichier
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        results.push({
          fileName: file.name,
          success: false,
          error: 'Format de fichier non supporté. Utilisez .xlsx ou .xls',
        });
        continue;
      }

      try {
        // Lire le fichier
        const buffer = await file.arrayBuffer();

        // Parser le fichier Excel
        const parsedData = parseExcelFile(buffer, file.name);

        // Sérialiser les données pour la réponse JSON
        const serializedData = serializeParsedData(parsedData);

        results.push({
          fileName: file.name,
          success: true,
          data: serializedData,
        });
      } catch (parseError) {
        console.error(`Erreur parsing ${file.name}:`, parseError);
        results.push({
          fileName: file.name,
          success: false,
          error: `Erreur lors du parsing: ${parseError instanceof Error ? parseError.message : 'Erreur inconnue'}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Erreur upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Erreur serveur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      },
      { status: 500 }
    );
  }
}

// Route segment config for Next.js App Router
export const dynamic = 'force-dynamic';
