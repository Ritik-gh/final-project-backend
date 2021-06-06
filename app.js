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
// serve images
app.use("/images", express.static("images"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./images/db-images/posts");
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
const host = "localhost";
const port = 3030;

const db = mysql.createConnection({
  host: host,
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
  console.log(req.file);
  res.send("post data received");
  let id;
  db.query(
    "SELECT id FROM users WHERE email_address = ?",
    req.body.user_email,
    (err, result) => {
      if (err) {
        console.log(err);
      } else {
        id = result[0].id;
      }
      db.query(
        "INSERT INTO posts (item_name, items_estimated_age, location, base_price, about, item_image, id) VALUES(? , ?, ?, ?, ?, ?, ?)",
        [
          req.body.name,
          req.body.age,
          req.body.location,
          req.body.basePrice,
          req.body.description,
          `http://${host}:${port}/${req.file.destination.slice(2)}/${
            req.file.filename
          }`,
          id,
        ],
        (err, result) => {
          if (err) {
            console.log(err);
          } else {
            console.log("post added to database");
          }
        }
      );
      console.log("result", result);
    }
  );
  console.log("this is id", id);
});

app.get("/get-posts/", (req, res) => {
  if (!req.query.postId) {
    console.log("no id");
    db.query("SELECT * FROM posts", (err, result) => {
      if (err) {
        console.log(err);
      } else {
        res.send(result);
      }
    });
  } else {
    db.query(
      "SELECT * FROM posts WHERE post_id = ?",
      req.query.postId,
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          res.send(result[0]);
        }
        console.log("post result", result[0]);
      }
    );
  }
});

app.listen(port, () => {
  console.log("I am listening, But You Don't!");
});
