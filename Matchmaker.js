const Bot = require("./Bot");
const PortalUser = require("./PortalUser");

class MatchmakingUser extends PortalUser {
	constructor(user, channel, dmChannel) { super(user, channel, dmChannel); }

	static async create(user, channel = undefined) {
		let creatingDM = user.createDM();

		let mmUser = new MatchmakingUser(user, (channel == undefined) ? await creatingDM : channel, await creatingDM);

		return mmUser;
	}
}

module.exports = class Matchmaker {
	#users = {};
	get users() { return this.#users; }
	#victims = {};
	get victims() { return this.#victims; }

	get totalCount() { return Object.keys(this.#users).length + Object.keys(this.#victims).length; }

	constructor() {}

	static async create() {
		let matchmaker = new Matchmaker();

		return matchmaker;
	}

	async addUser(user, channel, victim) {
		if (this.#users[user.id] || this.#victims[user.id]) { return 'dupe'; }

		let mmUser = await MatchmakingUser.create(user, victim ? undefined : channel);
		mmUser.status = 'looking';

		if (!victim) { this.#users[user.id] = mmUser; }
		else { this.#victims[user.id] = mmUser; }

		if (victim) { return 'success-victim'; }
		return 'success';
	}

	removeUser(user) {
		if (!this.#users[user.id] && !this.#victims[user.id]) { return 'noUser'; }

		if (this.#users[user.id]) {
			this.#users[user.id].status = 'idle';
			delete this.#users[user.id];
		} else if (this.#victims[user.id]) {
			this.#victims[user.id].status = 'idle';
			delete this.#victims[user.id];
		}

		return 'success';
	}

	matchUsers() {
		if (Object.keys(this.#users) == 0 || Object.keys(this.#victims) == 0) { return; }

		for (const u in this.#users) {
			if (!Object.hasOwnProperty.call(this.#users, u)) { continue; }

			const user = this.#users[u];
			for (const v in this.#victims) {
				if (!Object.hasOwnProperty.call(this.#victims, v)) { continue; }

				const victim = this.#victims[v];
				// TODO: Compare preferences
				Bot.instance.createPortal(user, victim, user.channel, false);
			}
		}
	}
}
