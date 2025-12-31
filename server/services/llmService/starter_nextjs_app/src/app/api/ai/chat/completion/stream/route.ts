import { NextRequest, NextResponse } from 'next/server';
import { createAIService } from '../../../../../../lib/services/aiService';

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

    // Set up streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of aiService.chatCompletionStream({
            messages,
            model,
            appLink: appLink,
          })) {
            const data = JSON.stringify({ content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (streamError) {
          console.error('Streaming error:', streamError);
          const errorData = JSON.stringify({ error: 'Streaming failed' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Streaming chat completion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
