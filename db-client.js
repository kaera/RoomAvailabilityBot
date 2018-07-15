'use strict';

const mongodb = require('mongodb');

class Client {
  constructor(config) {
    const { user, pass, host, port, name } = config;
    if (user && pass) {
      this._uri = `mongodb://${user}:${pass}@${host}:${port}/${name}`;
    } else {
      this._uri = `mongodb://${host}:${port}/${name}`;
    }
    this._name = name;
  }

  async _getConnection() {
    return new Promise((resolve, reject) => {

      mongodb.MongoClient.connect(this._uri, { useNewUrlParser: true }, (err, client) => {
        if (err) {
          reject(err);
        }

        resolve(client);
      });

    });
  }

  async updateOrCreateDate(chatId, date) {
    const connection = await this._getConnection();
    return new Promise((resolve, reject) => {
      connection
        .db(this._name)
        .collection('test')
        .updateOne({chatId: chatId}, {$addToSet: {dates: date}, $setOnInsert: {chatId: chatId} }, { upsert: true }, (err, dbResponse) => {
          if (err) {
            throw err;
          }
          console.log(`Added ${date} for ${chatId}`);
          connection.close();
          resolve(dbResponse);
        });
    })
  }

  async removeDate(chatId, date) {
    const connection = await this._getConnection();
    return connection
      .db(this._name)
      .collection('test')
      .updateOne({chatId: chatId}, {$pull: {dates: date}}, (err) => {
        if (err) {
          throw err;
        }
        console.log(`Removed ${date} for ${chatId}`)
        connection.close();
      });
  }

  async getUserDates(chatId) {
    const connection = await this._getConnection();
    const collection = connection
      .db(this._name)
      .collection('test');

    const chatData = await collection.findOne({ chatId: chatId });
    const dates = chatData ? chatData.dates : [];
    console.log(`All data for ${chatId}:`, dates);
    await connection.close();
    return dates;
  }

  async clearDates(chatId) {
    const connection = await this._getConnection();
    const collection = connection.db(this._name).collection('test');

    const chatData = await collection.remove({ chatId: chatId });
    console.log(`Data cleared for ${chatId}`);
    await connection.close();
  }

}

module.exports = Client;