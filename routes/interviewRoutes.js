const express = require('express');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getInterviewQuota,
  startInterview,
  listInterviews,
  getInterview,
  submitAnswer
} = require('../controllers/interviewController');

const audioMimeTypes = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'video/webm'
];

const storage = multer.memoryStorage();

const audioUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (audioMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Please record using your microphone.'), false);
    }
  }
}).single('audio');

const uploadMiddleware = (req, res, next) => {
  audioUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

router.use(verifyToken);

router.get('/quota', getInterviewQuota);
router.post('/start', startInterview);
router.get('/', listInterviews);
router.get('/:id', getInterview);
router.post('/:id/answer', uploadMiddleware, submitAnswer);

module.exports = router;
