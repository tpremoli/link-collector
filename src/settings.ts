import { App, PluginSettingTab, Setting } from 'obsidian';
import type LinkCollectorPlugin from './main';

export type LinkSaveMode = 'first' | 'all';

export interface LinkRule {
	id: string;
	propertyName: string;
	matcher: string;
	saveMode: LinkSaveMode;
	enabled: boolean;
}

export interface LinkCollectorSettings {
	rules: LinkRule[];
}

export const DEFAULT_SETTINGS: LinkCollectorSettings = {
	rules: [],
};

const SAVE_MODE_LABELS: Record<LinkSaveMode, string> = {
	first: 'First link',
	all: 'All links',
};

export function normalizeSettings(
	settings: Partial<LinkCollectorSettings>,
): LinkCollectorSettings {
	const rawRules = Array.isArray(settings.rules) ? settings.rules : [];

	return {
		rules: rawRules.map((rule) => normalizeRule(rule)),
	};
}

function normalizeRule(rule: Partial<LinkRule>): LinkRule {
	return {
		id: typeof rule.id === 'string' && rule.id.length > 0 ? rule.id : createRuleId(),
		propertyName: typeof rule.propertyName === 'string' ? rule.propertyName : '',
		matcher: typeof rule.matcher === 'string' ? rule.matcher : '',
		saveMode: rule.saveMode === 'all' ? 'all' : 'first',
		enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
	};
}

function createRuleId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class LinkCollectorSettingTab extends PluginSettingTab {
	private readonly plugin: LinkCollectorPlugin;

	constructor(app: App, plugin: LinkCollectorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass('link-collector-settings');

		new Setting(containerEl)
			.setName('Link collector')
			.setDesc('Create rules that map matching links in a note body to frontmatter properties.')
			.setHeading();

		for (const rule of this.plugin.settings.rules) {
			this.renderRule(rule);
		}

		new Setting(containerEl)
			.setName('Add rule')
			.setDesc('Use wildcard matching. For example, arm.jira.com or *youtube*.')
			.addButton((button) =>
				button
					.setButtonText('Add rule')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.rules.push({
							id: createRuleId(),
							propertyName: '',
							matcher: '',
							saveMode: 'first',
							enabled: true,
						});
						await this.plugin.saveSettings();
						this.display();
					}),
			);
	}

	private renderRule(rule: LinkRule): void {
		const setting = new Setting(this.containerEl)
			.setName(rule.propertyName.trim().length > 0 ? rule.propertyName : 'New link rule')
			.setDesc('Match links and save them to this property.');

		setting.addToggle((toggle) =>
			toggle
				.setTooltip('Enable rule')
				.setValue(rule.enabled)
				.onChange(async (value) => {
					rule.enabled = value;
					await this.plugin.saveSettings();
				}),
		);

		setting.addText((text) =>
			text
				.setPlaceholder('Property, for example jira')
				.setValue(rule.propertyName)
				.onChange(async (value) => {
					rule.propertyName = value;
					await this.plugin.saveSettings();
					setting.setName(value.trim().length > 0 ? value : 'New link rule');
				}),
		);

		setting.addText((text) =>
			text
				.setPlaceholder('Matcher, for example arm.jira.com or *youtube*')
				.setValue(rule.matcher)
				.onChange(async (value) => {
					rule.matcher = value;
					await this.plugin.saveSettings();
				}),
		);

		setting.addDropdown((dropdown) => {
			for (const [value, label] of Object.entries(SAVE_MODE_LABELS)) {
				dropdown.addOption(value, label);
			}

			dropdown
				.setValue(rule.saveMode)
				.onChange(async (value) => {
					rule.saveMode = value === 'all' ? 'all' : 'first';
					await this.plugin.saveSettings();
				});
		});

		setting.addButton((button) =>
			button
				.setIcon('trash')
				.setTooltip('Remove rule')
				.onClick(async () => {
					this.plugin.settings.rules = this.plugin.settings.rules.filter(
						(existingRule) => existingRule.id !== rule.id,
					);
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}
}
