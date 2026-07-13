// Purpose: Custom error types used across the runtime module.
//
// NOTE: this file previously also held the in-memory `activeQuizzes` Map
// that stored all active runtimes in process memory. That Map has been
// removed — runtime state now lives in Redis (see runtime.store.js) so it
// is shared across every app instance and survives process restarts,
// which is required for horizontal scaling.

// Base error carrying an explicit HTTP status code.
class RuntimeError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

// 404 - referenced runtime/quiz does not exist in Redis or DB
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
  RuntimeError,
  NotFoundError,
  ConflictError,
  ValidationError,
};
