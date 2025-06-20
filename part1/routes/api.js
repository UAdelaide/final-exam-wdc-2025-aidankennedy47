var express = require('express');
var router = express.Router();
var db = require('../app');

/* GET users listing. */
router.get('/dogs', async function(req, res, next) {
  try {
    const [dogs] = await db.execute(`SELECT Dogs.name AS dog_name, Dogs.size, Users.username AS owner_username
        FROM Dogs
        JOIN Users ON Dogs.owner_id = Users.user_id
        `);
    res.json(dogs);
  } catch (err) {
    console.log("Error in ")
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

router.get('/walkrequests/open', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/walkers/summary', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;
