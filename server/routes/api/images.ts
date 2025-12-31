import { Router } from 'express';
import { userProfileRequestHandler } from '../../lib/util';
import axios from 'axios';
import multer from 'multer';

const router = Router();
router.use(userProfileRequestHandler);

router.post('/get-external', async function (req, res) {
  console.log('in server.routes.api.images.get.start:');
  try {
    const body = req.body;
    const response = await axios.get(body.imageUrl);

    console.log(
      'in server.routes.api.images.success:',
      `image: ${response.data}, fetched successfully.`
    );

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('in server.routes.api.images.get:', error);

    res.status(500).json({
      success: false,
      errorMsg: JSON.stringify(error),
    });
  }
});

// Configure multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

module.exports = {
  className: 'images',
  routes: router,
};
