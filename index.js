// By VishwaGauravIn (https://itsvg.in)

const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");
const SECRETS = require("./SECRETS");

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: SECRETS.APP_KEY,
  appSecret: SECRETS.APP_SECRET,
  accessToken: SECRETS.ACCESS_TOKEN,
  accessSecret: SECRETS.ACCESS_SECRET,
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(SECRETS.GEMINI_API_KEY);

// Thread counter file
const THREAD_COUNT_FILE = "thread-count.json";

// Load or initialize thread counter
async function loadThreadCount() {
  try {
    const data = await fs.readFile(THREAD_COUNT_FILE, "utf8");
    const { count, date } = JSON.parse(data);
    const today = new Date().toISOString().split("T")[0];
    if (date !== today) return { count: 0, date: today };
    return { count, date };
  } catch {
    return { count: 0, date: new Date().toISOString().split("T")[0] };
  }
}

// Save thread counter
async function saveThreadCount(count, date) {
  await fs.writeFile(THREAD_COUNT_FILE, JSON.stringify({ count, date }));
}

// Get random image from project folder
async function getRandomImage(project) {
  try {
    // Map project names to folder names (replace spaces and special chars)
    const folderName = project.replace(/[^a-zA-Z0-9]/g, "");
    const folderPath = path.join(__dirname, folderName);
    const files = await fs.readdir(folderPath);
    // Filter for image files (jpg, jpeg, png)
    const images = files.filter(file =>
      /\.(jpg|jpeg|png)$/i.test(file)
    );
    if (images.length === 0) {
      console.warn(`No images found in ${folderPath}`);
      return null;
    }
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imagePath = path.join(folderPath, randomImage);
    return await fs.readFile(imagePath); // Return image buffer
  } catch (error) {
    console.error(`Error reading image from ${project} folder:`, error.message);
    return null;
  }
}

async function uploadImage(imageBuffer) {
  try {
    const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: "image/jpeg" });
    return mediaId;
  } catch (error) {
    console.error("Error uploading image:", error.message);
    return null;
  }
}

async function run() {
  try {
    const projects = ["Union Build", "HumanityProtocool", "MagicNewton", "Caldera"];
    const selectedProject = projects[Math.floor(Math.random() * projects.length)];

    // Load thread counter
    const { count: dailyThreadCount, date } = await loadThreadCount();

    // Decide if thread (2/6 chance, max 2/day)
    const isThread = dailyThreadCount < 2 && Math.random() < 0.3333;

    let mediaId = null;
    if (isThread) {
      await saveThreadCount(dailyThreadCount + 1, date);
      const imageBuffer = await getRandomImage(selectedProject);
      if (imageBuffer) mediaId = await uploadImage(imageBuffer);
      if (!mediaId) console.warn(`No image uploaded for ${selectedProject}; posting thread without image`);
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig: {
        maxOutputTokens: isThread ? 500 : 100,
        temperature: 1.5,
      },
    });

    // Prompt
    const prompt = isThread
      ? `Crypto bro hyping X community. Write a 2-3 tweet thread about ${selectedProject}'s features, why it’ll moon. Use slang (Zkgm, Gmera, gNewt, GHuman), #Web3, #${selectedProject.replace(/[^a-zA-Z0-9]/g, "")}, end with CTA. Each tweet 200–280 chars. Separate with ###.`
      : `Crypto bro hyping X community. Write a single tweet about ${selectedProject}'s features, why it’ll moon. Use slang (Zkgm, Gmera, gNewt, GHuman), #Web3, #${selectedProject.replace(/[^a-zA-Z0-9]/g, "")}, end with CTA. 200–280 chars.`;

    const tokenCount = await model.countTokens(prompt);
    console.log("Prompt token count:", tokenCount.totalTokens);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let tweets = response.text().trim();

    // Parse response
    tweets = isThread
      ? tweets.split("###").map(t => t.trim()).filter(t => t.length)
      : [tweets];

    // Truncate to 280 chars
    tweets = tweets.map(t => (t.length > 280 ? t.slice(0, 280) : t));

    console.log(`Generated ${isThread ? "thread" : "tweet"}:`, tweets, `Lengths: ${tweets.map(t => t.length).join(", ")} chars`);

    // Post tweets
    let previousTweetId = null;
    for (let i = 0; i < tweets.length; i++) {
      if (tweets[i].length >= 200 && tweets[i].length <= 280) {
        const postOptions = {
          text: tweets[i],
          ...(isThread && i === 0 && mediaId ? { media: { media_ids: [mediaId] } } : {}),
          ...(previousTweetId ? { reply: { in_reply_to_status_id: previousTweetId } } : {}),
        };
        const tweet = await twitterClient.v2.tweet(postOptions);
        console.log(`Tweet ${i + 1} posted!`);
        previousTweetId = tweet.data.id;
      } else {
        console.error(`Tweet ${i + 1} length (${tweets[i].length}) outside 200–280 chars. Skipped.`);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.status === 429 || error.response?.status === 429) {
      console.log("Rate limit hit. Retry in 31s...");
      await new Promise(r => setTimeout(r, 31000));
      await run();
    }
  }
}

run();





