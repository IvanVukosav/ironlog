const test = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { HttpError, describeError } = require("./errorHandler");

const prismaError = (code, meta) =>
  new Prisma.PrismaClientKnownRequestError("from prisma", { code, clientVersion: "test", meta });

test("an HttpError answers with its own status and message", () => {
  assert.deepEqual(describeError(new HttpError(400, "id must be a whole number")), {
    status: 400,
    message: "id must be a whole number",
  });
});

test("Prisma's missing record is a 404 and a duplicate a 409 naming the model", () => {
  assert.deepEqual(describeError(prismaError("P2025")), { status: 404, message: "Not found" });
  assert.deepEqual(describeError(prismaError("P2002", { modelName: "ExerciseTemplate" })), {
    status: 409,
    message: "Exercise template already exists",
  });
  assert.deepEqual(describeError(prismaError("P2002", { modelName: "Program" })), {
    status: 409,
    message: "Program already exists",
  });
});

test("body parsing failures keep their statuses", () => {
  assert.deepEqual(describeError(Object.assign(new Error("x"), { type: "entity.parse.failed" })), {
    status: 400,
    message: "Malformed JSON",
  });
  assert.deepEqual(describeError(Object.assign(new Error("x"), { type: "entity.too.large" })), {
    status: 413,
    message: "Request body too large",
  });
});

test("anything else is a 500 that says nothing about itself", () => {
  assert.deepEqual(describeError(new Error("database on fire")), {
    status: 500,
    message: "Internal server error",
  });
});
