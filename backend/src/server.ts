import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from devoq-ai API!' });
});

app.listen(PORT, () => {
  console.log(`devoq-ai backend running on port ${PORT}`);
});
