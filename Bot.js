const fs = require("fs");
const Discord = require('discord.js');
const Portal = require('./Portal');

module.exports = class Bot {
	static #client = new Discord.Client();
	static get client() { return Bot.#client; }
	#portals = {};

	constructor() {
	}

	static async create() {
		let bot = new Bot();

		Bot.client.on('ready', async () => {
			console.log(`Successfully logged in as ${Bot.client.user.tag}`);

			let guilds = Bot.client.guilds.cache.map(g => g);
			for (const guild of guilds) {
				let members = await guild.members.fetch({ force: true });
			}
		});

		process.on('SIGINT', bot.shutdown.bind(bot));

		Bot.client.on('message', bot.handleMessage.bind(bot));
		Bot.client.on('messageUpdate', bot.handleEdit.bind(bot));
		Bot.client.on('messageDelete', bot.handleDelete.bind(bot));

		console.log("Logging in...");
		let token = fs.readFileSync("./token.txt", { encoding: 'utf-8' }).trim();
		Bot.client.login(token);

		return bot;
	}

	async shutdown() {
		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];

			// TODO: Better portal close message for bot shutdown
			await portal.destroy();
		}

		Bot.client.destroy();
	}

	async handleMessage(msg) {
		if (msg.author.bot) { return; }

		if (msg.content[0] == '!') { this.handleCommand(msg); return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			portal.handleMessage(msg);
		}
	}

	async handleCommand(msg) {
		if (msg.author.bot) { return; }

		console.log(msg.author.tag + " in " + msg.channel.name + ": " + msg.content);

		const args = msg.content.slice(1).trim().split(' ');

		this.#commands[args.shift().toLowerCase()].bind(this)(msg, args);
	}

	async handleEdit(oldMsg, newMsg) {
		if (oldMsg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (oldMsg.channel.id == portal.channel.id || oldMsg.channel.id == portal.victimChannel.id) {
				portal.handleEdit(Bot.client.user.id, oldMsg, newMsg);
			}
		}
	}

	async handleDelete(msg) {
		if (msg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (msg.channel.id == portal.channel.id || msg.channel.id == portal.victimChannel.id) {
				portal.handleDelete(Bot.client.user.id, msg);
			}
		}
	}

	#commands = {
		help: async function(msg) {
			let helpMessage = 'Usage: `!bind <"victim" ID>`\n' +
			'`"victim" ID`: The ID of the user that is partway through the portal';
			msg.channel.send(helpMessage);
		},

		status: async function(msg) {
			let sent = await msg.channel.send("Checking status...");

			let embed = new Discord.MessageEmbed()
				.setTitle("Status")
				.setColor(0x000000)
				.setTimestamp(Date.now())
				.setAuthor("Hoopa Bot", "", "https://github.com/ThalinsGenohan/portal-bot")
				.addFields([
					{ name: "Heartbeat", value: `${Bot.client.ws.ping}ms`, inline: true },
					{ name: "Latency", value: `${sent.createdTimestamp - msg.createdTimestamp}ms`, inline: true },
					{ name: "Active Portals", value: Object.keys(this.#portals).length, inline: true },
				])
				.setFooter("Created by Thalins#0502", Bot.client.user.displayAvatarURL());

			sent.edit("", embed);
		},

		stop: async function() {
			Bot.client.destroy();
			process.exit();
		},

		bind: async function(msg, args) {
			if (this.#portals[msg.channel.id]) {
				msg.reply("there's already a portal open here!");
				return;
			}
			let victim = Bot.client.users.cache.find(u =>
				u.username.toLowerCase() == args[0].toLowerCase() ||
				u.tag.toLowerCase() == args[0].toLowerCase() ||
				u.id.toLowerCase() == args[0].toLowerCase() ||
				u.id.toLowerCase() == args[0].toLowerCase().replace(/<@!?/, "").replace(/>+/, "")
			);

			if (!victim) {
				msg.reply("user not found!");
				return;
			}

			if (victim.bot) {
				msg.reply("can't open a portal for a bot!");
				return;
			}

			let portal = await Portal.create(victim, msg.channel);
			if (!portal) {
				return;
			} else {
				this.#portals[msg.channel.id] = portal;
				console.log(`New portal opened.\n` +
				            `  Portal count: ${Object.keys(this.#portals).length}`);
			}
		},

		unbind: async function(msg) {
			if (this.#portals[msg.channel.id]) {
				await this.#portals[msg.channel.id].destroy();
				delete this.#portals[msg.channel.id];
				console.log(`Portal closed.\n` +
				            `  Portal count: ${Object.keys(this.#portals).length}`);
			} else {
				msg.reply("there is no portal bound to this channel!");
			}
		},
	};
}
