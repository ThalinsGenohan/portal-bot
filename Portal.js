const disbut = require('discord-buttons');

let Bot = require("./Bot");

module.exports = class Portal {
	#victim;
	get victim() { return this.#victim; }
	#channel;
	get channel() { return this.#channel; }
	#victimChannel;
	get victimChannel() { return this.#victimChannel; }
	#direct;

	constructor(victim, channel) {
		this.#victim = victim;
		this.#channel = channel;
		this.#direct = channel.type == 'dm';
	}

	static async create(victim, channel) {
		let portal = new Portal(victim, channel);

		portal.#victimChannel = await victim.createDM();

		let success = portal.#victim && portal.#channel && portal.#victimChannel;
		let reply = "";
		if (!success) {
			reply = "ERROR!";
		} else {
			reply = "Portal successfully opened!\n";
			if (portal.#direct) {
				reply += "Because this is direct through DMs, you do not need to prefix your messages.\n";
			} else {
				reply += "Quote text (prefix a line with `> `) to send to the portal victim.\n"
			}
		}
		portal.#channel.send(reply + "```\n" +
						 `Victim:  ${portal.#victim?.tag}\n` +
						 `Channel: ${portal.#channel?.name}\n` +
						 "```");

		if (success) {
			portal.#victim.send("*A portal opens...*");
		}

		let yesBtn = new disbut.MessageButton()
			.setStyle('green')
			.setLabel("Yes")
			.setID(`${victim.id}-yes`);

		let noBtn = new disbut.MessageButton()
			.setStyle('red')
			.setLabel("No")
			.setID(`${victim.id}-no`);

		let buttons = new disbut.MessageActionRow().addComponents([ yesBtn, noBtn ]);

		await portal.#victim.send("Test buttons", buttons);

		Bot.client.on('clickButton', portal.handleButton.bind(portal));

		return portal;
	}

	async destroy() {
		await this.#victim.send("*The portal closes...*");
		await this.#channel.send("*The portal closes...*");

		this.#victim = undefined;
		this.#channel = undefined;
		this.#victimChannel = undefined;
	}

	async handleButton(btn) {
		console.log(btn);
		let id = btn.id;
		if (id == `${this.#victim.id}-yes`) {
			await this.#channel.send("Yes");
		} else if (id == `${this.#victim.id}-no`) {
			await this.#channel.send("No");
		}
	}

	handleMessage(msg) {
		if (msg.channel.id == this.#victimChannel.id) {
			this.#channel.send(msg.content);
		} else if (msg.channel.id == this.#channel.id) {
			let m = msg.content;
			if (!this.#direct) {
				m = msg.content.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
			if (m == "") { return; }
			this.#victim.send(m);
		}
	}

	handleEdit(clientID, oldMsg, newMsg) {
		let m = oldMsg.content;
		let n = newMsg.content;
		let channel;
		if (oldMsg.channel.id == this.#channel.id) {
			channel = this.#victimChannel;
			if (!this.#direct) {
				m = m.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
				n = n.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
		} else if (oldMsg.channel.id == this.#victimChannel.id) {
			channel = this.#channel;
		}

		let messages = channel.messages.cache.map(m => m);
		for (const message of messages) {
			if (m == message.content && clientID == message.author.id) {
				message.edit(newMsg.content);
			}
		}
	}

	handleDelete(clientID, msg) {
		let m = msg.content;

		let channel;
		if (msg.channel.id == this.#channel.id) {
			channel = this.#victimChannel;
			if (!this.#direct) {
				m = m.replace(/^> (.*)|.*/gm, "$1").trim().replace(/\n\n+/g, "\n");
			}
		} else if (msg.channel.id == this.#victimChannel.id) {
			channel = this.#channel;
		}

		let messages = channel.messages.cache.map(m => m);
		for (const message of messages) {
			if (m == message.content && clientID == message.author.id) {
				message.delete();
			}
		}

	}
}
