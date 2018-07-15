'use strict';

const mongodb = require('mongodb');

class Client {
  constructor(config) {
    const { user, pass, host, port, name, collection } = config;
    if (user && pass) {
      this._uri = `mongodb://${user}:${pass}@${host}:${port}/${name}`;
    } else {
      this._uri = `mongodb://${host}:${port}/${name}`;
    }
    this._collection = collection;
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

  _getCollection(connection) {
    return connection.db(this._name).collection(this._collection);
  }

  async updateOrCreateDate(chatId, date) {
    const connection = await this._getConnection();
    return new Promise((resolve, reject) => {
      this._getCollection(connection)
        .updateOne({chatId: chatId}, {$addToSet: {dates: date}, $setOnInsert: {chatId: chatId} }, { upsert: true }, (err, dbResponse) => {
          if (err) {
            throw err;
          }
          console.log(`DataBase. Added date: ${date} for chat id: ${chatId}`);
          connection.close();
          resolve(dbResponse);
        });
    })
  }

  async removeDate(chatId, date) {
    const connection = await this._getConnection();
    return this._getCollection(connection)
      .updateOne({chatId: chatId}, {$pull: {dates: date}}, (err) => {
        if (err) {
          throw err;
        }
        console.log(`DataBase: Removed date: ${date} for chat id: ${chatId}`);
        connection.close();
      });
  }

  async getUserDates(chatId) {
    const connection = await this._getConnection();
    const collection = this._getCollection(connection);

    const chatData = await collection.findOne({ chatId: chatId });
    const dates = chatData ? chatData.dates : [];
    await connection.close();
    return dates;
  }

  async clearDates(chatId) {
    const connection = await this._getConnection();
    const collection = this._getCollection(connection);

    const chatData = await collection.remove({ chatId: chatId });
    console.log(`DataBase. All data cleared for chat id: ${chatId}`);
    await connection.close();
  }

}

module.exports = Client;