const Bot = require("./Bot");
const PortalUser = require("./PortalUser");
const fs = require('fs/promises');
require('json5/lib/register');

const userPreferences = require("./userPrefs.json5");

const msg_initPrefs = "You must set your preferences before queuing!";

class MatchmakingUser extends PortalUser {
	static defaultPrefs = {
		mouth: {
			yours:  false,
			others: false,
		},
		boobs: {
			yours:  false,
			others: false,
		},
		penis: {
			yours:  false,
			others: false,
		},
		vagina: {
			yours:  false,
			others: false,
		},
		anus: {
			yours:  false,
			others: false,
		},
		herm: {
			yours:  false,
			others: false,
		},
	};

	preferences = undefined;

	constructor(user, channel, dmChannel) { super(user, channel, dmChannel); }

	static async create(user, channel = undefined) {
		let creatingDM = user.createDM();

		let mmUser = new MatchmakingUser(user, (channel == undefined) ? await creatingDM : channel, await creatingDM);

		mmUser.preferences = mmUser.getPreferences();
		if (mmUser.preferences == undefined) {
			mmUser.editPreferences();
		}

		return mmUser;
	}

	getPreferences() {
		for (const p in userPreferences) {
			if (!Object.hasOwnProperty.call(userPreferences, p)) { continue; }
			if (p == this.id) { return userPreferences[p]; }
		}
		this.dmChannel.send(msg_initPrefs);
		return undefined;
	}

	editPreferences() {
		this.dmChannel.send("Not yet finished.");
	}

	savePreferences() {
		let prefCode = 0;

		let i = Object.keys.length - 1;
		for (const p in this.preferences) {
			if (!Object.hasOwnProperty.call(this.preferences, p)) { continue; }

			const pref = this.preferences[p];
			if (pref.yours)  prefCode += 1 << i;
			i--;
			if (pref.others) prefCode += 1 << i;
			i--;
		}
		console.log(this.preferences);
		console.log(prefCode.toString(16).padStart(3, '0'));
	}

	loadPreferences() {

	}
}

module.exports = {
	Matchmaker: class Matchmaker {
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

				this.removeUser(user);
				this.removeUser(victim);
			}
		}
	}
},
MatchmakingUser: MatchmakingUser,
}
