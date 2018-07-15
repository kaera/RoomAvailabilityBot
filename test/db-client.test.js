const assert = require('assert');
const mongodb = require('mongodb');

const DbClient = require('../db-client');

const collectionName = 'polling_data';
const getConnection = () =>
  mongodb.MongoClient.connect('mongodb://localhost:27017/refuge', { useNewUrlParser: true });
const getCollection = connection => connection.db('refuge').collection(collectionName);

describe('DB client', function() {

  let db;

  beforeEach(async function() {
    db = new DbClient({
      collection: collectionName,
      host: 'localhost',
      name: 'refuge',
      port: '27017'
    });
    const connection = await getConnection();
    await getCollection(connection).remove({});
    await connection.close();
  });

  it('should not return non existent record', async function() {
    const connection = await getConnection();
    const chat = await getCollection(connection).findOne({ chatId: 111 });
    assert.equal(chat, null);
    await connection.close();
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
      const result = await getCollection(connection).findOne({ chatId: 323129 });
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
      const connection = await getConnection();
      await getCollection(connection).insert({ chatId: 111, dates: ['2018-01-01'] });
      await connection.close();

      const dates = await db.getUserDates(111);
      assert.deepEqual(dates, ['2018-01-01']);
    });

    it('should return empty list for non existing chat', async function() {
      const dates = await db.getUserDates(111);
      assert.deepEqual(dates, []);
    });

  });

  describe('#clearDates()', function() {

    beforeEach(async function() {
      const connection = await getConnection();
      await getCollection(connection).insert({ chatId: 111, dates: ['2018-01-01'] });
      await connection.close();
    });

    it('should remove all records for a given chat', async function() {
      await db.clearDates(111);

      const connection = await getConnection();
      const chatData = await getCollection(connection).findOne({ chatId: 111 });
      assert.equal(chatData, null);
      await connection.close();
    });

  });

});