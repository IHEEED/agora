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

app.use(cors());
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
