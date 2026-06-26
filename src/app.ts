import express from 'express';
import cors from 'cors';
import path from 'path';
import publicRoutes from './routes/publicRoutes';
import adminRoutes from './routes/adminRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/admin', express.static(path.join(process.cwd(), 'admin')));
app.use(express.static(path.join(process.cwd(), 'public')));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;
