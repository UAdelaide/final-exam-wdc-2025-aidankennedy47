var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');
// var db = require('db/db');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let db;

(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '' // Set your MySQL root password
    });

    // Create the database if it doesn't exist
    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    // Now connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    // Create a table if it doesn't exist
    await db.execute(`
        CREATE TABLE IF NOT EXISTS Users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('owner', 'walker') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS Dogs (
            dog_id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            size ENUM('small', 'medium', 'large') NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES Users(user_id)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkRequests (
            request_id INT AUTO_INCREMENT PRIMARY KEY,
            dog_id INT NOT NULL,
            requested_time DATETIME NOT NULL,
            duration_minutes INT NOT NULL,
            location VARCHAR(255) NOT NULL,
            status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkApplications (
            application_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            CONSTRAINT unique_application UNIQUE (request_id, walker_id)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkRatings (
            rating_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            owner_id INT NOT NULL,
            rating INT CHECK (rating BETWEEN 1 AND 5),
            comments TEXT,
            rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            FOREIGN KEY (owner_id) REFERENCES Users(user_id),
            CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
        )
    `);

    // Insert data if table is empty
    let [rows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('aidan', 'aidan@example.com', 'hashed999', 'walker'),
        ('dave', 'dave@example.com', 'hashed000', 'owner')
      `);
    }

  [rows] = await db.execute('SELECT COUNT(*) AS count FROM Dogs');
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO Dogs (owner_id, name, size)
        VALUES
        ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
        ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
        ((SELECT user_id FROM Users WHERE username = 'bobwalker'), 'Bigman', 'large'),
        ((SELECT user_id FROM Users WHERE username = 'aidan'), 'Sapphire', 'small'),
        ((SELECT user_id FROM Users WHERE username = 'dave'), 'Luna', 'medium')
      `);
    }

  [rows] = await db.execute('SELECT COUNT(*) AS count FROM WalkRequests');
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
        VALUES
        ((SELECT dog_id FROM Dogs WHERE name = 'Max' AND owner_id = (SELECT user_id FROM Users WHERE username = 'alice123')),
        '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bella' AND owner_id = (SELECT user_id FROM Users WHERE username = 'carol123')),
        '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Bigman' AND owner_id = (SELECT user_id FROM Users WHERE username = 'bobwalker')),
        '2025-06-10 10:00:00', 60, 'Botanic Gardens', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Sapphire' AND owner_id = (SELECT user_id FROM Users WHERE username = 'aidan')),
        '2025-06-10 11:30:00', 20, 'Sydney', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name = 'Luna' AND owner_id = (SELECT user_id FROM Users WHERE username = 'dave')),
        '2025-06-10 15:00:00', 40, 'Rundle Mall', 'cancelled')
      `);
    }
    return db;
  } catch (err) {
    console.error('Error setting up database. Ensure Mysql is running: service mysql start', err);
  }
})();


// Route to return dogs as JSON
app.get('/api/dogs', async (req, res) => {
  try {
    const [Dogs] = await db.execute(`SELECT Dogs.name AS dog_name, Dogs.size, Users.username AS owner_username
         FROM Dogs
         JOIN Users ON Dogs.owner_id = Users.user_id`);
    res.json(Dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Dogs' });
  }
});

// Route to return walk requests as JSON
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [requests] = await db.execute(`SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
         FROM Dogs d
         JOIN Users u ON d.owner_id = u.user_id
         JOIN WalkRequests wr ON d.dog_id = wr.dog_id`);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Route to return walkers as JSON
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [walkers] = await db.execute(`SELECT u.username AS walker_username, COUNT(wrate.rating) AS total_ratings, ROUND(AVG(wrate.rating), 1) AS average_rating, COUNT(CASE WHEN wreq.status = 'completed' THEN 1 END) AS completed_walks
         FROM Users u
         JOIN WalkRatings wrate ON u.user_id = wrate.walker_id
         JOIN WalkRequests wreq ON wrate.request_id = wreq.request_id
         WHERE u.role = 'walker'
         GROUP BY u.username`);
    res.json(walkers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walkers' });
  }
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
