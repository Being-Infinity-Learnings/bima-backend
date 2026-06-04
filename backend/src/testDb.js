const prisma = require("./config/prisma");

async function main() {
  const users = await prisma.user.findMany();

  console.log(users);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
  });
