// Manual test — console.log leaks. DELETE after testing.
const apiKey = process.env.OPENAI_API_KEY;
console.log(apiKey);
console.log(process.env.STRIPE_SECRET_KEY);
logger.debug(token);
