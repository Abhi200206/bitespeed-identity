import express from 'express';
import identifyRoute from './routes/identify';

const app = express();
app.use(express.json());
app.use('/identify', identifyRoute);
export default app;
