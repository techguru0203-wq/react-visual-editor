import * as fs from 'fs/promises';
import * as path from 'path';
import {
  getClaudeSonnetResponse,
  getClaudeSonnetResponseReturnStream,
  getClaude35SonnetResponseWithImageInput,
  renderTemplate,
  getClaude35SonnetResponseWithImageInputReturnStream,
} from './ai_utils';
import { AIMessageChunk, BaseMessage, HumanMessage } from '@langchain/core/messages';

interface PageInfo {
  page_name: string;
  // Add other properties as needed
}

interface PageInfos {
  pages: PageInfo[];
  // Add other properties as needed
}

async function generatePageInfos(
  prd: string,
  callBackFunc: (output: any) => void
): Promise<PageInfos> {
  const templatePath = path.join(
    __dirname,
    'prompts',
    'page_info_gen_prompt.txt'
  );

  const prompt = await renderTemplate(templatePath, { prd });

  try {
    const response = await getClaudeSonnetResponse(
      [new HumanMessage(prompt)],
      callBackFunc
    );
    const jsonMatch = response.match(/\{[\s\S]*\}\s*(?=\n|$)/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      return jsonData;
    } else {
      console.error('No JSON found:', response);
      throw 'NO JSON Found';
    }
  } catch (error) {
    console.error('Error generating page infos:', error);
    throw error;
  }
}

async function generateMainPageHtml(
  pageInfo: PageInfo,
  callbackFunc: (output: any) => void,
  pageStyle: string,
  userFeedback: string | null = null,
  refImageBase64: string | null = null,
  chatHistory: BaseMessage[] = []
): Promise<AsyncIterable<AIMessageChunk>> {
  const templatePath = path.join(
    __dirname,
    'prompts',
    'home_page_design_prompt.txt'
  );

  const prompt = await renderTemplate(templatePath, {
    page_info: JSON.stringify(pageInfo),
    page_style: pageStyle,
    user_feedback: userFeedback,
  });

  const promptWithChatHistory = [...chatHistory, new HumanMessage(prompt)];

  try {
    if (!refImageBase64) {
      return await getClaudeSonnetResponseReturnStream(promptWithChatHistory, callbackFunc);
    } else {
      return await getClaude35SonnetResponseWithImageInputReturnStream(
        prompt,
        refImageBase64,
        callbackFunc
      );
    }
  } catch (error) {
    console.error('Error generating main page HTML:');
    console.error(error);
    throw error;
  }
}

async function generateOtherPageHtml(
  pageInfo: PageInfo,
  homePageHtml: string,
  refImageBase64URL: string | null = null,
  callbackFunc: (output: any) => void,
  chatHistory: BaseMessage[] = []
): Promise<string> {
  const templatePath = path.join(
    __dirname,
    'prompts',
    'other_page_design_prompt.txt'
  );

  const prompt = await renderTemplate(templatePath, {
    page_info: JSON.stringify(pageInfo),
    home_page_html: homePageHtml,
  });

  const promptWithChatHistory = [...chatHistory, new HumanMessage(prompt)];

  try {
    if (!refImageBase64URL) {
      return await getClaudeSonnetResponse(promptWithChatHistory, callbackFunc);
    } else {
      return await getClaude35SonnetResponseWithImageInput(
        prompt,
        refImageBase64URL,
        callbackFunc
      );
    }
  } catch (error) {
    console.error('Error generating other page HTML:');
    console.error(error);
    throw error;
  }
}

export async function generatePages(
  prd: string,
  generateAllPages: boolean = false,
  userFeedback: string | null = null,
  refImageBase64URL: string | null = null,
  callbackFunc: (output: any) => void,
  chatHistory: BaseMessage[] = [],
  pageStyle: string | null = null,
  saveDir: string | null = null
): Promise<AsyncIterable<AIMessageChunk>> {
  if (!pageStyle) {
    pageStyle =
      'Color: Use a very visually appealing color palette; Ensure sufficient contrast for readability; Consider color psychology for your brand/message. Typography: Choose 2-3 complementary fonts (e.g., sans-serif for headings, serif for body); Maintain consistent font sizes and hierarchy; Ensure readability across devices. Layout: Embrace white space for clarity; Use a grid system for alignment; Prioritize mobile responsiveness. Visual elements: Use high-quality, relevant images; Incorporate icons for visual cues; Maintain consistency in style; User Experience: Prioritize intuitive navigation; Ensure fast loading times. Design for accessibility';
  }

  // Limit prd to 50000 characters
  prd = prd.substring(0, 50000) || (userFeedback as string);

  // Limit pageStyle to 10000 characters
  pageStyle = pageStyle.substring(0, 10000);

  const pagesDict: Record<string, string> = {};

  console.log('Generating page info...');
  const pageInfos = await generatePageInfos(prd, callbackFunc);
  console.log('in web_design_main.generatePages: all Page info:', pageInfos);
  const pages = pageInfos.pages;

  console.log('in web_design_main.generatePages: Generating main page...');

  const firstPageInfo = pages[0];
  const firstPageName = firstPageInfo.page_name.replace('/', '_');
  // Create a wrapper stream that will handle both first page and other pages
  return {
    [Symbol.asyncIterator]: async function* () {
      return {
        async next() {
          let firstPageHtml = '';
          const firstPageStream = await generateMainPageHtml(
            firstPageInfo,
            callbackFunc,
            pageStyle,
            userFeedback,
            refImageBase64URL,
            chatHistory
          );
          // Process first page stream
          for await (const chunk of firstPageStream) {
            if (chunk && typeof chunk === 'object' && 'text' in chunk) {
              firstPageHtml += chunk.text;
              // Yield each chunk of the first page
              return { value: chunk, done: false };
            }
          }

          // After first page is complete, generate other pages
          if (generateAllPages) {
            console.log(
              'in web_design_main.generatePages: First page content:',
              firstPageHtml
            );
            pagesDict[firstPageName] = firstPageHtml;
          
            if (generateAllPages) {
              // TODO - enable other pages generation later
              // continue to generate other pages
              for (let i = 1; i < 1; i++) {
                const pageInfo = pages[i];
                const pageName = pageInfo.page_name.replace('/', '_');
                console.log(
                  'in web_design_main.generatePages: Generating page:',
                  pageName
                );
          
                const otherPageHtml = await generateOtherPageHtml(
                  pageInfo,
                  firstPageHtml,
                  refImageBase64URL,
                  callbackFunc
                );
                pagesDict[pageName] = otherPageHtml;
          
                if (saveDir) {
                  await fs.writeFile(
                    path.join(saveDir, `${pageName}_page.html`),
                    otherPageHtml
                  );
                }
              }
            }
            return { value: undefined, done: true };
          }
        }
      }
    }
  }
}

// async function main(): Promise<void> {
//   try {
//     const curDir = __dirname; // Directory where the script is located

//     const styleFp = path.join(curDir, 'data/styles/style4.txt');
//     const styleName = path.basename(styleFp, path.extname(styleFp));
//     const designStyle = await fs.readFile(styleFp, 'utf-8');

//     const prdFp = path.join(curDir, 'data/prd/prd2.txt');
//     const prdName = path.basename(prdFp, path.extname(prdFp));
//     const prd = await fs.readFile(prdFp, 'utf-8');

//     const llmModel = 'claude';

//     const saveDir = path.join(curDir, `results/${prdName}_results_${llmModel}_${styleName}`);
//     const refImagePath = path.join(curDir, 'data/website_images/omniflow.png');
//     const refImageBase64URL = await encodeImageToDataURL(refImagePath);
//     const userFeedback = "Design the website follow the same style as uploaded image";

//     await generatePages(prd, true, userFeedback, refImageBase64URL, () => {}, designStyle, saveDir);
//   } catch (error) {
//     console.error('Error in main function:');
//     console.error(error);
//   }
// }

// main().catch(console.error);
