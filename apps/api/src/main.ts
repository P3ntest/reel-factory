import { LegalHoldStatus } from './../../../node_modules/minio/dist/main/minio.d';
import express from 'express';
import { MongoClient } from 'mongodb';
import amqp from 'amqplib';
import { splitLines } from './lines';
import { execArgv } from 'process';
const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  const app = express();
  app.use(express.json());
  app.use(express.text());

  const dbClient = new MongoClient(process.env.MONGO_URL);
  await dbClient.connect();
  const db = dbClient.db('reel-factory');

  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('tts');

  app.post('/video', async (req, res) => {
    // if (!req.body.lines && !req.body.text) {
    //   return res.status(400).json({ error: 'Missing lines' });
    // }

    console.log(req.body);

    let lines = req.body.lines ?? splitLines(req.body);

    if (req.body.text) {
      lines = splitLines(req.body.text);
    }

    const ttsIds = await Promise.all(
      lines.map(async (line: string) => {
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
