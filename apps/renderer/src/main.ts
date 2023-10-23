import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { enableTailwind } from '@remotion/tailwind';
import { WebpackOverrideFn } from '@remotion/bundler';
import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import * as Minio from 'minio';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync, unlinkSync } from 'fs';

const webpackOverride: WebpackOverrideFn = (currentConfiguration) => {
  return enableTailwind(currentConfiguration);
};

async function main() {
  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
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
  await minio.makeBucket('videos').catch((err) => {
    console.log('Bucket already exists');
  });

  // The composition you want to render
  const compositionId = 'MyComp';

  channel.consume('renderer', async (msg) => {
    const id = msg.content.toString();
    console.log(`[renderer] Received message with id ${id}`);

    const videoDoc = await db.collection('video').findOne({
      _id: new ObjectId(id),
    });

    if (!videoDoc) {
      console.log(`[renderer] Could not find document with id ${id}`);
      return;
    }

    console.log(`[renderer] Document found with id ${id}`);

    const ttsDocs = await db
      .collection('tts')
      .find({ _id: { $in: videoDoc.ttsIds } })
      .toArray();

    const publicPath = path.resolve('./apps/renderer/video/public/temp');
    // ensure folder exists
    await mkdir(publicPath, { recursive: true }).catch(() => {
      // folder already exists
    });

    // download files and put them in the public folder

    console.log(`[renderer] Downloading files for video with id ${id}`);
    await Promise.all(
      ttsDocs.map(async (doc) => {
        const filename = `${doc._id}.wav`;
        const buffer = await minio.getObject('tts', filename).catch((err) => {
          console.log(`[renderer] Could not find file ${filename}`);
          return;
        });
        if (!buffer) {
          return;
        }
        return await writeFile(path.resolve(publicPath, filename), buffer);
      })
    );

    const inputProps = {
      captions: ttsDocs.map((doc) => ({
        duration: doc.duration,
        text: doc.text,
        filename: doc.filename,
      })),
    };

    console.log(`[renderer] Bundling video with id ${id}`);
    const bundleLocation = await bundle({
      entryPoint: path.resolve('./apps/renderer/video/src/index.ts'),
      // If you have a Webpack override, make sure to add it here
      webpackOverride,
    });

    console.log(`[renderer] Rendering video with id ${id}`);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    let lastProgress = 0;

    const media = await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      inputProps,
      onProgress: (p) => {
        if (p.progress - lastProgress > 0) {
          console.log(
            ((p.progress * 100) | 0) + '%, frame ' + p.renderedFrames
          );
          lastProgress = p.progress;
        }
      },
    });

    const buffer = media.buffer;

    const filename = `${id}.mp4`;

    console.log(`[renderer] Uploading video with id ${id} to S3`);
    await minio.putObject('videos', filename, buffer, buffer.length, {
      'Content-Type': 'video/mp4',
    });

    await db.collection('video').updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: 'done',
          filename,
        },
      }
    );

    console.log(`[renderer] ✅ Video rendered with id ${id}`);

    // delete files from public folder
    // delete wav files from public folder
    console.log(`[renderer] Deleting files for video with id ${id}`);
    await Promise.all(
      ttsDocs.map(async (doc) => {
        const filename = `${doc._id}.wav`;
        return await unlink(path.resolve(publicPath, filename)).catch(() => {
          // file does not exist
        });
      })
    );

    channel.ack(msg);
  });

  console.log('[renderer] Ready');
}

main();
