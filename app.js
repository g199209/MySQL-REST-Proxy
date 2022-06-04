// Importing the dependencies 
const express = require('express'); 
const cors = require('cors'); 
const morgan = require('morgan'); 
const mysql = require('mysql-await');
const fs = require('fs');

// Init MySQL connection
const connection = mysql.createConnection(JSON.parse(fs.readFileSync('mysql-config.json')));

connection.on('error', (err) => {
  console.error(`MySQL Connection error ${err.code}`);
});

// Defining the Express app 
const app = express(); 
const PORT = 3000;
  
// Calling the express.json() method for parsing
app.use(express.json()); 
  
// Enabling CORS for all requests 
app.use(cors()); 
  
// Adding morgan to log HTTP requests 
app.use(morgan('combined')); 

app.get('/:id', async (req, res) => { 
  // connection.query()
  let result = await connection.awaitQuery(`SELECT * FROM node_test WHERE id = ?`, [req.params.id]);
  res.status(200).json({
    id: result[0].id,
    name: result[0].name
  });
});
  
// starting the server 
app.listen(PORT, (err) => { 
  if (err)
    console.log(err);
  console.log('Server listening on port', PORT);
}); 
