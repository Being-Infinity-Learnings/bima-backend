const { io } = require("socket.io-client");

const TOKEN =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjJmMjk1MGEyNGFlYWRkMjYzYzIxM2I2MDNhZjMxNWEzMjdiNmM3MjAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYmVpbmdpbmZpbml0eS0zNmIyMSIsImF1ZCI6ImJlaW5naW5maW5pdHktMzZiMjEiLCJhdXRoX3RpbWUiOjE3ODI3MDkzMzQsInVzZXJfaWQiOiJtenkxcWxwZ24yZEdlU2VtbGJ0QjhENjJGZHcyIiwic3ViIjoibXp5MXFscGduMmRHZVNlbWxidEI4RDYyRmR3MiIsImlhdCI6MTc4Mjc5NzcyMCwiZXhwIjoxNzgyODAxMzIwLCJwaG9uZV9udW1iZXIiOiIrOTE3NTIzMDAwMDAwIiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJwaG9uZSI6WyIrOTE3NTIzMDAwMDAwIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGhvbmUifX0.H4EHKmxH7dWiRD6UgoFeAnJ8bchdZMXE9ZP7SoMdfhL0lUWeHz5lvWhCkRUAwTZC13J6DYMP6KSdIZxj8vtcy1nfPAqExvckgUbSuVfXDVFGYAPt11jOWS7bqbYaKTHSNU_8nzJsv104ziJSncB9akLPFHkzBWaWZDXQVNPlLUrvUUfyuOo12xo7X9xGRp-orwW4kSAEfN26oV942Hv2MLPZBnyKMTYHnL_eJDuP__gI9xf4lhtH4Q5S52RFat5UjxukkC8hJGu3Ky6yCiwHgUl1ONAfXCkFadpq_xeZNotoJfzn8RE7wZ-x0wC0yuPcXJHdmdHzUvBl23-av3BurA";

const socket = io("http://localhost:3000", {
  auth: {
    token: TOKEN,
  },
});

socket.on("connect", () => {
  console.log("Connected");

  socket.emit("joinQuiz", {
    quizId: "12de33ee-5251-47af-a6f7-7fbe07a81baa",
  });
});
socket.on("connect_error", (err) => {
  console.log("❌ Connection Error");
  console.log(err.message);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

socket.on("quizJoined", (payload) => {
  console.log("Quiz Joined");
  console.log(payload);
});

socket.on("runtimeUpdated", (payload) => {
  console.log("\n========== Runtime Updated ==========");
  console.dir(payload.data, { depth: null });

  if (payload.data.phase !== "QUESTION") {
    return;
  }

  const question = payload.data.question;

  if (!question) {
    return;
  }

  // Pick the first option for testing.
  socket.emit("submitAnswer", {
    questionId: question.id,

    selectedOptionIds: [question.options[0].id],
  });
});

socket.on("answerSubmitted", (payload) => {
  console.log("\n===== ANSWER SUBMITTED =====");

  console.dir(payload.data, {
    depth: null,
  });
});

socket.on("answerSubmissionError", (payload) => {
  console.log("\nAnswer Error", payload);
});

socket.on("joinQuizError", (payload) => {
  console.log("Join Failed", payload);
});
