import { NextRequest, NextResponse } from 'next/server';
import { createAIService } from '../../../../../lib/services/aiService';

export async function POST(request: NextRequest) {
  try {
    const { messages, model } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Messages array is required',
        },
        { status: 400 }
      );
    }

    const aiService = createAIService();

    // Get appLink from request headers
    const appLink =
      request.headers.get('referer') ||
      request.headers.get('origin') ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const response = await aiService.chatCompletion({
      messages,
      model,
      appLink,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Chat completion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
