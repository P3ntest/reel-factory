import puppeteer from 'puppeteer';
import amqp from 'amqplib';
import { MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import * as Minio from 'minio';
import getAudioDurationInSeconds from 'get-audio-duration';
import { Readable } from 'stream';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { fstatSync, write } from 'fs';
import axiosRetry from 'axios-retry';
import path from 'path';
import os from 'os';

async function main() {
  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue('instagram');

  const dbClient = new MongoClient(process.env.MONGO_URL);
  await dbClient.connect();
  const db = dbClient.db('reel-factory');

  console.log(puppeteer.executablePath());

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

    // upload video to instagram
    const browser = await puppeteer.launch({
      headless: false,
    });

    const page = await browser.newPage();

    console.log('[instagram] Navigating to instagram.com');

    await page.goto('https://www.instagram.com/accounts/login/');

    try {
      // find button with text content "Accept all cookies"
      await page.waitForSelector(`div [role="dialog"]`, {
        timeout: 2000,
      });
      await page.click(
        `div [role="dialog"] > div > div:nth-child(2) > div > button`
      );
      console.log('[instagram] Accepted cookies');
    } catch (error) {
      console.log('[instagram] No cookies to accept');
    }

    await page.waitForTimeout(2000);

    console.log('[instagram] Logging in');

    await page.waitForSelector('input[name="username"]');

    await page.type('input[name="username"]', process.env.INSTAGRAM_USERNAME);
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD);

    await page.waitForTimeout(2000);

    await page.click('button[type="submit"]');

    await page.waitForTimeout(5000);

    // wait for option with value en
    console.log('[instagram] Waiting for language select');
    await page.waitForSelector('select option[value="en"]');

    await page.select('select', 'en');

    // find button with aria label "New post"

    console.log('[instagram] Waiting for new post button');
    await page.waitForSelector('svg[aria-label="New post"]');

    console.log('[instagram] Clicking new post button');
    await page.click('svg[aria-label="New post"]');

    await page.waitForSelector('input[type="file"]');

    console.log('[instagram] Uploading video');

    const input = await page.$('input[type="file"]');

    // upload video
    // save video to temp folder
    const video = await minio.getObject('videos', doc.filename);
    const tempFolder = path.resolve('./temp');
    await mkdir(tempFolder, { recursive: true });
    const tempPath = path.resolve(tempFolder, doc.filename);
    console.log('temppath', tempPath);
    await writeFile(tempPath, video);
    console.log('file size', (await stat(tempPath)).size);

    await input.uploadFile(tempPath);

    console.log('[instagram] Uploaded video');

    // delete video from temp folder
    // await unlink(tempPath);

    await page.waitForTimeout(20000);
  });

  console.log('[instagram] Waiting for messages...');
}

main();
