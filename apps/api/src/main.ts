import { LegalHoldStatus } from './../../../node_modules/minio/dist/main/minio.d';
import express from 'express';
import { MongoClient } from 'mongodb';
import amqp from 'amqplib';
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  const app = express();
  app.use(express.json());

  const dbClient = new MongoClient(process.env.MONGO_URL);
  await dbClient.connect();
  const db = dbClient.db('reel-factory');

  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('tts');

  app.post('/video', async (req, res) => {
    if (!req.body.lines) {
      return res.status(400).json({ error: 'Missing lines' });
    }

    const ttsIds = await Promise.all(
      req.body.lines.map(async (line: string) => {
        const doc = await db.collection('tts').insertOne({
          createdAt: new Date(),
          text: line,
          status: 'open',
        });

        return doc.insertedId;
      })
    );

    const videoDoc = await db.collection('video').insertOne({
      createdAt: new Date(),
      status: 'open',
      ttsIds,
    });

    await channel.sendToQueue(
      'tts',
      Buffer.from(videoDoc.insertedId.toString())
    );

    return res.json({ id: videoDoc.insertedId });
  });

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}

main();
