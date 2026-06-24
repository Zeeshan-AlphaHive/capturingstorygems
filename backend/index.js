// const dns = require("node:dns");
// dns.setServers(['1.1.1.1', '8.8.8.8']);
// const express = require("express");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const path = require("path");
// require("dotenv").config();
// const { Mongoose } = require("./src/configs/database.js");

// const app = express();
// const port = process.env.PORT || 3001;
// const appName = process.env.APP_NAME;
// const version = process.env.API_VERSION;

// const allowedOrigins = [
//   "http://localhost:3000",
//   "http://localhost:3001",
//   "https://capturingstorygems.vercel.app",
//   "https://capturingstorygems.com",
//   "https://www.capturingstorygems.com",
//   "https://ai-story-frontend-ten.vercel.app",
//   "https://ai-story-fe.vercel.app",
//   "https://ai-story-front.vercel.app"
// ];

// app.use(
//   cors({
//     origin: allowedOrigins,
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: [
//       "Content-Type",
//       "Authorization",
//       "consent",
//       "institution",
//       "X-Finance-Access-Token",
//       "x-finance-access-token",
//     ],
//   })
// );

// const userRoutes = require("./src/routes/user/index.js");
// const adminRoutes = require("./src/routes/admin/index.js");
// const webhookRoutes = require("./src/routes/user/webhook.js");
// const { checkoutComplete } = require("./src/controllers/user/plan");

// app.post(
//   `/api/${version}/user/plan/checkout`,
//   express.raw({ type: "application/json" }),
//   checkoutComplete
// );

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use(express.json({ limit: "50mb" }));

// app.use(`/api/${version}/ping`, (req, res) => {
//   return res.send("Welcome to Ai Story Builder Backend!");
// });

// app.use('/api/webhooks', webhookRoutes);
// app.use(`/api/${version}/user`, userRoutes);
// app.use(`/api/${version}/admin`, adminRoutes);

// app.listen(port, () => {
//   console.log(`${appName} App is Running at port ${port}`);
// });

const dns = require("node:dns");
 dns.setServers(['1.1.1.1', '8.8.8.8']);
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
require("./src/configs/database.js");

const app = express();
app.set("trust proxy", true);
const port = process.env.PORT || 3001;
const appName = process.env.APP_NAME || "capturing-story-gems-api";
const version = process.env.API_VERSION || "v1";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://capturingstorygems.vercel.app",
  "https://capturingstorygems.com",
   "https://capturingstorygems.com",
  "https://www.capturingstorygems.com",
  "https://ai-story-frontend-ten.vercel.app",
  "https://ai-story-fe.vercel.app",
  "https://ai-story-front.vercel.app"
];

// 1. Define CORS options
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "consent",
    "institution",
    "X-Finance-Access-Token",
    "x-finance-access-token",
  ],
};

// 2. Apply CORS globally and handle preflight OPTIONS requests explicitly
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

function lazyRoute(loader) {
  let route;
  return (req, res, next) => {
    try {
      if (!route) route = loader();
      return route(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
}

app.post(
  `/api/${version}/user/plan/checkout`,
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    try {
      const { checkoutComplete } = require("./src/controllers/user/plan");
      return checkoutComplete(req, res, next);
    } catch (error) {
      return next(error);
    }
  }
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json({ limit: "50mb" }));

app.use(`/api/${version}/ping`, (req, res) => {
  return res.send("Welcome to Ai Story Builder Backend!");
});

app.use('/api/webhooks', lazyRoute(() => require("./src/routes/user/webhook.js")));
app.use(`/api/${version}/user/auth`, lazyRoute(() => require("./src/routes/user/auth.js")));
app.use(`/api/${version}/admin/auth`, lazyRoute(() => require("./src/routes/admin/auth.js")));
app.use(`/api/${version}/user`, lazyRoute(() => require("./src/routes/user/index.js")));
app.use(`/api/${version}/admin`, lazyRoute(() => require("./src/routes/admin/index.js")));

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);
  if (res.headersSent) return next(error);
  return res.status(500).json({
    message: "Internal server error",
    response: null,
    error: error?.message || "Unexpected server error",
  });
});

// app.listen(port, () => {
//   console.log(`${appName} App is Running at port ${port}`);
// });


app.listen(port, () => {
    console.log(`${appName} App is Running at port ${port}`);
  });
// if (process.env.NODE_ENV !== 'production') {
  
// }

// 3. EXPORT THE APP FOR VERCEL
module.exports = app;
