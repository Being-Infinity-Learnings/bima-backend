const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BIMA Backend API",
      version: "1.0.0",
      description: "API documentation for the BIMA backend services.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Firebase ID token passed as a Bearer token.",
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Backend Running" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Forbidden" },
          },
        },
        ValidationErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "fullName must contain at least 2 character(s)" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            firebaseUid: {
              type: "string",
              example: "firebase-user-123",
            },
            email: {
              type: "string",
              nullable: true,
              example: "student@example.com",
            },
            phone: {
              type: "string",
              nullable: true,
              example: "+919999999999",
            },
            fullName: {
              type: "string",
              example: "Gourav Kumar",
            },
            gender: {
              type: "string",
              nullable: true,
              example: "Male",
            },
            collegeName: {
              type: "string",
              nullable: true,
              example: "ABC Institute of Technology",
            },
            rollNumber: {
              type: "string",
              nullable: true,
              example: "BIMA-2026-001",
            },
            role: {
              type: "string",
              enum: ["ADMIN", "AUTHOR", "STUDENT"],
              example: "STUDENT",
            },
            approved: {
              type: "boolean",
              example: false,
            },
            blocked: {
              type: "boolean",
              example: false,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-01T10:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-01T10:30:00.000Z",
            },
          },
        },
        RegisterProfileRequest: {
          type: "object",
          required: ["fullName", "gender", "collegeName", "rollNumber"],
          properties: {
            fullName: {
              type: "string",
              minLength: 2,
              example: "Gourav Kumar",
            },
            gender: {
              type: "string",
              example: "Male",
            },
            collegeName: {
              type: "string",
              example: "ABC Institute of Technology",
            },
            rollNumber: {
              type: "string",
              example: "BIMA-2026-001",
            },
          },
        },
        UserResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        UsersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/User",
              },
            },
          },
        },
        FirebaseAuthUser: {
          type: "object",
          properties: {
            uid: {
              type: "string",
              example: "firebase-user-123",
            },
            email: {
              type: "string",
              nullable: true,
              example: "student@example.com",
            },
            phone_number: {
              type: "string",
              nullable: true,
              example: "+919999999999",
            },
          },
          additionalProperties: true,
        },
        AuthTestResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            firebaseUser: {
              $ref: "#/components/schemas/FirebaseAuthUser",
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./src/modules/**/*.routes.js"],
};

const specs = swaggerJsdoc(options);


const healthRoutes = require("./routes/health.routes");

const authRoutes = require("./modules/auth/auth.routes");

const adminRoutes = require("./modules/admin/admin.routes");

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/admin", adminRoutes);

module.exports = app;
