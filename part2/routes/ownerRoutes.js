const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/dogs', async (req, res) => {
  // gets owner_id from the session
  let owner_id = req.session.user.user_id;
  // console.log(owner_id);

  try {
    // queries the database for dog_id and name of the dogs owned by owner_id
    const [rows] = await db.query(`
      SELECT dog_id, name FROM Dogs WHERE owner_id = ?
    `, [owner_id]);
    // console.log(rows);

    // responds with dog_id and name of dogs under owner_id as json
    res.json(rows);
  } catch (error) {
    // console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

module.exports = router;
