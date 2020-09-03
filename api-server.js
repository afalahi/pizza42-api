require('dotenv').config()
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const axios = require('axios').default

const authConfig = require("./auth_config.json");

const app = express();

const port = process.env.PORT || 3001;
const appPort = process.env.SERVER_PORT || 3000;
const appOrigin = process.env.APP_ORIGIN || `http://localhost:${appPort}`;

// if (!authConfig.domain || !authConfig.audience) {
//   throw new Error(
//     "Please make sure that auth_config.json is in place and populated"
//   );
// }

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.DOMAIN}/.well-known/jwks.json`
  }),

  audience: process.env.AUDIENCE,
  issuer: `https://${process.env.DOMAIN}/`,
  algorithms: ["RS256"]
});

app.get("/api/external", checkJwt, (req, res) => {
  if(!req.user['https://pizza42.com/email_verified']) {
    res.send({
      msg: "Sorry, but you need to verify your email before proceeding"
    })
  }
  else {
    res.send({
      msg: req.user
    });
  }

});
app.get('/google-connections', checkJwt, async(req, res) => {
  try {
    const tokenOptions = { 
      method: 'POST',
      url: 'https://dev-gwlo8d17.auth0.com/oauth/token',
      headers: { 'content-type': 'application/json' },
      data: {
        client_id:process.env.CLIENT_ID,
        client_secret:process.env.CLIENT_SECRET,
        audience:"https://dev-gwlo8d17.auth0.com/api/v2/",
        grant_type:"client_credentials"
      }
    };
    const {access_token, token_type} = await (await axios(tokenOptions)).data
    console.log(access_token)

    const userId = req.user.sub
    const userInfoOptions = {
      method: 'GET',
      url: `https://${process.env.DOMAIN}/api/v2/users/${userId}`,
      headers: {Authorization: `${token_type} ${access_token}`}
    };
    const idpToken = await (await axios(userInfoOptions)).data
    const totalConnections = await (await axios.get("https://people.googleapis.com/v1/people/me/connections?personFields=names",{headers:{Authorization:`Bearer ${idpToken.identities[1].access_token}`}})).data
    res.send({
      msg:`The total number of connections is: ${totalConnections.totalPeople}`
    })
    
  }
  catch(err) {
    res.send({
      msg: err
    })
  }
})
app.listen(port, () => console.log(`API Server listening on port ${port}`));
