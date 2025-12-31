import path from 'path';
import { getClaudeSonnetResponse, renderTemplate } from './ai_utils';
import { HumanMessage } from '@langchain/core/messages';

export async function refineDocument(
  userInput: string,
  selection: string,
  paragraphBefore: string,
  paragraphAfter: string,
  callBackFunc: (output: any) => void
): Promise<string> {
  const prompt = await renderDocumentRefinementPrompt(
    userInput,
    selection,
    paragraphBefore,
    paragraphAfter
  );

  return await getClaudeSonnetResponse(
    [new HumanMessage(prompt)],
    callBackFunc
  );
}

async function renderDocumentRefinementPrompt(
  userInput: string,
  selection: string,
  paragraphBefore: string,
  paragraphAfter: string
): Promise<string> {
  const templatePath = path.join(
    __dirname,
    'prompts',
    'document_refinement.txt'
  );

  return await renderTemplate(templatePath, {
    userInput: userInput,
    selection: selection,
    paragraphBefore: paragraphBefore,
    paragraphAfter: paragraphAfter,
  });
}
