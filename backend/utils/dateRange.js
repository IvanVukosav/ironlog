const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

function getDayRange(date) {
  const start = new Date(date);
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { gte: start, lt: end };
}

function getWeekRange(date) {
  const referenceDate = new Date(date);
  const dayOfWeek = referenceDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? DAYS_PER_WEEK - 1 : dayOfWeek - 1;
  const monday = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate() - daysSinceMonday,
    ),
  );
  const nextMonday = new Date(monday.getTime() + DAYS_PER_WEEK * MS_PER_DAY);
  return { gte: monday, lt: nextMonday };
}

function getMonthRange(date) {
  const referenceDate = new Date(date);
  const start = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1),
  );
  return { gte: start, lt: end };
}

function getYearRange(date) {
  const referenceDate = new Date(date);
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear() + 1, 0, 1));
  return { gte: start, lt: end };
}

module.exports = { getDayRange, getWeekRange, getMonthRange, getYearRange };
