import { NextRequest, NextResponse } from 'next/server';
import { createAIService } from '../../../../../lib/services/aiService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Audio file is required',
        },
        { status: 400 }
      );
    }

    const language = formData.get('language') as string | undefined;
    const prompt = formData.get('prompt') as string | undefined;

    const aiService = createAIService();

    // Get appLink from request headers
    const appLink =
      request.headers.get('referer') ||
      request.headers.get('origin') ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const text = await aiService.speechToText(audioFile, {
      language,
      prompt,
      appLink,
    });

    return NextResponse.json({
      success: true,
      text,
    });
  } catch (error) {
    console.error('Speech transcription error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

