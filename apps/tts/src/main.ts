import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import * as Minio from 'minio';
import getAudioDurationInSeconds from 'get-audio-duration';
import { Readable } from 'stream';
import { writeFile } from 'fs/promises';
import { write } from 'fs';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3 });

async function main() {
  // listen on the "tts" queue
  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('tts');
  await channel.assertQueue('renderer');

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

  async function ttsSingle(id: string) {
    // console.log(`[tts] TTSing with id ${id}`);

    const doc = await db.collection('tts').findOne({ _id: new ObjectId(id) });

    if (!doc) {
      console.log(`[tts] Could not find document with id ${id}`);
      return;
    }

    // console.log(`[tts] Document found with id ${id}`);

    const text = doc.text;

    // call Mimic

    console.log(`[tts] Calling Mimic with text ${text}`);

    const res = await axios
      .post(process.env.MIMIC_URL + `?lengthScale=0.7`, text, {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'text/plain',
        },
      })
      .catch((err) => {
        console.error('[tts] error with ', text.toString(), err.response.data);
      });

    if (!res) {
      console.log(`[tts] Mimic responded with error`);
      return;
    }

    console.log(`[tts] Mimic responded with status ${res.status}`);
    // get duration
    // save file to disk temporarily
    await writeFile('temp.wav', res.data);
    const duration = await getAudioDurationInSeconds('temp.wav');
    await writeFile('temp.wav', '');

    // console.log(`[tts] Duration is ${duration}`);

    // upload file to S3

    const buffer = Buffer.from(res.data);

    const filename = `${id}.wav`;

    console.log(`[tts] Uploading file to S3 with name ${filename}`);

    await minio.putObject('tts', filename, buffer, buffer.length, {
      'Content-Type': 'audio/wav',
    });

    // console.log(`[tts] File uploaded to S3 with name ${filename}`);

    // update document in MongoDB

    const update = await db.collection('tts').updateMany(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'done',
          filename,
          duration,
        },
      }
    );

    console.log(
      `[tts] ${update.modifiedCount} documents updated with id ${id}`
    );
  }

  channel.consume('tts', async (message) => {
    const videoDocId = message.content.toString();

    console.log(`[tts] Received message with id ${videoDocId}`);

    const videoDoc = await db
      .collection('video')
      .findOne({ _id: new ObjectId(videoDocId) });

    if (!videoDoc) {
      console.log(`[tts] Could not find video document with id ${videoDocId}`);
      return;
    }

    console.log(`[tts] Video document found with id ${videoDocId}`);

    const ttsIds = videoDoc.ttsIds;

    console.log(`[tts] There are ${ttsIds.length} tts documents to tts`);

    await Promise.all(
      ttsIds.map(async (ttsId: string) => {
        await ttsSingle(ttsId);
      })
    );

    console.log(`[tts] All tts documents ttsed`);

    channel.ack(message);
    channel.sendToQueue('renderer', Buffer.from(videoDocId.toString()));
  });

  console.log('[tts] Ready');
}

main();
