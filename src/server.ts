import 'dotenv/config';
import { connectDatabase } from './config/database';
import app from './app';
import { startHoldExpiryLoop } from './jobs/holdExpiry.service';

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDatabase();
    startHoldExpiryLoop();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
