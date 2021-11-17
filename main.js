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
	let dateStr = `${date.getFullYear().toString().padStart(4, "0")}-${date.getMonth().toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}_${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`;
	fs.writeFileSync("crash-logs/crash_" + dateStr + ".log", err + "\n" + err.stack);
	process.exit(1);
});
