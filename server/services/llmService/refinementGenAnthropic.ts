import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import { processLLMEndCallback } from './llmUtil';
import { ACTIVE_CLAUDE_MODEL_ID } from './uiux/ai_utils';
import { refineDocument } from './uiux/document_refinement';

export interface RefinementGenInput {
  paragraphBefore: string;
  paragraphAfter: string;
  userInput: string;
  selection: string;
}

export async function genRefinementAnthropic(
  docData: RefinementGenInput,
  currentUser: AuthenticatedUserWithProfile
) {
  console.log(
    'in services.llm.genDocumentRefinementAnthropic.start:',
    currentUser
  );
  const { paragraphAfter, paragraphBefore, userInput, selection } = docData;

  let result = '';

  let callBackFunc = async (output: any) => {
    processLLMEndCallback(output, ACTIVE_CLAUDE_MODEL_ID, {
      currentUser,
      streamingMode: true,
    });
  };

  try {
    console.log(
      'in services.llm.genDocumentRefinementAnthropic: designHTML exists'
    );
    result = await refineDocument(
      userInput,
      selection,
      paragraphBefore,
      paragraphAfter,
      callBackFunc
    );
  } catch (err) {
    console.error('services.llm.genDocumentRefinementAnthropic.run:', err);
  }

  console.log('in services.llm.genDocumentRefinementAnthropic.result:', result);

  return result;
}
