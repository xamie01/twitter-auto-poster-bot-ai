// By VishwaGauravIn (https://itsvg.in)

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { TwitterApi } = require("twitter-api-v2");
const SECRETS = require("./SECRETS");

const twitterClient = new TwitterApi({
  appKey: SECRETS.APP_KEY,
  appSecret: SECRETS.APP_SECRET,
  accessToken: SECRETS.ACCESS_TOKEN,
  accessSecret: SECRETS.ACCESS_SECRET,
});

const generationConfig = {
  maxOutputTokens: 280, // Twitter's max character limit
  temperature: 1.5, // Higher for creative output
};

const genAI = new GoogleGenerativeAI(SECRETS.GEMINI_API_KEY);

async function run() {
  try {
    // Use a stable, supported model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig,
    });

    // Refined prompt for 200–280 characters
    const prompt =
      "Randomly select one cryptocurrency project from Union Build, LayerEdge, or Caldera. Research it and generate a creative Twitter post about it, between 200 and 280 characters, highlighting its unique features and potential impact. If the response exceeds 280 characters, split it into a thread.";

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("Generated text:", text, `\nLength: ${text.length} characters`);

    // Verify character length before tweeting
    if (text.length >= 200 && text.length <= 280) {
      await sendTweet(text);
    } else {
      console.error(`Text length (${text.length}) is outside 200–280 characters.`);
    }
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

async function sendTweet(tweetText) {
  try {
    await twitterClient.v2.tweet(tweetText);
    console.log("Tweet sent successfully!");
  } catch (error) {
    console.error("Error sending tweet:", error);
  }
}

run();
