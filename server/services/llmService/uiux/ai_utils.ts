import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { ChatAnthropic } from '@langchain/anthropic';
import Handlebars from 'handlebars';
import {
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { ENABLE_LLM_LOGGING } from '../../../lib/constant';
import axios from 'axios';
import { ChatOpenAI } from '@langchain/openai';
import { convertToOpenAIFormat, processLLMEndCallback } from '../llmUtil';
import { AuthenticatedUserWithProfile } from '../../../types/authTypes';
import { createStreamingClaudeModel } from '../streamingUtil';
import { concat } from '@langchain/core/utils/stream';
import { RedisSingleton } from '../../redis/redis';

export const ACTIVE_CLAUDE_MODEL_ID = 'claude-sonnet-4-5-20250929';
export const ACTIVE_CLAUDE_CHEAPER_MODEL_ID = 'claude-3-5-sonnet-latest';
export const ACTIVE_OPENAI_MODEL_ID_PROD = 'gpt-4o-mini';
// export const ACTIVE_OPENAI_MODEL_ID_DEV = 'gpt-4.1-nano';
export const ACTIVE_OPENAI_MODEL_ID_DEV = 'gpt-4o-mini'; //'o4-mini';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Utility function to encode image to base64
async function encodeImage(imageUrlOrPath: string): Promise<string> {
  let imageBuffer: Buffer;
  if (imageUrlOrPath.startsWith('http')) {
    const response = await axios.get(imageUrlOrPath, {
      responseType: 'arraybuffer',
    });
    imageBuffer = Buffer.from(response.data, 'binary');
  } else {
    imageBuffer = fs.readFileSync(imageUrlOrPath);
  }
  return imageBuffer.toString('base64');
}

// Utility function to get media type of the image
function getMediaType(imageUrlOrPath: string): string {
  const ext = path.extname(imageUrlOrPath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    default:
      throw new Error('Unsupported image format');
  }
}

// Function to encode the image as a data URL
async function encodeImageToDataURL(imageUrlOrPath: string): Promise<string> {
  const mediaType = getMediaType(imageUrlOrPath);
  const base64Image = await encodeImage(imageUrlOrPath);
  return `data:${mediaType};base64,${base64Image}`;
}

export async function getClaudeSonnetResponseReturnStream(
  prompt: BaseMessage[],
  callbackFunc: (output: any) => void
): Promise<AsyncIterable<AIMessageChunk>> {
  // Create model using shared utility
  const model = createStreamingClaudeModel(
    {
      modelName: ACTIVE_CLAUDE_MODEL_ID,
      maxTokens: 40_000,
    },
    {
      onLLMEnd: callbackFunc,
    }
  );

  try {
    const openAIFormattedMessages = convertToOpenAIFormat(prompt);
    const stream = await model.stream(openAIFormattedMessages);
    return stream;
  } catch (error) {
    console.error('Error in getClaudeSonnetResponse:', error);
    throw new Error('Failed to get response from LangChain API');
  }
}

export async function getClaudeSonnetResponse(
  prompt: BaseMessage[],
  callbackFunc: (output: any) => void
): Promise<string> {
  // Create model using shared utility
  const model = createStreamingClaudeModel(
    {
      modelName: ACTIVE_CLAUDE_MODEL_ID,
      maxTokens: 40_000,
    },
    {
      onLLMEnd: callbackFunc,
    }
  );

  try {
    const openAIFormattedMessages = convertToOpenAIFormat(prompt);
    const stream = await model.stream(openAIFormattedMessages);
    // Collect the response
    let aiMsg = '';
    for await (const chunk of stream) {
      aiMsg += chunk.content;
    }
    return aiMsg;
  } catch (error) {
    console.error('Error in getClaudeSonnetResponse:', error);
    throw new Error('Failed to get response from LangChain API');
  }
}

export async function getClaude35SonnetResponseWithImageInputReturnStream(
  textPrompt: string,
  base64ImageURL: string,
  callbackFunc: (output: any) => void
): Promise<AsyncIterable<AIMessageChunk>> {
  // Instantiate the ChatAnthropic model
  const model = new ChatAnthropic({
    model: ACTIVE_CLAUDE_MODEL_ID,
    maxTokens: 4096,
    temperature: 0,
    verbose: ENABLE_LLM_LOGGING,
    clientOptions: {
      defaultHeaders: {
        'X-Api-Key': process.env.ANTHROPIC_API_KEY as string,
      },
    },
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          callbackFunc(output.llmOutput);
        },
      },
    ],
  });

  try {
    // Construct the message with text and image
    const message = new HumanMessage({
      content: [
        {
          type: 'text',
          text: textPrompt,
        },
        {
          type: 'image_url',
          image_url: {
            url: base64ImageURL,
          },
        },
      ],
    });

    // Invoke the model with the message
    const stream = await model.stream([message]);

    return stream;
  } catch (error) {
    console.error(
      'Error in getClaude35SonnetResponseWithImageInput:',
      base64ImageURL
    );
    console.error(error);
    throw new Error('Failed to get response from LangChain API');
  }
}

export async function getClaude35SonnetResponseWithImageInput(
  textPrompt: string,
  base64ImageURL: string,
  callbackFunc: (output: any) => void
): Promise<string> {
  // Instantiate the ChatAnthropic model
  const model = new ChatAnthropic({
    model: ACTIVE_CLAUDE_MODEL_ID,
    maxTokens: 4096,
    temperature: 0,
    verbose: ENABLE_LLM_LOGGING,
    clientOptions: {
      defaultHeaders: {
        'X-Api-Key': process.env.ANTHROPIC_API_KEY as string,
      },
    },
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          callbackFunc(output.llmOutput);
        },
      },
    ],
  });

  try {
    // Construct the message with text and image
    const message = new HumanMessage({
      content: [
        {
          type: 'text',
          text: textPrompt,
        },
        {
          type: 'image_url',
          image_url: {
            url: base64ImageURL,
          },
        },
      ],
    });

    // Invoke the model with the message
    const response = await model.invoke([message]);

    // Check and return the response content
    if (response && response.content) {
      return String(response.content);
    } else {
      throw new Error('Unexpected response structure from LangChain API');
    }
  } catch (error) {
    console.error(
      'Error in getClaude35SonnetResponseWithImageInput:',
      base64ImageURL
    );
    console.error(error);
    throw new Error('Failed to get response from LangChain API');
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readFromTextFile(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8');
}

export function getFn(filePath: string, includeExtension = false): string {
  if (includeExtension) {
    return path.basename(filePath);
  } else {
    return path.basename(filePath, path.extname(filePath));
  }
}

export function checkCreateDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function renderTemplate(
  templatePath: string,
  data: any
): Promise<string> {
  try {
    const templateContent = await readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    return template(data);
  } catch (error) {
    console.error(`Error reading or rendering template ${templatePath}:`);
    console.error(error);
    throw error;
  }
}

export async function chatAIMessage(
  content: string,
  currentUser: AuthenticatedUserWithProfile
): Promise<any> {
  const model = new ChatOpenAI({
    modelName: ACTIVE_OPENAI_MODEL_ID_DEV,
    // temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          processLLMEndCallback(output.llmOutput, ACTIVE_OPENAI_MODEL_ID_DEV, {
            currentUser,
            docId: '',
            docType: 'orgInfoUpdate',
          });
        },
      },
    ],
  });
  // Convert to OpenAI format as required by the new version
  const messages = convertToOpenAIFormat([new HumanMessage({ content })]);
  return await model.invoke(messages);
}

export async function processStream(
  stream: AsyncIterable<AIMessageChunk>,
  onChunk?: (chunk: string) => void,
  stopKey?: string
): Promise<{ content: string; wasStopped: boolean }> {
  let accumulatedContent = '';
  let wasStopped = false;

  for await (const chunk of stream) {
    // Check if user stopped generation
    if (stopKey) {
      const stopSignal = await RedisSingleton.getData(stopKey);
      if (stopSignal === 'true') {
        console.log('User stopped generation, breaking stream processing');
        wasStopped = true;
        break;
      }
    }

    if (chunk && typeof chunk === 'object' && 'text' in chunk) {
      const content = chunk.text;
      accumulatedContent += content;

      if (onChunk) {
        console.log('content:', content);
        onChunk(
          JSON.stringify({
            text: {
              content: content,
            },
          })
        );
      }
    }
  }

  // Clear stop signal if it was set
  if (wasStopped && stopKey) {
    await RedisSingleton.clearData(stopKey);
    console.log('Cleared stop signal for:', stopKey);
  }

  return { content: accumulatedContent, wasStopped };
}

export async function processStreamJSON(
  stream: AsyncIterable<AIMessageChunk>,
  onProgress?: (message: string) => void
): Promise<string> {
  let buffer = '';
  const files: { path: string; content: string }[] = [];

  for await (const chunk of stream) {
    buffer += chunk.content;

    while (true) {
      const fileMatch = buffer.match(/FILE:\s*([^\n]+)/);
      if (!fileMatch) break;

      const endFileIndex = buffer.indexOf('ENDFILE', fileMatch.index);
      if (endFileIndex === -1) break;

      const filePath = fileMatch[1].trim();
      const contentStart = buffer.indexOf('\n', fileMatch.index) + 1;
      const content = buffer.slice(contentStart, endFileIndex).trim();

      files.push({ path: filePath, content });

      if (onProgress) {
        onProgress(
          JSON.stringify({
            text: {
              path: filePath,
              content: content,
            },
          })
        );
      }

      buffer = buffer.slice(endFileIndex + 'ENDFILE'.length);
    }
  }

  // Handle any remaining complete file in the buffer
  const fileMatch = buffer.match(/FILE:\s*([^\n]+)/);
  if (fileMatch) {
    const endFileIndex = buffer.indexOf('ENDFILE', fileMatch.index);
    if (endFileIndex !== -1) {
      const filePath = fileMatch[1].trim();
      const contentStart = buffer.indexOf('\n', fileMatch.index) + 1;
      const content = buffer.slice(contentStart, endFileIndex).trim();
      files.push({ path: filePath, content });

      if (onProgress) {
        onProgress(
          JSON.stringify({
            text: {
              path: filePath,
              content: content,
            },
          })
        );
      }
    }
  }

  return JSON.stringify({ files });
}

type StreamEvent =
  | { type: 'content'; text: string }
  | { type: 'tool_call'; toolCall: any; summary: string }
  | { type: 'additional_kwargs'; data: any }
  | { type: 'response_metadata'; data: any };

export async function* processStreamJsonWithToolCalling(
  stream: AsyncIterable<AIMessageChunk>
): AsyncGenerator<StreamEvent> {
  let gathered: AIMessageChunk | undefined;
  let partialText = '';

  for await (const chunk of stream) {
    gathered = gathered !== undefined ? concat(gathered, chunk) : chunk;

    // Accumulate content as it streams
    let deltaText = '';
    if (Array.isArray(chunk.content)) {
      for (const item of chunk.content) {
        if (item.type === 'text') {
          deltaText += item.text;
        }
      }
    } else if (typeof chunk.content === 'string') {
      deltaText = chunk.content;
    }

    if (deltaText) {
      partialText += deltaText;
      yield { type: 'content', text: partialText };
    }
  }

  // Yield tool calls with automatic stringification fix
  for (const toolCall of gathered?.tool_calls || []) {
    let parsedArgs: any = toolCall.args ?? {};

    // Handle case where the entire args field is a string
    if (typeof toolCall.args === 'string') {
      try {
        let currentData: any = toolCall.args;
        let parseAttempts = 0;
        const maxParseAttempts = 10;

        // Keep parsing until we get a non-string result
        while (
          typeof currentData === 'string' &&
          parseAttempts < maxParseAttempts
        ) {
          try {
            currentData = JSON.parse(currentData);
            parseAttempts++;
          } catch (parseError) {
            console.warn(
              `Failed to parse stringified tool args after ${parseAttempts} attempts:`,
              parseError
            );
            break;
          }
        }

        if (typeof currentData === 'object' && currentData !== null) {
          parsedArgs = currentData;
          console.log(
            `Successfully parsed tool args after ${parseAttempts} parse attempts`
          );
        } else {
          console.warn(
            'Failed to parse stringified tool args to object after multiple attempts'
          );
        }
      } catch (error) {
        console.warn('Failed to parse stringified tool args:', error);
      }
    }

    // Fix stringified arguments for write_files or plan_files tool specifically
    if (
      (toolCall.name === 'write_files' || toolCall.name === 'plan_files') &&
      typeof parsedArgs === 'string'
    ) {
      try {
        let currentData: any = parsedArgs;
        let parseAttempts = 0;
        const maxParseAttempts = 10; // Increased to handle deeply nested stringification

        // Keep parsing until we get a non-string result
        while (
          typeof currentData === 'string' &&
          parseAttempts < maxParseAttempts
        ) {
          try {
            currentData = JSON.parse(currentData);
            parseAttempts++;
          } catch (parseError) {
            // If we can't parse anymore, break out of the loop
            console.warn(
              `Failed to parse stringified write_files args after ${parseAttempts} attempts:`,
              parseError
            );
            break;
          }
        }

        if (typeof currentData === 'object' && currentData !== null) {
          parsedArgs = currentData;
          console.log(
            `Successfully parsed write_files args after ${parseAttempts} parse attempts`
          );
        } else {
          console.warn(
            'Failed to parse stringified write_files args to object after multiple attempts'
          );
        }
      } catch (error) {
        console.warn('Failed to parse stringified write_files args:', error);
      }
    }

    // Additional fix: if files is a string, try to parse it recursively
    if (
      (toolCall.name === 'write_files' || toolCall.name === 'plan_files') &&
      parsedArgs.files &&
      typeof parsedArgs.files === 'string'
    ) {
      try {
        let currentFiles = parsedArgs.files;
        let parseAttempts = 0;
        const maxParseAttempts = 10; // Handle deeply nested stringification

        // Keep parsing until we get a non-string result
        while (
          typeof currentFiles === 'string' &&
          parseAttempts < maxParseAttempts
        ) {
          try {
            currentFiles = JSON.parse(currentFiles);
            parseAttempts++;
          } catch (parseError) {
            console.warn(
              `Failed to parse stringified files array after ${parseAttempts} attempts:`,
              parseError
            );
            break;
          }
        }

        if (Array.isArray(currentFiles)) {
          parsedArgs.files = currentFiles;
          console.log(
            `Successfully parsed files array after ${parseAttempts} parse attempts`
          );
        } else {
          console.warn(
            'Failed to parse stringified files array to array after multiple attempts'
          );
        }
      } catch (error) {
        console.warn('Failed to parse stringified files array:', error);
      }
    }

    yield {
      type: 'tool_call',
      toolCall: {
        name: toolCall.name,
        id: toolCall.id,
        args: parsedArgs,
        type: 'tool_call',
      },
      summary: `Tool call: ${toolCall.name} with args ${JSON.stringify(
        parsedArgs
      )}`,
    };
  }

  // Yield additional metadata fields if they exist
  if (gathered?.additional_kwargs) {
    yield {
      type: 'additional_kwargs',
      data: gathered.additional_kwargs,
    };
  }

  if (gathered?.response_metadata) {
    yield {
      type: 'response_metadata',
      data: gathered.response_metadata,
    };
  }
}
