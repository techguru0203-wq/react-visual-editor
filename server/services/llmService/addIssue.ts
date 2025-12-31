import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { IAddIssueInput } from '../../routes/types/entityType';
import { createStructuredOutputChainFromZod } from 'langchain/chains/openai_functions';
import { EpicSchema } from '../../types/schedulingSchema';
import { Epic } from '../../types/schedulingTypes';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';

const issueTemplate = `The JSON file below describes a project with epics, stories and tasks. Please add a new story with the name of "{name}" to the epic with key "{parentIssueKey}". Further break down the story to frontend or backend tasks, estimate their story point, set the "sprintKey" of the newly added tasks to "{sprintKey}", and add them as children for the story. 

"""
JSON: {epicJson}
"""

Please only return the updated JSON file.

`;

const issuePrompt = new PromptTemplate({
  template: issueTemplate,
  inputVariables: ['name', 'parentIssueKey', 'sprintKey', 'epicJson'],
});

// const issuesChain = new LLMChain({
//   llm: new ChatOpenAI({ modelName: 'gpt-3.5-turbo', temperature: 0 }),
//   prompt: issuePrompt,
//   outputKey: 'epic',
//   verbose: true,
// });

const issuesChain = createStructuredOutputChainFromZod(EpicSchema, {
  prompt: issuePrompt,
  llm: new ChatOpenAI({ modelName: 'gpt-4-1106-preview', temperature: 0, verbose: ENABLE_LLM_LOGGING }),
  outputKey: 'epic',
});

// Run is a convenience method for chains with prompts that require one input and one output.
export async function addIssue(
  issue: IAddIssueInput,
  epics: Epic[]
): Promise<Epic[] | undefined> {
  // return new Date().toLocaleTimeString();
  let { name, parentIssueKey, sprintKey = '' } = issue;
  let result;
  let targetEpic = epics.find((e: any) => e.key === parentIssueKey);
  let targetEpicIndex = epics.findIndex((e: any) => e === targetEpic);
  console.log(
    'in services.llmService.addIssue.start:',
    issue,
    epics,
    targetEpic
  );

  try {
    result = await issuesChain.call({
      name,
      parentIssueKey,
      sprintKey,
      epicJson: JSON.stringify(targetEpic),
    });
    // result = { epic: NewEpicData };
  } catch (err) {
    console.error('services.llmService.addIssue:', err);
  }
  console.log(
    'in services.llmService.addIssue.result:',
    JSON.stringify(result)
  );
  epics[targetEpicIndex] = result?.epic as Epic;
  return epics;
}
