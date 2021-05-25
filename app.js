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
    console.log(err);
  }
  console.log("Connected to database!");
});

app.get("/", (req, res) => {
  res.send("<h1>Hello Express!</h1>");
});

app.put("/register", (req, res) => {
  db.query(
    "SELECT * FROM users WHERE email_address = ?",
    req.body.email,
    (err, result) => {
      if (err) {
        console.log(err);
      }
      console.log("first" + result.length, result);
      if (result.length > 0) {
        res.send("exists");
      } else {
        res.send("doesn't exist");
        db.query(
          "INSERT INTO users (first_name, last_name, user_password, email_address, phone_no) VALUES (?, ?, ?, ?, ?)",
          [
            req.body.firstName,
            req.body.lastName,
            req.body.password,
            req.body.email,
            req.body.phone,
          ],
          (err, result) => {
            if (err) {
              console.log(err);
            }
          }
        );
      }
    }
  );
});

app.post("/login", (req, res) => {
  db.query(
    "SELECT email_address FROM users WHERE email_address = ?",
    req.body.email,
    (err, result) => {
      if (err) {
        console.log(err);
      } else if (
        result.length == 0 ||
        result[0].email_address !== req.body.email
      ) {
        res.send("invalid email");
      } else {
        db.query(
          "SELECT user_password FROM users WHERE user_password = ? AND email_address = ?",
          [req.body.password, req.body.email],
          (err, result) => {
            if (err) {
              console.log(err);
            } else if (
              result.length == 0 ||
              result[0].user_password !== req.body.password
            ) {
              res.send("invalid password");
            } else {
              res.send("valid");
            }
            console.log("password rows", result);
          }
        );
      }
    }
  );
});

app.listen(port, () => {
  console.log("I am listening!");
});
