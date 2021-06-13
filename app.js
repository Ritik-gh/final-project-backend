const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtKey } = require("./config.js");
const { authorizeUser } = require("./middleware/auth.js");
const { readdirSync } = require("fs");
const { equal } = require("assert");

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
  res.send("<h1>Final Project Backend!</h1>");
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
    }
  );
});

app.get("/get-posts/", (req, res) => {
  // sends all posts
  if (!req.query.postId) {
    console.log("no id");
    db.query("SELECT * FROM posts", (err, result) => {
      if (err) {
        console.log(err);
      } else {
        res.send(result);
      }
    });
  }
  // sends particular post
  else {
    db.query(
      "SELECT * FROM posts WHERE post_id = ?",
      req.query.postId,
      (err, postsResult) => {
        if (err) {
          console.log(err);
        } else {
          postsResult[0].postedBySelf = false;
          // if user is logged in, verify user
          if (req.query.user) {
            jwt.verify(req.query.user, jwtKey, (err, tokenResult) => {
              if (err) {
                res.sendStatus(401);
              }
              // query user details
              else {
                db.query(
                  "SELECT id FROM users WHERE email_address = ?",
                  tokenResult.email,
                  (err, usersResult) => {
                    if (err) {
                      console.log(err);
                    } else {
                      // check if the logged in user had created the requested post, if yes, send it with boolean
                      if (
                        usersResult.length === 1 &&
                        usersResult[0].id === postsResult[0].id
                      ) {
                        postsResult[0].postedBySelf = true;
                        // check if the post has got any bids
                        if (
                          postsResult[0].highest_bid &&
                          postsResult[0].highest_bidder_id
                        ) {
                          db.query(
                            "SELECT * FROM users WHERE id = ?",
                            postsResult[0].highest_bidder_id,
                            (err, biddersResult) => {
                              if (err) {
                                res.send(err);
                              } else {
                                // send the post and the bidder details
                                res.send({
                                  post: postsResult[0],
                                  bidderDetails: biddersResult[0],
                                });
                              }
                            }
                          );
                        }
                        // if no bids yet, send just the post
                        else {
                          res.send(postsResult[0]);
                        }
                      }
                      // if post not self created, send post without boolean
                      else {
                        res.send(postsResult[0]);
                      }
                    }
                  }
                );
              }
            });
          }
          // if user is not logged in
          else {
            res.send(postsResult[0]);
          }
        }
      }
    );
  }
});

app.get("/get-profile", authorizeUser, (req, res) => {
  db.query(
    "SELECT id, first_name, last_name, email_address FROM users WHERE email_address = ?",
    req.body.user_email,
    (err, usersResult) => {
      if (err) {
        console.log(err);
      } else {
        db.query(
          "SELECT * FROM posts WHERE id = ?",
          usersResult[0].id,
          (err, postsResult) => {
            if (err) {
              console.log(err);
            } else {
              res.send({
                user: usersResult[0],
                posts: postsResult,
              });
            }
          }
        );
      }
    }
  );
});

app.put("/place-bid", authorizeUser, (req, res) => {
  db.query(
    "SELECT * FROM users WHERE email_address = ?",
    req.body.user_email,
    (err, usersResult) => {
      if (err) {
        console.log(err);
      } else {
        db.query(
          "UPDATE posts SET highest_bid = ?, highest_bidder_id = ?  WHERE post_id = ?",
          [req.body.bidPrice, usersResult[0].id, req.body.postId],
          (err, postsResult) => {
            if (err) {
              console.log(err);
            } else {
              res.send("Bid Placed");
            }
          }
        );
      }
    }
  );
});

app.put("/mark-sold", authorizeUser, (req, res) => {
  if (!req.body.postId) {
    res.send("Send Post Id!");
  } else {
    db.query(
      "UPDATE posts SET post_status = 'sold' WHERE post_id = ?",
      req.body.postId,
      (err, postsResult) => {
        if (err) {
          console.log(err);
        } else {
          res.send("Marked as Sold");
        }
      }
    );
  }
});

app.get("/get-chats", authorizeUser, (req, res) => {
  db.query(
    "SELECT id FROM users WHERE email_address = ?",
    req.body.user_email,
    (err, usersResult) => {
      if (err) {
        console.log(err);
      } else {
        db.query(
          "SELECT * FROM chats WHERE sender_id OR receiver_id = ?",
          usersResult[0].id,
          (err, chatsResult) => {
            if (err) {
              console.log(err);
            } else {
              res.send(chatsResult);
            }
          }
        );
      }
    }
  );
});

app.get("/get-user", authorizeUser, (req, res) => {
  if (!req.query.userId) {
    res.send("Send User Id!");
  } else {
    db.query(
      "SELECT * FROM users WHERE id = ?",
      req.query.userId,
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          res.send(result[0]);
        }
      }
    );
  }
});

app.put("/post-msg", authorizeUser, (req, res) => {
  if (!req.body.msg) {
    res.send("Send in the message to post!");
  } else if (!req.body.receiverId) {
    res.send("Send in the sender id!");
  } else {
    db.query(
      "SELECT id FROM users WHERE email_address = ?",
      req.body.user_email,
      (err, senderResult) => {
        if (err) {
          console.log(err);
        } else {
          db.query(
            "INSERT INTO chats (receiver_id, sender_id, msg) VALUES(?, ?, ?)",
            req.body.receiverId,
            senderResult[0].id,
            req.body.msg,
            (err, chatsResult) => {
              res.send("Message added!");
            }
          );
        }
      }
    );
  }
});

app.listen(port, () => {
  console.log("I am listening, But You Don't!");
});
