const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");

const authRoutes = require("./modules/auth/auth.routes");

const adminRoutes = require("./modules/admin/admin.routes");

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/admin", adminRoutes);

module.exports = app;