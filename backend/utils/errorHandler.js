const { Prisma } = require("@prisma/client");

// Thrown by the validation helpers; the handler below turns it into the response.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// "ExerciseTemplate" -> "Exercise template".
function modelLabel(err) {
  const name = err.meta?.modelName ?? "Record";
  return name.replace(
    /([a-z])([A-Z])/g,
    (match, before, after) => `${before} ${after.toLowerCase()}`,
  );
}

function describeError(err) {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return { status: 404, message: "Not found" };
    if (err.code === "P2002") return { status: 409, message: `${modelLabel(err)} already exists` };
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: "Request does not fit the data" };
  }
  // express.json() failures.
  if (err.type === "entity.parse.failed") return { status: 400, message: "Malformed JSON" };
  if (err.type === "entity.too.large") return { status: 413, message: "Request body too large" };
  return { status: 500, message: "Internal server error" };
}

// Every route's failures end up here (Express 5 forwards rejected promises): validation says
// what is wrong, Prisma says what is missing or already there, anything else is a 500 that is
// logged but not described to the client. Four parameters: that is how Express tells an error
// handler apart from the other middleware.
function errorHandler(err, req, res, next) {
  const { status, message } = describeError(err);
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
}

module.exports = { HttpError, describeError, errorHandler };
