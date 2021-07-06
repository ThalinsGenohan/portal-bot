const Bot = require("./Bot");

if (!String.prototype.format) {
	String.prototype.format = function() {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) {
			return typeof args[number] != 'undefined'
				? args[number]
				: match;
		});
	};
}

main();

async function main() {
	console.log("Creating bot...");
	let bot = Bot.create();
}
