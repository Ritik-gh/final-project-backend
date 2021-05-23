const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
port = 3030;

const db = mysql.createConnection({
  host: "localhost",
  user: "ritik",
  password: "1234",
  database: "fp_cs50",
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to database!");
});

app.get("/", (req, res) => {
  res.send("<h1>Hello Express!</h1>");
});

app.put("/register", (req, res) => {
  console.log(req.body);
});

app.listen(port, () => {
  console.log("I am listening!");
});
