import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import * as Minio from 'minio';

async function main() {
  // listen on the "tts" queue
  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('tts');

  const dbClient = new MongoClient(process.env.MONGO_URL);
  await dbClient.connect();
  const db = dbClient.db('reel-factory');

  const minio = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT,
    port: Number(process.env.S3_PORT),
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    useSSL: process.env.S3_USE_SSL === 'true',
  });

  //ensure bucket exists
  await minio.makeBucket('tts').catch((err) => {
    console.log('Bucket already exists');
  });

  channel.consume('tts', async (message) => {
    const id = message.content.toString();
    console.log(`[tts] Received message with id ${id}`);

    const doc = await db.collection('tts').findOne({ _id: new ObjectId(id) });

    if (!doc) {
      console.log(`[tts] Could not find document with id ${id}`);
      return;
    }

    console.log(`[tts] Document found with id ${id}`);

    const text = doc.text;

    // call Mimic

    console.log(`[tts] Calling Mimic with text ${text}`);

    const res = await axios.post(process.env.MIMIC_URL, text, {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    // upload file to S3

    const buffer = Buffer.from(res.data);

    const filename = `${id}.wav`;

    console.log(`[tts] Uploading file to S3 with name ${filename}`);

    await minio.putObject('tts', filename, buffer, buffer.length, {
      'Content-Type': 'audio/wav',
    });

    console.log(`[tts] File uploaded to S3 with name ${filename}`);

    // update document in MongoDB

    await db.collection('tts').updateOne(
      { _id: id },
      {
        $set: {
          status: 'done',
          filename,
        },
      }
    );

    console.log(`[tts] Document updated with id ${id}`);

    // acknowledge message

    channel.ack(message);
  });

  console.log('[tts] Ready');
}

main();
