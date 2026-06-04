// This file Initializes and export a single Prisma Client instance.
// Other modules should import this to perform database queries using
// Prisma.

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
