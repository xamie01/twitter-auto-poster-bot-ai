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
  maxOutputTokens: 70, // Approx. 280 characters (1 token ≈ 4 chars)
  temperature: 1.5, // Keep for creativity
};

const genAI = new GoogleGenerativeAI(SECRETS.GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-002",
      generationConfig,
    });

    const prompt =
      "Randomly select one cryptocurrency project from Union Build, HumanityProtocool, or Caldera. Write a creative Twitter post about its unique features and impact. The post must be 200–280 characters and must not exceed 280 characters under any circumstances.";

    const tokenCount = await model.countTokens(prompt);
    console.log("Prompt token count:", tokenCount.totalTokens);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Truncate to 280 characters if necessary
    if (text.length > 280) {
      text = text.substring(0, 280);
      console.log("Text truncated to 280 characters.");
    }

    console.log("Generated text:", text, `\nLength: ${text.length} characters`);

    if (text.length >= 200 && text.length <= 280) {
      await sendTweet(text);
    } else {
      console.error(`Text length (${text.length}) is outside 200–280 characters.`);
    }
  } catch (error) {
    console.error("Error generating content:", error);
    if (error.status === 429) {
      console.log("Rate limit exceeded. Retrying after 31 seconds...");
      await new Promise(resolve => setTimeout(resolve, 31000));
      await run();
    }
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
