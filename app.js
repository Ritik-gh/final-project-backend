const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtKey } = require("./config.js");
const { authorizeUser } = require("./middleware/auth.js");

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/db-images/items");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      path.basename(file.originalname, path.extname(file.originalname)) +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
});
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
  console.log("Anyway, Connected to database!");
});

app.get("/", (req, res) => {
  res.send("<h1>Hello Express!</h1>");
});

app.put("/register", (req, res) => {
  db.query(
    "SELECT * FROM users WHERE email_address = ?",
    req.body.email,
    async (err, result) => {
      if (err) {
        console.log(err);
      }
      if (result.length > 0) {
        res.send("already exists");
      } else {
        res.send("doesn't exist");
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        db.query(
          "INSERT INTO users (first_name, last_name, user_password, email_address, phone_no) VALUES (?, ?, ?, ?, ?)",
          [
            req.body.firstName,
            req.body.lastName,
            hashedPassword,
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
          "SELECT user_password FROM users WHERE email_address = ?",
          req.body.email,
          async (err, result) => {
            if (err) {
              console.log(err);
            } else if (
              result.length == 0 ||
              !(await bcrypt.compare(
                req.body.password,
                result[0].user_password
              ))
            ) {
              res.send("invalid password");
            } else {
              const authToken = jwt.sign({ email: req.body.email }, jwtKey);
              res.statusCode = 201;
              res.send(authToken);
            }
          }
        );
      }
    }
  );
});

// result[0].user_password !== req.body.password

app.post("/post-ad", upload.single("img"), authorizeUser, (req, res) => {
  console.log(req.body);
  res.send("post data received");
  // db.query(
  //   "INSERT INTO posts (item_name, items_estimated_age, location, base_price, about, item_image) VALUES(? , ?, ?, ?, ?, ?)",
  //   [
  //     req.body.name,
  //     req.body.age,
  //     req.body.location,
  //     req.body.basePrice,
  //     req.body.description,
  //     req.file.path,
  //   ],
  //   (err, result) => {
  //     if (err) {
  //       console.log(err);
  //     } else {
  //       console.log("post added to database");
  //     }
  //   }
  // );
});

app.listen(port, () => {
  console.log("I am listening, But You Don't!");
});
