import express from "express";
import { MongoClient } from "mongodb";
import amqp from "amqplib";
const host = process.env.HOST ?? "localhost";
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function main() {
  const app = express();
  app.use(express.json());

  const dbClient = new MongoClient(process.env.MONGO_URL);
  await dbClient.connect();
  const db = dbClient.db("reel-factory");

  const amqpClient = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await amqpClient.createChannel();
  await channel.assertQueue("tts");

  app.post("/tts", async (req, res) => {
    if (!req.body.text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const doc = await db.collection("tts").insertOne({
      createdAt: new Date(),
      text: req.body.text,
    });

    await channel.sendToQueue("tts", Buffer.from(doc.insertedId.toString()));

    return res.json({ id: doc.insertedId });
  });

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
}

main();
