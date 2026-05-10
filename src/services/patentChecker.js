import cron from 'node-cron';
import { getCollection } from '../db/connection.js';

export function startPatentCheckerCron() {
  // Run every day at midnight (or every minute for testing: '* * * * *')
  cron.schedule('0 0 * * *', async () => {
    console.log('🔍 Running scheduled patent check for user private ideas...');
    try {
      const collection = getCollection();
      // Find all private ideas that haven't been flagged yet
      const privateIdeas = await collection.find({ is_private: true, patent_warning: { $ne: true } }).toArray();
      
      for (const idea of privateIdeas) {
        // Here we simulate checking against a real patent database like USPTO or EPO.
        // A real implementation would call the public patent API with keywords from idea.title.
        const isPatentedSimulated = Math.random() < 0.05; // 5% chance of finding a patent match
        
        if (isPatentedSimulated) {
          await collection.updateOne(
             { _id: idea._id },
             { $set: { 
                 patent_warning: true, 
                 patent_checked_at: new Date(),
                 patent_message: `Alert: Similar keywords for "${idea.title}" were found in a recent patent filing. We advise reviewing USPTO records before taking this forward.`
               } 
             }
          );
          console.log(`⚠️ PATENT ALERT: User idea "${idea.title}" flagged for potential patent overlap!`);
        } else {
           await collection.updateOne(
             { _id: idea._id },
             { $set: { patent_checked_at: new Date() } }
          );
        }
      }
    } catch (err) {
      console.error('Patent checker error:', err.message);
    }
  });
}
