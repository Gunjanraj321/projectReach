const express = require("express");
const passport = require("passport");
const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Queue } = require("bullmq");
const { Redis } = require("ioredis");
const axios = require("axios");
const googleCallback = require('../services/oAuth');

// Create Express router
const googlerouter = express.Router();

// Redis connection setup
const connection = new Redis({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  username: "default",
  password: process.env.REDIS_PASS,
},{
  maxRetriesPerRequest: null,
});

// Google AI setup
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Queue setup
const queue = new Queue("gmail-auto-reply-queue", {
  connection: connection,
});

// Function to categorize email
const categorizeEmail = async (email) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `You received an email with the subject: "${email.subject}" and the following content: "${email.body}". Please categorize this email into one of the following categories - Interested, Not Interested, More Information:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const category = await response.text();

    // Ensure the category is one of the expected values
    const validCategories = ["Interested", "Not Interested", "More Information"];
    if (!validCategories.includes(category)) {
      throw new Error("Invalid category generated by AI model.");
    }

    return category;
  } catch (error) {
    console.error("Error categorizing email:", error);
    // Default category in case of error
    return "More Information";
  }
};

// Function to generate auto-reply
const generateAutoReply = async (category, emailSubject, emailBody, fromName, toName) => {
  let request = "";

  switch (category) {
    case "Interested":
      request = `Read ${emailBody} and write an email on behalf of ${toName}, Reachinbox asking ${fromName} if they are willing to hop on to a demo call by suggesting a time from Gunjan kumar`;
      break;
    case "Not Interested":
      request = `Read ${emailBody} and write an email on behalf of ${toName}, Reachinbox thanking ${fromName} for their time and asking them if they would like to be contacted in the future from Gunjan kumar`;
      break;
    case "More Information":
      request = `Read ${emailBody} and write an email on behalf of ${toName}, Reachinbox asking ${fromName} if they would like more information about the product from Gunjan kumar`;
      break;
    default:
      request = `Read ${emailBody} and write an email on behalf of ${toName}, Reachinbox asking ${fromName} if they are willing to hop on to a demo call by suggesting a time Gunjan kumar`;
  }

  return request;
};

// Function to send auto-reply
const sendAutoReply = async (gmail, messageDetails) => {
  const messageId = messageDetails.id;
  const emailSubject = messageDetails.payload.headers.find(
    (header) => header.name === "Subject"
  ).value;
  const emailBody = messageDetails.snippet;

  const category = await categorizeEmail({ subject: emailSubject, body: emailBody });
  console.log("Category:", category);

  const extractNameFromEmail = (emailAddress) => {
    const match = emailAddress.match(/(.+?)\s?<.+>/); // Match the name part before the email address
    return match ? match[1] : emailAddress; // Return the matched name or the full email address if no match
  };

  const toName = extractNameFromEmail(
    messageDetails.payload.headers.find((header) => header.name === "To").value
  );
  const fromName = extractNameFromEmail(
    messageDetails.payload.headers.find((header) => header.name === "From").value
  );

  const request = await generateAutoReply(category, emailSubject, emailBody, fromName, toName);

  // Generate reply using AI model
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = `You received an email with the subject: "${emailSubject}" and the following content: "${emailBody}". ${request}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const generatedReply = await response.text();

  const rawMessage = Buffer.from(
    "To: " +
      messageDetails.payload.headers.find((header) => header.name === "From").value +
      "\r\n" +
      "Subject: Re: " +
      emailSubject +
      "\r\n\r\n" +
      generatedReply
  ).toString("base64");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: rawMessage,
    },
  });

  console.log("Reply sent successfully to email with id:", messageId);
};

// Google authentication route
googlerouter.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ],
    accessType: "offline",
    prompt: "consent",
  })
);

// Google authentication callback route
googlerouter.get(
  "/google/callback",
  passport.authenticate("google"),
  (req, res) => {
    res.redirect("/auth/gmail");
  }
);

// Route to handle Gmail interactions
googlerouter.get("/gmail", async (req, res) => {
  const { accessToken, refreshToken } = req.user.tokens;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/auth/google/callback"
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client,
  });

  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });

    const messages = response.data.messages;
    if (messages.length === 0) {
      console.log("No unread emails found.");
      return res.status(200).send("No unread emails found.");
    }

    for (const message of messages) {
      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });
      await sendAutoReply(gmail, messageDetails.data);
    }

    res.status(200).send("Auto reply enabled successfully!");
  } catch (error) {
    console.error("Error generating or sending reply message:", error);
    res
      .status(500)
      .send("Error generating or sending reply message: " + error.message);
  }
});

// Export the router and callback handler
module.exports = { googlerouter };
