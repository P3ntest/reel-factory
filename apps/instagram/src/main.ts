import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import * as Minio from 'minio';
import { Stream } from 'stream';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { fstatSync, write } from 'fs';
import axiosRetry from 'axios-retry';
import path from 'path';
import os from 'os';
import { IgApiClient } from 'instagram-private-api';

async function main() {
  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('instagram');

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
  // listen for messages on the "instagram" queue
  channel.consume('instagram', async (msg) => {
    channel.ack(msg);
    const id = msg.content.toString();
    console.log(`[instagram] Received message with id ${id}`);

    const doc = await db.collection('video').findOne({ _id: new ObjectId(id) });

    if (!doc) {
      console.log(`[instagram] Could not find document with id ${id}`);
      return;
    }

    console.log(`[instagram] Document found with id ${id}`);

    const ig = new IgApiClient();

    ig.state.generateDevice(process.env.INSTAGRAM_USERNAME);

    // await ig.simulate.preLoginFlow();

    const loggedInUser = await ig.account.login(
      process.env.INSTAGRAM_USERNAME,
      process.env.INSTAGRAM_PASSWORD
    );

    // await ig.simulate.postLoginFlow();
    console.log(`[instagram] Logged in as ${loggedInUser.username}`);

    const video = await minio.getObject('videos', doc.filename);
    const buffer = await stream2buffer(video);

    const coverPath = path.resolve('./apps/instagram/assets/cover.jpg');
    console.log('cover', coverPath);
    const cover = await readFile(coverPath);

    await ig.publish.story({
      video: buffer,
      coverImage: cover,
    });

    console.log(`[instagram] Published video with id ${id}`);
  });

  console.log('[instagram] Waiting for messages...');
}

main();

async function stream2buffer(stream: Stream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const _buf = Array<any>();

    stream.on('data', (chunk) => _buf.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(_buf)));
    stream.on('error', (err) => reject(`error converting stream - ${err}`));
  });
}
