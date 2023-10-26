from instagrapi import Client
import os
from dotenv import load_dotenv
import pika
import pymongo

# import pymongo ObjectId
from bson.objectid import ObjectId
from minio import Minio


import tempfile


def main():
    load_dotenv()

    dbclient = pymongo.MongoClient(os.getenv("MONGO_URL"))
    db = dbclient[os.getenv("MONGO_DB")]

    videosCollection = db["video"]

    minioclient = Minio(
        os.getenv("S3_ENDPOINT") + ":" + os.getenv("S3_PORT"),
        access_key=os.getenv("S3_ACCESS_KEY"),
        secret_key=os.getenv("S3_SECRET_KEY"),
        secure=False,
    )

    connection = pika.BlockingConnection(
        pika.ConnectionParameters(os.getenv("RABBITMQ_HOST"))
    )
    channel = connection.channel()
    channel.queue_declare(queue="instagram", durable=True)

    def callback(ch, method, properties, body):
        print(" [x] Received %r" % body)
        print(body.decode("utf-8"))
        doc = videosCollection.find_one({"_id": ObjectId(body.decode("utf-8"))})
        print(doc)

        fileLoc = "/tmp/" + doc["filename"]
        minioclient.fget_object("videos", doc["filename"], fileLoc)

        print("File name: ")
        print(fileLoc)

        cl = Client()
        cl.login(os.getenv("INSTAGRAM_USERNAME"), os.getenv("INSTAGRAM_PASSWORD"))
        print(cl.user_id)
        cl.clip_upload(fileLoc, caption="My caption")
        print("Uploaded")

        #  Delete file
        os.remove(fileLoc)

    channel.basic_consume(
        queue="instagram", on_message_callback=callback, auto_ack=True
    )

    print(" [*] Waiting for messages. To exit press CTRL+C")
    channel.start_consuming()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted")
        try:
            sys.exit(0)
        except SystemExit:
            os._exit(0)
