import { Router, Request, Response } from 'express';
import { createAIService } from '../services/aiService';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /speech/transcribe
 * Transcribe audio file to text
 */
router.post(
  '/transcribe',
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Audio file is required',
        });
      }

      const { language, prompt } = req.body;
      const aiService = createAIService();

      // Get appLink from server-side detection
      const appLink =
        req.get('Referer') ||
        req.get('Origin') ||
        `${req.protocol}://${req.get('host')}`;

      const text = await aiService.speechToText(req.file.buffer, {
        language,
        prompt,
        appLink,
      });

      res.json({
        success: true,
        text,
      });
    } catch (error) {
      console.error('Speech transcription error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  }
);

export default router;

