const fs = require("fs");
const Discord = require('discord.js');
let Portal;

const config = require("./config.json");

module.exports = class Bot {
	static #client = new Discord.Client();
	static get client() { return Bot.#client; }
	#portals = {};
	#pendingPortals = {};

	constructor() {
	}

	static async create() {
		let bot = new Bot();

		Bot.client.on('ready', async () => {
			console.info(`Successfully logged in as ${Bot.client.user.tag}`);

			let guilds = Bot.client.guilds.cache.map(g => g);
			for (const guild of guilds) {
				let members = await guild.members.fetch({ force: true });
			}
		});

		process.on('SIGINT', bot.shutdown.bind(bot));

		Bot.client.on('message', bot.handleMessage.bind(bot));
		Bot.client.on('messageUpdate', bot.handleEdit.bind(bot));
		Bot.client.on('messageDelete', bot.handleDelete.bind(bot));
		Bot.client.on('clickButton', bot.handleButton.bind(bot));

		console.info("Logging in...");
		Bot.client.login(config.token);

		require('discord-buttons')(Bot.client);

		return bot;
	}

	async shutdown() {
		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			await this.#portals[p].destroy(true);
		}

		Bot.client.destroy();
		process.exit();
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

		console.info(msg.author.tag + " in " + msg.channel.name + ": " + msg.content);

		const args = msg.content.slice(1).trim().split(' ');
		const comm = args.shift().toLowerCase();

		if (this.#commands[comm]) {
			this.#commands[comm].bind(this)(msg, args);
		}
	}

	async handleEdit(oldMsg, newMsg) {
		if (oldMsg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (oldMsg.channel.id == portal.channel.id || oldMsg.channel.id == portal.victimChannel.id) {
				portal.handleEdit(oldMsg, newMsg);
			}
		}
	}

	async handleDelete(msg) {
		if (msg.author.bot) { return; }

		for (const p in this.#portals) {
			if (!Object.hasOwnProperty.call(this.#portals, p)) { continue; }

			const portal = this.#portals[p];
			if (msg.channel.id == portal.channel.id || msg.channel.id == portal.victimChannel.id) {
				portal.handleDelete(msg);
			}
		}
	}

	async handleButton(btn) {
		for (const p in this.#pendingPortals) {
			if (!Object.hasOwnProperty.call(this.#pendingPortals, p)) { continue; }

			const portal = this.#pendingPortals[p];
			if (btn.clicker.id != portal.victim.id) { continue; }

			let status = "denied";
			if (await portal.handleButton(btn)) {
				this.#portals[p] = portal;
				status = "accepted";
			}
			delete this.#pendingPortals[p];

			console.info(`Portal request ${status}\n` +
			            `  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
			            `  Portal count:  ${Object.keys(this.#portals).length}\n`);
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
					{ name: "Heartbeat", value: `${Bot.client.ws.ping}ms` },
					{ name: "Latency", value: `${sent.createdTimestamp - msg.createdTimestamp}ms` },
					{ name: "Portal Requests", value: Object.keys(this.#pendingPortals).length },
					{ name: "Active Portals", value: Object.keys(this.#portals).length },
				])
				.setFooter("Created by Thalins#0502", Bot.client.user.displayAvatarURL());

			sent.edit("", embed);
		},

		stop: async function(msg) {
			if (msg.author.id != config.owner) { return; }

			Bot.client.destroy();
			process.exit();
		},

		bind: async function(msg, args) {
			if (this.#portals[msg.channel.id]) {
				msg.reply("there's already a portal open here!");
				return;
			}
			if (this.#pendingPortals[msg.channel.id]) {
				msg.reply("there's already a portal request open here!");
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

			let portal = await Portal.create(msg.author, victim, msg.channel, args[1]?.toLowerCase() == 'true');
			if (!portal) {
				return;
			} else {
				this.#pendingPortals[msg.channel.id] = portal;
				console.info(`New portal request opened\n` +
				            `  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
				            `  Portal count:  ${Object.keys(this.#portals).length}\n`);
			}
		},

		unbind: async function(msg) {
			if (this.#portals[msg.channel.id]) {
				await this.#portals[msg.channel.id].destroy();
				delete this.#portals[msg.channel.id];
				console.info(`Portal closed.\n` +
				            `  Request count: ${Object.keys(this.#pendingPortals).length}\n` +
				            `  Portal count: ${Object.keys(this.#portals).length}\n`);
			} else {
				msg.reply("there is no portal bound to this channel!");
			}
		},
	};
}

Portal = require("./Portal");
