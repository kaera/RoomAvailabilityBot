'use strict';

const mongodb = require('mongodb');

class Client {
  constructor(config) {
    const { user, pass, host, port, name } = config;
    this._uri = `mongodb://${user}:${pass}@${host}:${port}/${name}`;
    this._name = name;
  }

  async _getCollection() {
    return new Promise((resolve, reject) => {

      mongodb.MongoClient.connect(this._uri, { useNewUrlParser: true }, (err, client) => {
        if (err) {
          reject(err);
        }

        const db = client.db(this._name);
        const collection = db.collection('test');
        resolve(collection);
      });

    });
  }

  async updateOrCreateDate(chatId, date) {
    const collection = await this._getCollection();
    return collection.updateOne({chatId: chatId}, {$addToSet: {dates: date}, $setOnInsert: {chatId: chatId} }, { upsert: true }, (err) => {
      if (err) {
        throw err;
      }
      console.log(`Added ${date} for ${chatId}`);
    });
  }

  async removeDate(chatId, date) {
    const collection = await this._getCollection();
    return collection.updateOne({chatId: chatId}, {$pull: {dates: date}}, (err) => {
      if (err) {
        throw err;
      }
      console.log(`Removed ${date} for ${chatId}`)
    });
  }

  async getUserDates(chatId) {
    const collection = await this._getCollection();
    return new Promise((resolve, reject) => {
      collection.findOne({chatId: chatId}, (err, data) => {
        if (err) {
          throw err;
        }
        console.log(`All data for ${chatId}:`);
        console.log(data.dates);
        resolve(data.dates);
      });

    })
  }

}

module.exports = Client;