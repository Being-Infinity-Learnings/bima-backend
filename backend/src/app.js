// Purpose: Configure and export the Express application.
// Registers middleware, Swagger API docs, and mounts feature routes.

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
      description:
        "API documentation for the BIMA backend services.\n\n" +
        "**Authentication**: All protected routes require a Firebase ID token passed as a `Bearer` token in the `Authorization` header.\n\n" +
        "**Roles**: `ADMIN` > `AUTHOR` > `STUDENT`. Each endpoint documents the minimum required role.",
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
          description:
            "Firebase ID token. Obtain via `firebase.auth().currentUser.getIdToken()` on the client and pass as `Authorization: Bearer <token>`.",
        },
      },
      schemas: {
        // ─── Generic Wrappers ───────────────────────────────────────────────
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
            error: {
              type: "string",
              example: "fullName must contain at least 2 character(s)",
            },
          },
        },
        MessageResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  example: "Group deleted successfully",
                },
              },
            },
          },
        },

        // ─── User ───────────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            firebaseUid: { type: "string", example: "firebase-user-123" },
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
            fullName: { type: "string", example: "Gourav Kumar" },
            gender: { type: "string", nullable: true, example: "Male" },
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
            approved: { type: "boolean", example: false },
            blocked: { type: "boolean", example: false },
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
            fullName: { type: "string", minLength: 2, example: "Gourav Kumar" },
            gender: { type: "string", example: "Male" },
            collegeName: {
              type: "string",
              example: "ABC Institute of Technology",
            },
            rollNumber: { type: "string", example: "BIMA-2026-001" },
          },
        },
        UpdateProfileRequest: {
          type: "object",
          properties: {
            fullName: { type: "string", minLength: 2, example: "Gourav Kumar" },
            gender: { type: "string", example: "Male" },
            collegeName: {
              type: "string",
              example: "ABC Institute of Technology",
            },
            rollNumber: { type: "string", example: "BIMA-2026-001" },
          },
        },
        UserResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/User" },
          },
        },
        UsersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/User" },
            },
          },
        },
        FirebaseAuthUser: {
          type: "object",
          properties: {
            uid: { type: "string", example: "firebase-user-123" },
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
            firebaseUser: { $ref: "#/components/schemas/FirebaseAuthUser" },
          },
        },

        // ─── Groups ─────────────────────────────────────────────────────────
        Group: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f",
            },
            name: { type: "string", example: "Batch A" },
            description: {
              type: "string",
              nullable: true,
              example: "Primary student batch for orientation",
            },
            createdById: {
              type: "string",
              format: "uuid",
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-03T10:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-03T10:30:00.000Z",
            },
          },
        },
        GroupCount: {
          type: "object",
          properties: { members: { type: "integer", example: 12 } },
        },
        GroupSummary: {
          allOf: [
            { $ref: "#/components/schemas/Group" },
            {
              type: "object",
              properties: {
                _count: { $ref: "#/components/schemas/GroupCount" },
              },
            },
          ],
        },
        GroupMember: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              example: "6c3aa914-04bb-4d64-876f-f34b9d890df5",
            },
            groupId: {
              type: "string",
              format: "uuid",
              example: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-03T11:00:00.000Z",
            },
            user: { $ref: "#/components/schemas/User" },
            group: { $ref: "#/components/schemas/Group" },
          },
        },
        GroupWithMembers: {
          allOf: [
            { $ref: "#/components/schemas/Group" },
            {
              type: "object",
              properties: {
                members: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      userId: { type: "string", format: "uuid" },
                      groupId: { type: "string", format: "uuid" },
                      createdAt: { type: "string", format: "date-time" },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          fullName: { type: "string" },
                          email: { type: "string", nullable: true },
                          phone: { type: "string", nullable: true },
                          role: {
                            type: "string",
                            enum: ["ADMIN", "AUTHOR", "STUDENT"],
                          },
                          approved: { type: "boolean" },
                          blocked: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
                _count: { $ref: "#/components/schemas/GroupCount" },
              },
            },
          ],
        },
        CreateGroupRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              example: "Batch A",
            },
            description: {
              type: "string",
              maxLength: 500,
              nullable: true,
              example: "Primary student batch for orientation",
            },
          },
        },
        GroupResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/Group" },
          },
        },
        GroupsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/GroupSummary" },
            },
          },
        },
        GroupDetailsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/GroupWithMembers" },
          },
        },
        GroupMembershipResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/GroupMember" },
          },
        },
        GroupMembersResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/User" },
            },
          },
        },
        RemoveGroupMemberResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                message: { type: "string", example: "User removed from group" },
              },
            },
          },
        },
        BulkAssignResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                added: {
                  type: "integer",
                  description: "Number of users successfully added",
                  example: 8,
                },
                skipped: {
                  type: "integer",
                  description: "Number of users already in the group",
                  example: 2,
                },
                notFound: {
                  type: "integer",
                  description: "Number of supplied IDs / identifiers not found",
                  example: 1,
                },
              },
            },
          },
        },

        // ─── Notifications ──────────────────────────────────────────────────
        Notification: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            },
            title: { type: "string", example: "Quiz starts in 10 minutes!" },
            body: {
              type: "string",
              example: "Don't forget to join the upcoming quiz.",
            },
            type: {
              type: "string",
              enum: ["QUIZ_REMINDER", "ANNOUNCEMENT", "CONTEST", "RESULT"],
              example: "QUIZ_REMINDER",
            },
            targetType: {
              type: "string",
              enum: ["ALL", "GROUP", "APPROVED_ONLY"],
              example: "ALL",
            },
            groupId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "Set when targetType is GROUP",
              example: null,
            },
            sendAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Scheduled send time; null means send immediately",
              example: "2026-07-01T10:00:00.000Z",
            },
            sentAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Actual send time; null if not yet sent",
              example: null,
            },
            status: {
              type: "string",
              enum: ["PENDING", "SENT", "FAILED"],
              example: "PENDING",
            },
            createdById: {
              type: "string",
              format: "uuid",
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-25T08:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-25T08:00:00.000Z",
            },
          },
        },
        SendNotificationRequest: {
          type: "object",
          required: ["title", "body", "targetType"],
          properties: {
            title: {
              type: "string",
              example: "Quiz starts in 10 minutes!",
            },
            body: {
              type: "string",
              example: "Don't forget to join the upcoming quiz.",
            },
            type: {
              type: "string",
              enum: ["QUIZ_REMINDER", "ANNOUNCEMENT", "CONTEST", "RESULT"],
              default: "ANNOUNCEMENT",
              example: "QUIZ_REMINDER",
            },
            targetType: {
              type: "string",
              enum: ["ALL", "GROUP", "APPROVED_ONLY"],
              example: "ALL",
            },
            groupId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "Required when targetType is GROUP",
              example: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f",
            },
            sendAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Leave null to send immediately",
              example: "2026-07-01T10:00:00.000Z",
            },
          },
        },
        NotificationListResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Notification" },
            },
            nextCursor: {
              type: "string",
              nullable: true,
              description: "Cursor for the next page; null if no more results",
              example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            },
          },
        },
        RegisterFcmTokenRequest: {
          type: "object",
          required: ["token", "platform"],
          properties: {
            token: {
              type: "string",
              description: "FCM device registration token",
              example: "fMe...long_token_string",
            },
            platform: {
              type: "string",
              enum: ["android", "ios"],
              example: "android",
            },
          },
        },
        FcmTokenResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  example: "FCM token registered successfully",
                },
              },
            },
          },
        },

        // ─── Questions ──────────────────────────────────────────────────────
        QuestionOption: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "c1d2e3f4-0000-0000-0000-000000000001",
            },
            questionId: {
              type: "string",
              format: "uuid",
              example: "b1c2d3e4-0000-0000-0000-000000000001",
            },
            optionText: { type: "string", example: "Paris" },
            isCorrect: { type: "boolean", example: true },
            orderIndex: { type: "integer", example: 0 },
          },
        },
        Question: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "b1c2d3e4-0000-0000-0000-000000000001",
            },
            questionText: {
              type: "string",
              example: "What is the capital of France?",
            },
            questionType: {
              type: "string",
              enum: ["SINGLE_CORRECT", "MULTI_CORRECT", "TEXT", "NUMERIC"],
              example: "SINGLE_CORRECT",
            },
            mediaUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/images/q1.png",
            },
            customTimer: {
              type: "integer",
              nullable: true,
              description:
                "Per-question timer in seconds; overrides quiz defaultTimer when set",
              example: 30,
            },
            createdById: {
              type: "string",
              format: "uuid",
              nullable: true,
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            options: {
              type: "array",
              items: { $ref: "#/components/schemas/QuestionOption" },
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-24T09:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-24T09:00:00.000Z",
            },
          },
        },
        QuestionOptionInput: {
          type: "object",
          required: ["optionText", "isCorrect", "orderIndex"],
          properties: {
            optionText: { type: "string", example: "Paris" },
            isCorrect: { type: "boolean", example: true },
            orderIndex: {
              type: "integer",
              description: "Zero-based display order",
              example: 0,
            },
          },
        },
        QuestionCreate: {
          type: "object",
          required: ["questionText", "questionType", "options"],
          properties: {
            questionText: {
              type: "string",
              example: "What is the capital of France?",
            },
            questionType: {
              type: "string",
              enum: ["SINGLE_CORRECT", "MULTI_CORRECT", "TEXT", "NUMERIC"],
              example: "SINGLE_CORRECT",
            },
            mediaUrl: {
              type: "string",
              nullable: true,
              description: "Public URL of an optional image or media asset",
              example: "https://cdn.example.com/images/q1.png",
            },
            customTimer: {
              type: "integer",
              nullable: true,
              minimum: 1,
              description:
                "Per-question timer override in seconds. Must be > 0 if provided.",
              example: 30,
            },
            options: {
              type: "array",
              minItems: 2,
              items: { $ref: "#/components/schemas/QuestionOptionInput" },
            },
          },
        },
        QuestionUpdate: {
          type: "object",
          description: "All fields are optional; supply only those to change.",
          properties: {
            questionText: {
              type: "string",
              example: "What is the capital of Germany?",
            },
            questionType: {
              type: "string",
              enum: ["SINGLE_CORRECT", "MULTI_CORRECT", "TEXT", "NUMERIC"],
              example: "SINGLE_CORRECT",
            },
            mediaUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/images/q2.png",
            },
            customTimer: {
              type: "integer",
              nullable: true,
              minimum: 1,
              example: 20,
            },
            options: {
              type: "array",
              items: { $ref: "#/components/schemas/QuestionOptionInput" },
            },
          },
        },
        QuestionResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/Question" },
          },
        },
        QuestionsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Question" },
            },
          },
        },

        // ─── Quiz ────────────────────────────────────────────────────────────
        Quiz: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              example: "d1e2f3a4-0000-0000-0000-000000000001",
            },
            title: { type: "string", example: "General Knowledge Quiz" },
            description: {
              type: "string",
              nullable: true,
              example: "A fun quiz on general knowledge topics.",
            },
            coverImageUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/covers/quiz1.jpg",
            },
            visibility: {
              type: "string",
              enum: ["PUBLIC", "RESTRICTED"],
              example: "PUBLIC",
            },
            defaultTimer: {
              type: "integer",
              description: "Default per-question timer in seconds",
              example: 30,
            },
            status: {
              type: "string",
              enum: ["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"],
              example: "DRAFT",
            },
            scheduledStartTime: {
              type: "string",
              format: "date-time",
              example: "2026-07-01T10:00:00.000Z",
            },
            actualStartTime: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: null,
            },
            completedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              example: null,
            },
            createdById: {
              type: "string",
              format: "uuid",
              example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-24T08:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-06-24T08:00:00.000Z",
            },
          },
        },
        QuizCreate: {
          type: "object",
          required: ["title", "defaultTimer", "scheduledStartTime"],
          properties: {
            title: {
              type: "string",
              example: "General Knowledge Quiz",
            },
            description: {
              type: "string",
              nullable: true,
              example: "A fun quiz on general knowledge topics.",
            },
            coverImageUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/covers/quiz1.jpg",
            },
            visibility: {
              type: "string",
              enum: ["PUBLIC", "RESTRICTED"],
              default: "PUBLIC",
              example: "PUBLIC",
            },
            defaultTimer: {
              type: "integer",
              minimum: 1,
              description: "Default per-question timer in seconds (> 0)",
              example: 30,
            },
            scheduledStartTime: {
              type: "string",
              format: "date-time",
              description:
                "ISO 8601 datetime when the quiz is scheduled to start",
              example: "2026-07-01T10:00:00.000Z",
            },
          },
        },
        QuizUpdate: {
          type: "object",
          description: "All fields are optional; supply only those to change.",
          properties: {
            title: { type: "string", example: "Updated Quiz Title" },
            description: {
              type: "string",
              nullable: true,
              example: "Updated description.",
            },
            coverImageUrl: {
              type: "string",
              nullable: true,
              example: "https://cdn.example.com/covers/quiz2.jpg",
            },
            visibility: {
              type: "string",
              enum: ["PUBLIC", "RESTRICTED"],
              example: "RESTRICTED",
            },
            defaultTimer: {
              type: "integer",
              minimum: 1,
              example: 45,
            },
            scheduledStartTime: {
              type: "string",
              format: "date-time",
              example: "2026-08-01T10:00:00.000Z",
            },
          },
        },
        QuizResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/Quiz" },
          },
        },
        QuizzesResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Quiz" },
            },
          },
        },
        AddGroupsToQuizRequest: {
          type: "object",
          required: ["groupIds"],
          properties: {
            groupIds: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                format: "uuid",
                example: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f",
              },
              description: "UUIDs of the groups to grant access to this quiz",
            },
          },
        },
        QuizGroupsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quizId: { type: "string", format: "uuid" },
                  groupId: { type: "string", format: "uuid" },
                  group: { $ref: "#/components/schemas/Group" },
                },
              },
            },
          },
        },
        QuizDeleteResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Quiz deleted" },
          },
        },

        // ─── Quiz Composition ───────────────────────────────────────────────
        AddQuestionsToQuizRequest: {
          type: "object",
          required: ["questionIds"],
          properties: {
            questionIds: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                format: "uuid",
                example: "b1c2d3e4-0000-0000-0000-000000000001",
              },
              description: "UUIDs of questions to add to the quiz",
            },
          },
        },
        ReorderQuestionsRequest: {
          type: "object",
          required: ["questionIds"],
          properties: {
            questionIds: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                format: "uuid",
                example: "b1c2d3e4-0000-0000-0000-000000000001",
              },
              description:
                "Full ordered list of question UUIDs; determines new orderIndex values",
            },
          },
        },
        QuizQuestionMapItem: {
          type: "object",
          properties: {
            quizId: { type: "string", format: "uuid" },
            questionId: { type: "string", format: "uuid" },
            orderIndex: {
              type: "integer",
              description: "Zero-based position in the quiz",
              example: 0,
            },
            question: { $ref: "#/components/schemas/Question" },
          },
        },
        QuizQuestionsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/QuizQuestionMapItem" },
            },
          },
        },
        AddQuestionsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/QuizQuestionMapItem" },
            },
          },
        },

        // ─── Admin ──────────────────────────────────────────────────────────
        BulkApproveRequest: {
          type: "object",
          required: ["userIds"],
          properties: {
            userIds: {
              type: "array",
              minItems: 1,
              items: {
                type: "string",
                format: "uuid",
                example: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b",
              },
              description: "UUIDs of users to approve",
            },
          },
        },
        BulkApproveResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                count: {
                  type: "integer",
                  description: "Number of users approved",
                  example: 5,
                },
              },
            },
          },
        },
        UserGroupsResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string", example: "Batch A" },
                  description: {
                    type: "string",
                    nullable: true,
                    example: "Primary student batch",
                  },
                },
              },
            },
          },
        },
        UpdateRoleRequest: {
          type: "object",
          required: ["role"],
          properties: {
            role: {
              type: "string",
              enum: ["ADMIN", "AUTHOR", "STUDENT"],
              description: "New role to assign to the user",
              example: "AUTHOR",
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

const groupRoutes = require("./modules/groups/group.routes");

const notificationRoutes = require("./modules/notifications/notification.routes");

const questionRoutes = require("./modules/question/question.routes");

const quizRoutes = require("./modules/quiz/quiz.routes");

const quizCompositionRoutes = require("./modules/quiz-composition/quiz-composition.routes");

const runtimeRoutes = require("./modules/runtime/runtime.routes");

const analyticsRoutes = require("./modules/analytics/analytics.routes");

const app = express();

app.use(cors());
app.use(helmet());
// Raised from the default 100kb limit: quiz/question create & update payloads
// now carry base64-encoded cover/question images inline (see image.service.js),
// so the body can be a few MB for a single request.
app.use(express.json({ limit: "8mb" }));
app.use(morgan("dev"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/admin", adminRoutes);

app.use("/groups", groupRoutes);

app.use("/notifications", notificationRoutes);

app.use("/question", questionRoutes);

app.use("/quiz", quizRoutes);

app.use("/quiz-composition", quizCompositionRoutes);

app.use("/runtime", runtimeRoutes);

app.use("/analytics", analyticsRoutes);

module.exports = app;
