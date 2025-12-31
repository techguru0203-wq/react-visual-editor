import { Router } from 'express';
import { sendEmail } from '../../services/emailService';
import { chatWithKnowledgeBase } from '../../services/knowledgeSearchService';
import prisma from '../../db/prisma';
import { ChatOpenAI } from '@langchain/openai';
import { ACTIVE_OPENAI_MODEL_ID_PROD } from '../../services/llmService/uiux/ai_utils';
import { ENABLE_LLM_LOGGING } from '../../lib/constant';

const router = Router();

interface ChatRequest {
  message: string;
  email: string;
  projectName?: string;
  appLink?: string;
  chatSessionId?: string;
}

/**
 * Get the Omniflow Support knowledge base
 *
 * To set up the support knowledge base:
 * 1. Go to the Knowledge Base section in the Omniflow platform
 * 2. Create a new knowledge base named exactly "Omniflow Support"
 * 3. Upload documents with FAQs, guides, and common questions/answers
 * 4. Wait for files to be processed (status will show "COMPLETED")
 *
 * Once set up, the chatbot will automatically use this knowledge base to answer questions.
 * If the KB can't answer, it will fall back to sending an email to the support team.
 */
async function getSupportKnowledgeBase() {
  // Try to find existing support knowledge base by name
  const supportKB = await prisma.knowledgeBase.findFirst({
    where: {
      id:
        process.env.NODE_ENV === 'production'
          ? 'cmi3t606v006rt8ugg5p69vhw'
          : 'cmi3tw61d000125epr54jr1re',
      status: 'ACTIVE',
    },
  });

  if (supportKB) {
    return supportKB.id;
  }

  // If not found, return null (knowledge base needs to be created manually by admin)
  return null;
}

// Helper function to send email to support team
async function sendEmailToSupportTeam(
  email: string,
  message: string,
  aiReply: string,
  projectName?: string,
  appLink?: string
) {
  const supportEmailBody = `
New Support Request from Omniflow Platform

Customer Email: ${email}
Project Name: ${projectName || 'Not specified'}
App Link: ${appLink || 'Not specified'}

Customer Message:
${message}

AI Reply Sent to Customer:
${aiReply}

---
This message was sent from the Omniflow platform support chatbot.
  `;

  const supportEmails = ['general@omniflow.team'];

  // Send to each email separately since sendEmail takes a single email
  const emailPromises = supportEmails.map((supportEmail) =>
    sendEmail({
      email: supportEmail,
      subject: `New Support Request from ${projectName || 'Omniflow Platform'}`,
      body: supportEmailBody,
    })
  );

  const supportEmailResults = await Promise.all(emailPromises);
  const supportEmailSuccess = supportEmailResults.some(
    (result) => result?.success
  );

  if (!supportEmailSuccess) {
    console.error('Failed to send email to support team:', supportEmailResults);
  }

  return supportEmailSuccess;
}

// Support chat endpoint - public access (no authentication required)
router.post('/chat', async (req, res) => {
  try {
    const { message, email, projectName, appLink, chatSessionId } =
      req.body as ChatRequest;

    // Validate required fields
    if (!message || !email) {
      return res.status(400).json({
        success: false,
        error: 'Message and email are required',
      });
    }

    // Try to get knowledge base context if available
    let kbContext = '';
    const supportKBId = await getSupportKnowledgeBase();
    if (supportKBId) {
      try {
        const kbChatResponse = await chatWithKnowledgeBase({
          knowledgeBaseId: supportKBId,
          userMessage: message,
          userId: email,
          chatSessionId: chatSessionId || undefined,
        });
        if (kbChatResponse.sources && kbChatResponse.sources.length > 0) {
          kbContext = `\n\nRelevant information from our knowledge base:\n${kbChatResponse.sources
            .map((s, i) => `[${i + 1}] ${s.text}`)
            .join('\n\n')}`;
        }
      } catch (kbError) {
        console.error('Error querying knowledge base for context:', kbError);
        // Continue without KB context
      }
    }

    // Generate AI reply using chat service
    let aiReply = '';
    try {
      const model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: ACTIVE_OPENAI_MODEL_ID_PROD,
        temperature: 0.7,
        maxTokens: 300,
        verbose: ENABLE_LLM_LOGGING,
      });

      const systemPrompt = `You are a helpful support assistant for Omniflow. A user has sent a support message. Generate a professional, helpful, SHORT, and CONCISE reply that:
- Directly answers their question or provides helpful guidance based on the context provided
- Keeps the response brief and informative (2-3 sentences maximum)
- Maintains a friendly and professional tone
- Does NOT use emojis or special Unicode characters
- Does NOT mention that the support team has been notified
- Does NOT include phrases like "I have also notified our support team" or "they will review your message"

User's message: ${message}
${projectName ? `Project: ${projectName}` : ''}
${appLink ? `App Link: ${appLink}` : ''}
${kbContext ? kbContext : ''}

Generate a short, concise, and informative reply:`;

      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: message,
        },
      ]);

      aiReply = (response.content as string) || '';

      if (!aiReply || aiReply.trim().length === 0) {
        throw new Error('AI returned empty response');
      }

      // Remove unwanted phrases about support team notification
      aiReply = aiReply
        .replace(
          /I have also notified our support team about your question, and they will review your message for any further assistance you may need\. If you have any specific aspects of Omniflow you would like to explore further, please let me know\./gi,
          ''
        )
        .replace(
          /I have also notified our support team.*?please let me know\./gis,
          ''
        )
        .replace(/I have.*?notified.*?support team.*?review.*?message.*?/gi, '')
        .trim();
    } catch (aiError) {
      console.error('Error generating AI reply:', aiError);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate AI reply',
      });
    }

    // Send email to support team after AI reply is generated
    await sendEmailToSupportTeam(
      email,
      message,
      aiReply,
      projectName,
      appLink
    ).catch((err) => console.error('Failed to send support email:', err));

    res.json({
      success: true,
      message: aiReply,
    });
  } catch (error) {
    console.error('Error processing support chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process support request',
    });
  }
});

// Contact support agent endpoint - when user clicks "Contact Support Agent" button
router.post('/contact-agent', async (req, res) => {
  try {
    const { email, originalMessage, projectName, appLink } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Send email to support team
    const supportEmailBody = `
User Requested to Contact Support Agent

Customer Email: ${email}
Project Name: ${projectName || 'Not specified'}
App Link: ${appLink || 'Not specified'}

Original Message:
${originalMessage || 'N/A'}

---
User clicked "Contact Support Agent" button after receiving AI reply.
    `;

    await sendEmail({
      email: 'general@omniflow.team',
      subject: `Support Agent Request from ${
        projectName || 'Omniflow Platform'
      }`,
      body: supportEmailBody,
    }).catch((err) =>
      console.error('Failed to send support agent email:', err)
    );

    res.json({
      success: true,
      message:
        "Thank you for reaching out. We've received your question and will get back to you within 12 hours.",
    });
  } catch (error) {
    console.error('Error processing contact agent request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
    });
  }
});

module.exports = {
  className: 'support',
  routes: router,
};
