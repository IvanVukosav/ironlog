const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
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
const exerciseTemplatesRouter = require("./routes/exerciseTemplates");

app.use("/api/workouts", workoutsRouter);
app.use("/api/nutrition", nutritionRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/bodyweight", bodyweightRouter);
app.use("/api/exercise-templates", exerciseTemplatesRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
