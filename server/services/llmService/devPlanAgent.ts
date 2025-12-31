import { PromptTemplate } from '@langchain/core/prompts';
import { DevPlanGenInput } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import dayjs from 'dayjs';
import { setEpicsDataKeyMapping, validateEpicData } from '../schedulingService';
import { getTaskTypeFromSpecialtyName } from '../../lib/util';
import _ from 'lodash';
import { processLLMEndCallback } from './llmUtil';
import { DevPlanSchema } from '../../types/schedulingSchema';
import { AuthenticatedUserWithProfile } from '../../types/authTypes';
import fs from 'fs';
import path from 'path';
import { SampleTask } from '../../../shared/constants';
import { ACTIVE_OPENAI_MODEL_ID_PROD } from './uiux/ai_utils';

// Read the prompt template from the file
const devPlanTemplatePath = path.resolve(
  __dirname,
  'llm_prompts/devPlanGenPrompt.txt'
);
const devPlanTemplate = fs.readFileSync(devPlanTemplatePath, 'utf-8');

export async function genDevPlan(
  docData: any,
  input: DevPlanGenInput,
  currentUser: AuthenticatedUserWithProfile
) {
  const devPlanPrompt = PromptTemplate.fromTemplate(devPlanTemplate);
  let issueData;
  let result = '';
  const {
    additionalContextFromUserFiles,
    sampleTaskStoryPoint,
    documentGenerateLang,
    ...schedulingParameters
  } = input;
  const { type: docType, id: docId, description: userFeedback } = docData;
  let taskTypes = schedulingParameters.requiredSpecialties
    .map((specialty) => {
      return getTaskTypeFromSpecialtyName(specialty);
    })
    .join(',');

  taskTypes = _.uniq(taskTypes.split(',')).join(',');

  // Build language instruction based on documentGenerateLang setting
  let languageInstruction = '';
  if (documentGenerateLang === 'zh') {
    languageInstruction =
      '\n\n**CRITICAL LANGUAGE REQUIREMENT:** The output MUST be in Chinese. All epic names, story names, task names, descriptions, and acceptance criteria must be written in Chinese, regardless of the language used in "User Feedback" or "Additional Context".';
  } else {
    languageInstruction =
      '\n\n**CRITICAL LANGUAGE REQUIREMENT:** The output MUST be in English. All epic names, story names, task names, descriptions, and acceptance criteria must be written in English, regardless of the language used in "User Feedback" or "Additional Context".';
  }

  const modelName = ACTIVE_OPENAI_MODEL_ID_PROD;
  const model = new ChatOpenAI({
    modelName,
    maxTokens: 16384, // Maximum tokens supported by the model
    // temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          processLLMEndCallback(output.llmOutput, modelName, {
            currentUser,
            docId,
            docType,
          });
        },
      },
    ],
  });

  const structuredLlm = model.withStructuredOutput(
    DevPlanSchema.pick({ epics: true }),
    {
      name: 'development_plan',
    }
  );

  try {
    console.log(
      'in services.llm.genDevPlan.start:',
      additionalContextFromUserFiles,
      ', taskTypes:',
      taskTypes,
      ', SampleTask:',
      SampleTask,
      ', sampleTaskStoryPoint:',
      sampleTaskStoryPoint,
      ', userFeedback:',
      userFeedback,
      ', documentGenerateLang:',
      documentGenerateLang
    );
    let genContentObj = await structuredLlm.invoke(
      await devPlanPrompt.format({
        additionalContextFromUserFiles,
        taskTypes,
        sampleTask: SampleTask,
        sampleTaskStoryPoint,
        userFeedback: userFeedback || '',
        languageInstruction: languageInstruction || '',
      })
    );
    issueData = genContentObj;
  } catch (err) {
    console.error('services.llm.genDevPlan.run.error:', err);
    // Re-throw the error so it can be caught by the caller
    throw err;
  }
  // append sprint planning result
  // issueData = EpicsData;
  if (!issueData || !issueData.epics) {
    console.error('services.llm.genDevPlan.run.error.no.content.generated');
    throw new Error('Dev plan generation failed: no content generated');
  }

  // Validate that we have epics
  if (!issueData.epics || issueData.epics.length === 0) {
    console.error('services.llm.genDevPlan.run.error.no.epics.generated');
    throw new Error('Dev plan generation failed: no epics generated');
  }

  // Log warning if only one epic was generated (might indicate incomplete generation)
  if (issueData.epics.length === 1) {
    console.warn(
      'services.llm.genDevPlan.warning: Only one epic was generated. This might indicate that not all epics from the PRD were processed. Please verify the PRD contains multiple epics.'
    );
  }

  // Log the number of epics generated for debugging
  console.log(
    `services.llm.genDevPlan.epics.count: Generated ${issueData.epics.length} epic(s)`
  );

  setEpicsDataKeyMapping(issueData.epics);
  validateEpicData(issueData.epics);
  result = JSON.stringify({
    epics: issueData.epics,
    sprints: [],
    milestones: [],
  });
  console.log('in services.llm.genDevPlan.result:', result);
  return result;
}

const sourceMap: any = {
  value: 'sprints', // refer to milestones
  sprints: 'userStories',
  userStories: 'issues',
};
function validatePlanData(wrapperObj: any, targetKey: string): any {
  let targets = wrapperObj[targetKey] || [];
  let sourceKey = sourceMap[targetKey];
  if (!sourceKey) {
    // basecase for recursion: no more source key
    return wrapperObj;
  }
  targets.forEach((target: any) => {
    let sources = validatePlanData(target, sourceKey)[sourceKey];
    let { startDate, endDate, storyPoints } = sources.reduce(
      (result: any, source: any) => {
        return {
          startDate:
            new Date(result.startDate) > new Date(source.startDate)
              ? source.startDate
              : result.startDate,
          endDate:
            new Date(result.endDate) > new Date(source.endDate)
              ? result.endDate
              : source.endDate,
          storyPoints: result.storyPoints + source.storyPoint,
        };
      },
      {
        startDate: target.startDate,
        endDate: target.endDate,
        storyPoints: 0,
      }
    );
    target.startDate = dayjs(startDate).format('MM/DD/YYYY');
    target.endDate = dayjs(endDate).format('MM/DD/YYYY');
    target.storyPoint = storyPoints;
  });
  return wrapperObj;
}
