const fs = require('fs');
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
	let bot = Bot.create();
}

process.on("uncaughtException", function(err){
	let date = new Date();
	fs.writeFileSync("crash_" + date.toLocaleString() + ".log", err + "\n" + err.stack);
	process.exit(1);
});
