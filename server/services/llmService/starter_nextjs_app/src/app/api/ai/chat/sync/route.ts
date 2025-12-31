import { NextRequest, NextResponse } from 'next/server';
import { createAIService } from '../../../../../lib/services/aiService';

export async function POST(request: NextRequest) {
  try {
    const { message, systemPrompt } = await request.json();

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message is required',
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

    const response = await aiService.chat(message, systemPrompt, appLink);

    return NextResponse.json({
      success: true,
      data: {
        message: response,
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
