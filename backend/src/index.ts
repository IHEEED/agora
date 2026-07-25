import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import communitiesRouter from './routes/communities';
import postsRouter from './routes/posts';
import commentsRouter from './routes/comments';
import votesRouter from './routes/votes';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = ['http://localhost:3000', 'https://agora-vert-nine.vercel.app'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/communities', communitiesRouter);
app.use('/posts', postsRouter);
app.use('/comments', commentsRouter);
app.use('/votes', votesRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
