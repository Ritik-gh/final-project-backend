const jwt = require("jsonwebtoken");
const { jwtKey } = require("../config.js");

function authorizeUser(req, res, next) {
  const authHeader = req.headers["auth"];
  if (!authHeader) {
    res.sendStatus(401);
  } else {
    jwt.verify(authHeader, jwtKey, (err, result) => {
      if (err) {
        res.sendStatus(401);
      } else {
        console.log("descrypted token", result);
        req.body.user_email = result.email;
        next();
      }
    });
  }
}

module.exports = {
  authorizeUser,
};
