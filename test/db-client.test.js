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

});