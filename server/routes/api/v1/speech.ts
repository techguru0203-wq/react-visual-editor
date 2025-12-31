import { Router } from 'express';
import { ApiKeyRequest } from '../../../lib/apiKeyAuth';
import { logApiUsage } from '../../../services/apiUsageService';
import { calculateCreditsFromTokens } from '../../../services/creditService';
import prisma from '../../../db/prisma';
import { GenerationMinimumCredit } from '../../../lib/constant';
import axios from 'axios';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * External API endpoint for speech-to-text transcription
 * POST /v1/speech-to-text
 *
 * Request body (multipart/form-data):
 * {
 *   "file": <audio file>, // required
 *   "model": "whisper-1", // optional, defaults to whisper-1
 *   "language": "en", // optional, ISO-639-1 language code
 *   "prompt": "...", // optional, guide the model's style
 *   "temperature": 0 // optional, 0-1
 * }
 *
 * Response:
 * {
 *   "text": "transcribed text here"
 * }
 *
 * Note: Internally uses verbose_json format to get accurate audio duration for billing
 */
router.post(
  '/speech-to-text',
  upload.single('file'),
  async (req: ApiKeyRequest, res) => {
    try {
      const {
        model = 'whisper-1',
        language,
        prompt,
        temperature = 0,
      } = req.body;

      console.log('in api/v1/speech-to-text: request received - ', req.body);
      // Validate file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'Audio file is required',
        });
      }

      // Check if organization has sufficient credits
      const organization = await prisma.organization.findUnique({
        where: { id: req.apiKey!.organizationId },
      });

      if (!organization) {
        return res.status(500).json({
          success: false,
          error: 'Organization not found',
        });
      }

      if (organization.credits < GenerationMinimumCredit) {
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          message:
            'Your organization does not have sufficient credits to make this request',
        });
      }

      const startTime = Date.now();

      console.log('in api/v1/speech-to-text: multer file - ', req.file);
      const temperatureValue =
        typeof temperature === 'number'
          ? temperature
          : parseFloat(String(temperature));

      const FormData = require('form-data');
      const formData = new FormData();

      formData.append('file', req.file.buffer, {
        filename: req.file.originalname || 'recording.webm',
        contentType: req.file.mimetype || 'audio/webm',
      });
      formData.append('model', model);

      if (language) {
        formData.append('language', language);
      }

      if (prompt) {
        formData.append('prompt', prompt);
      }

      // Always use verbose_json internally to get accurate audio duration
      formData.append('response_format', 'verbose_json');

      if (Number.isFinite(temperatureValue)) {
        formData.append('temperature', String(temperatureValue));
      }

      const { data: transcription } = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
        }
      );

      const duration = Date.now() - startTime;
      console.log('in api/v1/speech-to-text: transcription - ', transcription);

      // Get actual audio duration from verbose_json response
      const audioDurationInSeconds = transcription.duration || 0;

      // Calculate tokens based on actual audio duration (1 second ≈ 100 tokens)
      const estimatedTokens = Math.ceil(audioDurationInSeconds * 100);

      // Calculate credits used (using input tokens pricing for whisper)
      const creditsUsed = calculateCreditsFromTokens(
        0,
        estimatedTokens,
        0,
        0,
        model
      );

      // Return simple format to maintain API compatibility
      const apiResponse = {
        text: transcription.text || '',
      };

      res.json(apiResponse);

      // Log usage
      await logApiUsage({
        organizationId: req.apiKey!.organizationId,
        endpoint: '/v1/speech-to-text',
        appLink: req.body.appLink,
        requestSize: req.file.size,
        responseSize: Buffer.byteLength(JSON.stringify(apiResponse), 'utf8'),
        creditsUsed,
        statusCode: 200,
        duration,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        meta: {
          model,
          language,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          audioDurationInSeconds,
          audioDurationInMinutes,
          estimatedTokens,
        },
      });

      // Deduct credits
      await prisma.organization.update({
        where: { id: req.apiKey!.organizationId },
        data: { credits: { decrement: creditsUsed } },
      });
    } catch (error) {
      console.error('Speech-to-text error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An error occurred while processing your audio file',
      });
    }
  }
);

module.exports = {
  className: 'v1',
  routes: router,
};
