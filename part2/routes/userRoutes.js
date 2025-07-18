const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, username, email, role FROM Users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, password, role]);

    res.status(201).json({ message: 'User registered', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

// POST login (dummy version)
router.post('/login', async (req, res) => {
  // console.log('POST /api/users/login');

  // deconstructs username and password from request body
  const { username, password } = req.body;
  // console.log(req.body);
  try {
    // finds user_id, username, and role from the Users table where the username and password match a user
    const [rows] = await db.query(`
      SELECT user_id, username, role FROM Users
      WHERE username = ? AND password_hash = ?
    `, [username, password]);

    // if there is no user with that username and password, there is an error
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // user session is updated with user credentials from database
    req.session.user = rows[0];
    // console.log('Stored user in session: ', req.session.user);

    // responds with successful login and user credentials
    res.json({ message: 'Login successful', user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  // console.log("logging out and deleting session");
  // deletes session on logout
  req.session.destroy((err) => {
    if(err){
      // console.log("Logout error: ", err);
      return res.status(500).json({ message: 'Logout failed!' });
    }

    // deletes cookie from browser
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully!' });
  });
});

router.get('/dogs', async (req, res) => {
  try {
    const [Dogs] = await db.execute(`SELECT Dogs.name AS dog_name, Dogs.size, Dogs.dog_id, Users.user_id AS owner_id
         FROM Dogs
         JOIN Users ON Dogs.owner_id = Users.user_id`);
    res.json(Dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Dogs' });
  }
});

module.exports = router;