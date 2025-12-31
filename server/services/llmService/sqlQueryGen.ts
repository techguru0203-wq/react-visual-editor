import { DataSource } from 'typeorm';
import { SqlDatabase } from 'langchain/sql_db';
import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';
/**
 * This example uses Chinook database, which is a sample database available for SQL Server, Oracle, MySQL, etc.
 * To set it up follow the instructions on https://database.guide/2-sample-databases-sqlite/, placing the .db file
 * in the examples folder.
 */

const datasource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const db = SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const prompt =
  PromptTemplate.fromTemplate(`Given an input question, first create a syntactically correct postgresql query to run, then look at the results of the query and return the answer.
  Use the following format:
  
  Question: {question}
  SQLQuery: "SQL Query to run"
  SQLResult: "Result of the SQLQuery"
  Answer: "Final answer here"`);

const newPrompt = new PromptTemplate({
  template: `Given an input question, first create a syntactically correct postgresql query to run, then execute the query against the database, and return the answer.
    Use the following format:
    
    Question: {question}
    SQLQuery: "SQL Query to run"
    SQLResult: "Result of the SQLQuery"
    Answer: "Final answer here"`,
  inputVariables: ['question'],
});

export async function genWeeklyStatus(input: string) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0,
    verbose: ENABLE_LLM_LOGGING,
  });

  const sqlQueryChain = RunnableSequence.from([
    {
      question: (input: { question: string }) => input.question,
    },
    newPrompt,
    llm,
    new StringOutputParser(),
  ]);
  console.log(
    'in services.llmService.sqlQueryGen.genWeeklyStatus.start:',
    input
  );
  const res = await sqlQueryChain.invoke({
    question: 'How many projects were created in last 30 days?',
  });
  console.log(res);
  return res;
}
