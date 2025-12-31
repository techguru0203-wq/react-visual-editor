import { RunnableSequence } from '@langchain/core/runnables';
import { RedisCache } from '@langchain/community/caches/ioredis';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RedisSingleton } from '../redis/redis';
import { ChatOpenAI } from '@langchain/openai';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { processLLMEndCallback } from './llmUtil';
import fs from 'fs';
import path from 'path';
import {
  ACTIVE_OPENAI_MODEL_ID_DEV,
  ACTIVE_OPENAI_MODEL_ID_PROD,
} from './uiux/ai_utils';

const refinementTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/textRefinementGenPrompt.txt'
);
const refinementTemplate = fs.readFileSync(refinementTemplatePath, 'utf-8');
const refinementPrompt = PromptTemplate.fromTemplate(refinementTemplate);

export interface RefinementGenInput {
  paragraphBefore: string;
  paragraphAfter: string;
  userInput: string;
  selection: string;
  docId?: string;
}

export async function genRefinement(
  docData: RefinementGenInput,
  currentUser: AuthenticatedUserWithProfile
) {
  let result = '';
  const { paragraphAfter, paragraphBefore, userInput, selection, docId } =
    docData;

  console.log('in services.llm.refinementGen.start:', selection);

  const refinementChain = RunnableSequence.from([
    {
      paragraphBefore: (input: RefinementGenInput) => input.paragraphBefore,
      selection: (input: RefinementGenInput) => input.selection,
      userInput: (input: RefinementGenInput) => input.userInput,
      paragraphAfter: (input: RefinementGenInput) => input.paragraphAfter,
    },
    refinementPrompt,
    new ChatOpenAI({
      // temperature: 0,
      modelName:
        process.env.NODE_ENV === 'development'
          ? ACTIVE_OPENAI_MODEL_ID_DEV
          : ACTIVE_OPENAI_MODEL_ID_PROD,
      maxTokens: -1,
      cache: new RedisCache(RedisSingleton.getClient()) as any,
      callbacks: [
        {
          handleLLMEnd: async (output) => {
            processLLMEndCallback(
              output.llmOutput,
              ACTIVE_OPENAI_MODEL_ID_DEV,
              {
                currentUser,
                docId,
              }
            );
          },
        },
      ],
    }),
    new StringOutputParser(),
  ]);

  try {
    result = await refinementChain.invoke({
      paragraphBefore,
      selection,
      userInput,
      paragraphAfter,
    });
  } catch (err) {
    console.error('services.llm.refinementGen.run:', err);
  }
  console.log('in services.llm.refinementGen.result:', result);
  return result;
}
