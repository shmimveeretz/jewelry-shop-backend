// Error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error("Error:", err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "מזהה לא תקין";
    error = { statusCode: 404, message };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} כבר קיים במערכת`;
    error = { statusCode: 400, message };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error = { statusCode: 400, message };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "טוקן לא תקין";
    error = { statusCode: 401, message };
  }

  if (err.name === "TokenExpiredError") {
    const message = "טוקן פג תוקף";
    error = { statusCode: 401, message };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "שגיאת שרת",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// Not found handler
export const notFound = (req, res, next) => {
  const error = new Error(`לא נמצא - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
