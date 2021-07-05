const Bot = require("./Bot");

process.on('SIGINT', () => {
	Bot.client.destroy();
});

main();

async function main() {
	console.log("Creating bot...");
	let bot = Bot.create();
}
