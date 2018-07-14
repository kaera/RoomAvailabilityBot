'use strict';

const mongodb = require('mongodb');
const { user, pass, host, port, name } = require('./tokens').db;
const uri = `mongodb://${user}:${pass}@${host}:${port}/${name}`;

async function getCollection() {
  return new Promise((resolve, reject) => {

    mongodb.MongoClient.connect(uri, { useNewUrlParser: true }, (err, client) => {
      if (err) {
        reject(err);
      }

      const db = client.db(name);
      const collection = db.collection('test');
      resolve(collection);
    });

  });
}

async function updateDate(chatId, date) {
  const collection = await getCollection();
  return collection.updateOne({chatId: chatId}, {$addToSet: {dates: date}}, (err) => {
    if (err) {
      throw err;
    }
    console.log(`Added ${date} for ${chatId}`);
  });
}

async function removeDate(chatId, date) {
  const collection = await getCollection();
  return collection.updateOne({chatId: chatId}, {$pull: {dates: date}}, (err) => {
    if (err) {
      throw err;
    }
    console.log(`Removed ${date} for ${chatId}`)
  });
}

module.exports = {
  updateDate,
  removeDate
};