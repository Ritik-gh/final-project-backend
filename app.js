const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwtKey, host, port } = require("./config.js");
const { authorizeUser } = require("./middleware/auth.js");
const { chownSync } = require("fs");
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

// create tables if not there
// db.query(
//   `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT NOT NULL,
//   first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
//   password VARCHAR(255) NOT NULL, email_address VARCHAR(255) NOT NULL,
//   phone_no INT NOT NULL, PRIMARY KEY (id));`,
//   (err, result) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log("users table created");
//     }
//   }
// );

// db.query(
//   ` CREATE TABLE IF NOT EXISTS posts (post_id INT AUTO_INCREMENT NOT NULL, base_price INT NOT NULL, highest_bid INT, location VARCHAR(255) NOT NULL,
// about VARCHAR(1000) NOT NULL, item_name VARCHAR(500) NOT NULL, items_estimated_age VARCHAR(100), area VARCHAR(50), highest_bidder_id INT NOT NULL,
// post_status VARCHAR(50) NOT NULL DEFAULT "unsold", item_image VARCHAR(1000) NOT NULL, id INT NOT NULL, FOREIGN KEY (id) REFERENCES users(id), PRIMARY KEY (post_id)); `,
//   (err, result) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log("posts table created");
//     }
//   }
// );

// db.query(
//   ` CREATE TABLE IF NOT EXISTS chats (chat_id INT AUTO_INCREMENT NOT NULL, sender_id INT NOT NULL, receiver_id INT NOT NULL, msg TEXT NOT NULL, msg_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (sender_id) REFERENCES users(id),FOREIGN KEY (receiver_id) REFERENCES users(id) , PRIMARY KEY (chat_id));`,
//   (err, result) => {
//     if (err) {
//       console.log(err);
//     } else {
//       console.log("chats table created");
//     }
//   }
// );

const app = express();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "*",
  },
});

httpServer.listen(port, () => {
  console.log("I am listening, But You Don't!");
});

// connecting sockets
io.on("connection", (socket) => {
  // token of user who just connected
  const senderId = socket.handshake.auth.token;

  // if token not sent, emit error
  if (!senderId) {
    io.emit("connectError", "Send auth token");
  }
  // verify user
  else {
    jwt.verify(senderId, jwtKey, (err, jwtResult) => {
      // if not authorised
      if (err) {
        socket.emit("connectError", new Error("Unauthorised user id"));
      }
      // get id from table
      else {
        db.query(
          "SELECT * FROM users WHERE email_address = ?",
          jwtResult.email,
          (err, usersResult) => {
            if (err) {
              socket.emit("connectError", "User not Found");
            } else {
              // join user to its own private room, and listen for upcoming messages
              socket.join(usersResult[0].id.toString());
              console.log(
                `${usersResult[0].first_name} joined with id ${usersResult[0].id}`
              );
              socket.on("send_msg", ({ msg, receiverId }) => {
                console.log(`${msg} was sent to ${receiverId}`);
                // send the message to recipient, and add the message to table
                io.to(receiverId.toString()).emit("receive_msg", msg);
                db.query(
                  "INSERT INTO chats (sender_id, receiver_id, msg) VALUES(?, ?, ?)",
                  [usersResult[0].id, receiverId, msg],
                  (err, chatsResult) => {
                    if (err) {
                      console.log(err);
                    } else {
                      console.log("message added to chats table");
                    }
                  }
                );
              });
            }
          }
        );
      }
    });
  }
});

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
  let processedChats = [];
  db.query(
    "SELECT id FROM users WHERE email_address = ?",
    req.body.user_email,
    (err, applicantResult) => {
      if (err) {
        console.log(err);
      } else {
        db.query(
          "SELECT * FROM chats WHERE sender_id OR receiver_id = ?",
          applicantResult[0].id,
          async (err, chatsResult) => {
            if (err) {
              console.log(err);
            } else {
              function getUserDetails(chat, type) {
                return new Promise((resolve, reject) => {
                  db.query(
                    "SELECT * FROM users WHERE id = ?",
                    type === "sent" ? chat.receiver_id : chat.sender_id,
                    (err, enduserResult) => {
                      if (err) {
                        console.log(err);
                      } else {
                        processedChats.push({
                          enduser: {
                            id: enduserResult[0].id,
                            first_name: enduserResult[0].first_name,
                            last_name: enduserResult[0].last_name,
                          },
                          msgs: [
                            {
                              type: type,
                              msg: chat.msg,
                            },
                          ],
                        });
                        resolve();
                      }
                    }
                  );
                });
              }
              for (chat of chatsResult) {
                console.log("length is ", processedChats.length);

                if (processedChats.length > 0) {
                  console.log("is greater than zero");
                  let enduserFound = false;
                  for (processedChat of processedChats) {
                    if (processedChat.enduser.id === chat.receiver_id) {
                      processedChat.msgs.push({
                        type: "sent",
                        msg: chat.msg,
                      });
                      enduserFound = true;
                    } else if (processedChat.enduser.id === chat.sender_id) {
                      processedChat.msgs.push({
                        type: "received",
                        msg: chat.msg,
                      });
                      enduserFound = true;
                    }
                  }
                  if (!enduserFound) {
                    if (chat.receiver_id === applicantResult[0].id) {
                      await getUserDetails(chat, "received");
                      console.log(processedChats);
                    } else {
                      await getUserDetails(chat, "sent");
                      console.log(processedChats);
                    }
                  }
                } else {
                  if (chat.receiver_id === applicantResult[0].id) {
                    await getUserDetails(chat, "received");
                    console.log(processedChats);
                  } else {
                    await getUserDetails(chat, "sent");
                    console.log(processedChats);
                  }
                }
              }
              console.log("processed chats", processedChats);
              res.send(processedChats);
              // res.send({
              //   applicantId: applicantResult[0].id,
              //   chats: chatsResult,
              // });
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

// app.put("/post-msg", authorizeUser, (req, res) => {
//   if (!req.body.msg) {
//     res.send("Send in the message to post!");
//   } else if (!req.body.receiverId) {
//     res.send("Send in the sender id!");
//   } else {
//     db.query(
//       "SELECT id FROM users WHERE email_address = ?",
//       req.body.user_email,
//       (err, senderResult) => {
//         if (err) {
//           console.log(err);
//         } else {
//           db.query(
//             "INSERT INTO chats (receiver_id, sender_id, msg) VALUES(?, ?, ?)",
//             req.body.receiverId,
//             senderResult[0].id,
//             req.body.msg,
//             (err, chatsResult) => {
//               res.send("Message added!");
//             }
//           );
//         }
//       }
//     );
//   }
// });
