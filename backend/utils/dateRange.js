const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDayRange(date) {
  const start = new Date(date);
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { gte: start, lt: end };
}

module.exports = { getDayRange };
