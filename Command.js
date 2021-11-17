module.exports = class Command {
	#name;
	get name() { return this.#name; }
	#permissions;
	get permissions() { return this.#permissions; }
	#run;
	get run() { return this.#run; }
	#helpText;
	get helpText() { return this.#helpText; }


	constructor(name, permissions, run, helpText) {
		this.#name = name;
		this.#permissions = permissions;
		this.#run = run;
		this.#helpText = helpText;
	}
}
