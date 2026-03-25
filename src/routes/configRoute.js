import express from 'express';
const configRouter = express.Router();

let frontendURL = null;

// Receive frontend URL
configRouter.post('/update-frontend-url', (req, res) => {
  frontendURL = req.body.frontendURL;
  console.log(`Frontend URL updated: ${frontendURL}`);
  res.json({ success: true, frontendURL });
});

// Optional: retrieve current frontend URL
configRouter.get('/frontend-url', (req, res) => {
  res.json({ frontendURL });
});

export default configRouter;
