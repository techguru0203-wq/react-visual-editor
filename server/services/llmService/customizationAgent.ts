import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { RedisCache } from '@langchain/community/caches/ioredis';

import { RedisSingleton } from '../redis/redis';
import { processLLMEndCallback } from './llmUtil';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';
import {
  ACTIVE_OPENAI_MODEL_ID_DEV,
  ACTIVE_OPENAI_MODEL_ID_PROD,
} from './uiux/ai_utils';

interface ImageStyleInput {
  imageInput: string; // base64 or URL
}

export async function extractStyleFromImage(
  imageInput: string,
  currentUser: AuthenticatedUserWithProfile,
  docId?: string,
  docType?: string
): Promise<string> {
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_OPENAI_MODEL_ID_DEV
      : ACTIVE_OPENAI_MODEL_ID_PROD;

  const model = new ChatOpenAI({
    modelName: modelName,
    temperature: 0,
    maxTokens: 2048, // Set a reasonable token limit
    verbose: ENABLE_LLM_LOGGING,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          console.log('in extractStyleFromImage.callback:', output);
          if (docId && docType) {
            processLLMEndCallback(output.llmOutput, modelName, {
              currentUser,
              docId,
              docType,
            });
          }
        },
      },
    ],
  });

  try {
    const result = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageInput,
            },
          },
          {
            type: 'text',
            text: `
You are a UI design assistant analyzing a web UI screenshot or mockup.
Describe the **overall visual style** in a concise and structured format.

Summarize key features using short bullet points or compact natural language. Prioritize clarity and brevity.

Focus on:

1. **Color Palette**: Primary, background, text, accent colors (HSL if clear)
2. **Typography**: Fonts, sizes, weights, alignment
3. **Shapes & Borders**: Border radius, outlines, shadows
4. **Layout**: Flex/grid/single column, alignment, spacing
5. **Hierarchy**: Key sections (header, sidebar, cards, etc.)
6. **Background & Effects**: Gradients, flat colors, shadows, glassmorphism
7. **Tone**: Overall feel (minimalist, playful, professional, etc.)

Avoid HTML/CSS/JSON. Limit to 5–8 sentences total. Do not include keywords like header or button text.

`,
          },
        ],
      }),
    ]);

    const content = result.content?.toString() ?? '';
    console.log('extractStyleFromImage result:', content);
    return content;
  } catch (err) {
    console.error('extractStyleFromImage error:', err);
    return '';
  }
}

export async function extractDetailStyleFromImage(
  imageInput: string,
  currentUser: AuthenticatedUserWithProfile,
  docId?: string,
  docType?: string
): Promise<string> {
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_OPENAI_MODEL_ID_DEV
      : ACTIVE_OPENAI_MODEL_ID_PROD;

  const model = new ChatOpenAI({
    modelName: modelName,
    temperature: 0,
    maxTokens: 2048, // Set a reasonable token limit
    verbose: ENABLE_LLM_LOGGING,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          console.log('in extractDetialStyleFromImage.callback:', output);
          if (docId && docType) {
            processLLMEndCallback(output.llmOutput, modelName, {
              currentUser,
              docId,
              docType,
            });
          }
        },
      },
    ],
  });

  try {
    const result = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageInput,
            },
          },
          {
            type: 'text',
            text: `
You are a UI design assistant.

You should analyze and understand the detailed visual content. Pay close attention to every detail of the design including:
  1.backgrounds,
  2.gradients,
  3.spacing,
  4.the overall color scheme,
  5.the position of the elements,
  6.the relative spatial relationships between elements,
  7.the size of the elements,
  8.the color of the elements,
  9.the font of the elements,
  10.the border of the elements,
  11.the shadow of the elements,
  12.the gradient of the elements,
  13.the glassmorphism of the elements, etc.
  14. Layout structure: single section, 2-section or 3-section, left side panel, main content area and right side panel.

COMPONENT INVENTORY:
List every distinct UI component visible:
  • Navigation: Top navbar, bottom nav bar, breadcrumbs, tabs, side menu
  • Interactive Elements: Buttons (primary, secondary, ghost, icon-only), links, chips/tags, toggles, switches
  • Input Controls: Text inputs, dropdowns, date pickers, search bars, filters
  • Data Display: Cards, tables, lists, grids, badges, avatars, progress bars
  • Content: Images, icons, illustrations, charts, calendars, timelines
  • Feedback: Modals, tooltips, notifications, loading states, empty states

FEATURES:
Document the visible features and functionality:
  • What UI elements and components are present
  • What data or content is being displayed
  • What user actions appear to be available (based on buttons, forms, inputs visible)
  • What sections or pages are shown
  • What information hierarchy is presented

Return your analysis in clear, structured sections. Be extremely detailed about colors (provide HSL codes if visible), spacing values, and component relationships. Aim for a description detailed enough that a developer could recreate the design pixel-perfectly without seeing the original image.

Avoid outputting HTML/CSS/JSON code - focus on detailed visual and functional description. Limit to 150 sentences total.

`,
          },
        ],
      }),
    ]);

    const content = result.content?.toString() ?? '';
    console.log('extractStyleFromImage result:', content);
    return content;
  } catch (err) {
    console.error('extractStyleFromImage error:', err);
    return '';
  }
}

export async function generateStylePreview(
  styleInput: string,
  currentUser: AuthenticatedUserWithProfile,
  docId?: string,
  docType?: string
): Promise<string> {
  const modelName =
    process.env.NODE_ENV === 'development'
      ? ACTIVE_OPENAI_MODEL_ID_DEV
      : ACTIVE_OPENAI_MODEL_ID_PROD;
  const model = new ChatOpenAI({
    modelName: modelName,
    maxTokens: 5000, // Set a reasonable token limit
    verbose: ENABLE_LLM_LOGGING,
    cache: new RedisCache(RedisSingleton.getClient()) as any,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          // LLM callback logging removed - enable ENABLE_LLM_LOGGING for verbose logs
          if (docId && docType) {
            processLLMEndCallback(output.llmOutput, modelName, {
              currentUser,
              docId,
              docType,
            });
          }
        },
      },
    ],
  });

  try {
    const result = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: 'text',
            text: styleInput,
          },
          {
            type: 'text',
            text: `
Write a **self-contained** HTML page that demonstrates the design style described in the previous step.

- Use inline <style> for all CSS.
- Do not reference external files.
- Use clean, minimal HTML with a header, a content card, and a button.
- The style should match the previous description (colors, fonts, border radius, etc.).
- Return only valid HTML inside one code block like \`\`\`html ... \`\`\`

ONLY output the code block. No extra explanation.
`,
          },
        ],
      }),
    ]);

    const content = result.content?.toString() ?? '';
    console.log('generateStylePreview result:', content);
    return content;
  } catch (err) {
    console.error('generateStylePreview error:', err);
    return '';
  }
}
