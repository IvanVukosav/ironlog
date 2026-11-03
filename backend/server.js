require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { isAuthEnabled, requireAuth } = require("./utils/auth");

const app = express();

// Railway sits behind one proxy hop; needed for the real client IP in login rate limiting.
app.set("trust proxy", 1);

// CORS_ORIGIN is a comma-separated allow-list; unset means any origin (local dev).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "IronLog API running" });
});

const PORT = process.env.PORT || 3001;

const workoutsRouter = require("./routes/workouts");
const nutritionRouter = require("./routes/nutrition");
const settingsRouter = require("./routes/settings");
const statsRouter = require("./routes/stats");
const bodyweightRouter = require("./routes/bodyweight");
const bodyMeasurementsRouter = require("./routes/bodyMeasurements");
const exerciseTemplatesRouter = require("./routes/exerciseTemplates");
const foodItemTemplatesRouter = require("./routes/foodItemTemplates");
const workoutTemplatesRouter = require("./routes/workoutTemplates");
const authRouter = require("./routes/auth");
const programsRouter = require("./routes/programs");

app.use("/api/auth", authRouter);
app.use("/api", requireAuth);
app.use("/api/workouts", workoutsRouter);
app.use("/api/nutrition", nutritionRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/bodyweight", bodyweightRouter);
app.use("/api/body-measurements", bodyMeasurementsRouter);
app.use("/api/exercise-templates", exerciseTemplatesRouter);
app.use("/api/food-item-templates", foodItemTemplatesRouter);
app.use("/api/workout-templates", workoutTemplatesRouter);
app.use("/api/programs", programsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!isAuthEnabled()) {
    console.warn("APP_PASSWORD is not set: the API is open to anyone who can reach it.");
  }
});
