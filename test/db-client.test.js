const assert = require('assert');

const DbClient = require('../db-client');

const mongodb = require('mongodb');

const getConnection = () =>
  mongodb.MongoClient.connect('mongodb://localhost:27017/refuge', { useNewUrlParser: true });

describe('DB client', function() {

  let db;

  beforeEach(function() {
    db = new DbClient({
      host: 'localhost',
      name: 'refuge',
      port: '27017'
    });
  });

  it('should not return non existent record', async function() {
    const client = await getConnection();
    const chat = await client.db('refuge').collection('test').findOne({ chatId: 111 });
    assert.equal(chat, null);
    await client.close();
  });

  describe('#constructor()', function() {
    it('should initialize successfully', function() {
      const db = new DbClient({});
    });

    xit('should fail if db config is missing required parameters', function(done) {
      const db = new DbClient({});
      assert.throws(function () {
        db.updateOrCreateDate(123123, '2018-07-01');
      }, Error, 'Error thrown');
    });
  });

  describe('#updateDate()', function() {

    it('should successfully add a record', async function() {
      await db.updateOrCreateDate(323129, '2018-07-01');
      const connection = await getConnection();
      const result = await connection.db('refuge').collection('test').findOne({ chatId: 323129 });
      assert.equal(result.dates[0], '2018-07-01');
      await connection.close();
    });

  });

  describe('#removeDate()', function() {

    it('should successfully remove a record', function(done) {
      db.removeDate(123123, '2018-07-01')
        .then(_ => done());
    });

  });

  describe('#getUserDates()', function() {

    it('should return dates for existing chat', async function() {
      const dates = await db.getUserDates(123123);
      assert.deepEqual(dates, ['2018-11-23']);
    });

    it('should return empty list for non existing chat', async function() {
      const dates = await db.getUserDates(111);
      assert.deepEqual(dates, []);
    });

  });

  describe('#clearDates()', function() {

    beforeEach(async function() {
      const connection = await getConnection();
      const collection = await connection.db('refuge').collection('test');
      collection.updateOne({ chatId: 111 }, { $addToSet: { dates: '2018-01-01' }, $setOnInsert: { chatId: 111 } });
      await connection.close();
    });

    it('should remove all records for a given chat', async function() {
      await db.clearDates(111);

      const connection = await getConnection();
      const collection = await connection.db('refuge').collection('test');
      const chatData = await collection.findOne({ chatId: 111 });
      assert.equal(chatData, null);
      await connection.close();
    });

  });

});