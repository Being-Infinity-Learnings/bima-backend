// Purpose: In-memory store for active quiz runtimes, plus the custom
// error types used across the runtime module. Kept in one place so
// manager/loader/controller can share them without an extra file.
const activeQuizzes = new Map();

// Base error carrying an explicit HTTP status code.
class RuntimeError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

// 404 - referenced runtime/quiz does not exist in memory or DB
class NotFoundError extends RuntimeError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

// 409 - request conflicts with current state (e.g. already initialized)
class ConflictError extends RuntimeError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

// 400 - caller sent invalid/malformed input
class ValidationError extends RuntimeError {
  constructor(message = "Validation error") {
    super(message, 400);
  }
}

module.exports = {
  activeQuizzes,

  RuntimeError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
