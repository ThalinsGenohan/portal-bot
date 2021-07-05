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
		let reply ="";
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

		if (success) { portal.#victim.send("*A portal opens...*"); }
		return portal;
	}

	destroy() {
		this.#victim.send("*The portal closes...*");
		this.#channel.send("*The portal closes...*");

		this.#victim = undefined;
		this.#channel = undefined;
		this.#victimChannel = undefined;
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
