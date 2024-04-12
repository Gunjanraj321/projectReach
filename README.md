# Gmail Auto Reply Bot

This project is a Gmail auto-reply bot that automatically categorizes incoming unread emails and sends appropriate replies based on their content using Google's Generative AI. Its on developing stage .

## Features

- Automatically categorizes incoming emails into three categories: Interested, Not Interested, More Information.
- Generates personalized replies using Google's Generative AI model based on the categorized emails.
- Integrates with Google OAuth for authentication and Gmail API for accessing and sending emails.

## Installation

 ** Clone the repository : Install dependencies **
 
  - git clone https://github.com/Gunjanraj321/projectReach
  - npm install


## Set up environment variables:
 Mysql
- DB_HOST=""
- DB_USER=""
- DB_PASSWORD=""
- DB_NAME=""

 Gemini AI
- API_KEY=''

 Google Auth API
- GOOGLE_CLIENT_ID = ""
- GOOGLE_CLIENT_SECRET = ""

 Redis API
- REDIS_PORT=""
- REDIS_HOST=""
- REDIS_PASS=""

## Usage :
 Run the Application:
- npm start

  Navigate to http://localhost:3000/google in your browser to authenticate with Google and grant access to your Gmail account.
After authentication, the bot will automatically categorize and reply to incoming emails in your Gmail inbox.


## Dependencies
- Express.js: For building the web server.
- Passport.js: For handling authentication with Google OAuth.
- @google/generative-ai: Google's Generative AI library for generating text.
- googleapis: Official Node.js client library for Google APIs.
- bullmq: For creating queues and workers for background tasks.
- ioredis: Redis client library for Node.js.
