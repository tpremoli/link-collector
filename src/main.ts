import { MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	LinkCollectorSettings,
	LinkCollectorSettingTab,
	normalizeSettings,
} from './settings';
import { syncLinksForFile, syncLinksForMarkdown } from './sync';

const DEFAULT_SYNC_DELAY_MS = 500;
const PASTE_SYNC_DELAY_MS = 250;

export default class LinkCollectorPlugin extends Plugin {
	settings!: LinkCollectorSettings;

	private readonly syncTimers = new Map<string, number>();
	private readonly syncingFiles = new Set<string>();

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new LinkCollectorSettingTab(this.app, this));

		this.addCommand({
			id: 'sync-current-note',
			name: 'Sync links in current note',
			callback: () => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				const file = markdownView?.file ?? this.app.workspace.getActiveFile();

				if (!file) {
					new Notice('No active note to sync.');
					return;
				}

				if (markdownView?.file === file) {
					void this.syncMarkdown(file, markdownView.editor.getValue(), true);
					return;
				}

				void this.syncFile(file, true);
			},
		});

		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, info) => {
				if (!(info.file instanceof TFile) || info.file.extension !== 'md') {
					return;
				}

				this.scheduleSync(info.file, DEFAULT_SYNC_DELAY_MS, editor.getValue());
			}),
		);

		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') {
					return;
				}

				if (this.syncingFiles.has(file.path)) {
					return;
				}

				this.scheduleSync(file, DEFAULT_SYNC_DELAY_MS);
			}),
		);

		this.registerDomEvent(activeDocument, 'paste', () => {
			window.setTimeout(() => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

				if (markdownView?.file) {
					void this.syncMarkdown(
						markdownView.file,
						markdownView.editor.getValue(),
						false,
					);
				}
			}, PASTE_SYNC_DELAY_MS);
		});
	}

	onunload() {
		for (const timer of this.syncTimers.values()) {
			window.clearTimeout(timer);
		}

		this.syncTimers.clear();
		this.syncingFiles.clear();
	}

	async loadSettings() {
		this.settings = normalizeSettings(
			Object.assign(
				{},
				DEFAULT_SETTINGS,
				(await this.loadData()) as Partial<LinkCollectorSettings>,
			),
		);
	}

	async saveSettings() {
		await this.saveData(normalizeSettings(this.settings));

		const file = this.app.workspace.getActiveFile();

		if (file) {
			this.scheduleSync(file, DEFAULT_SYNC_DELAY_MS);
		}
	}

	scheduleSync(file: TFile, delayMs: number, markdown?: string) {
		const existingTimer = this.syncTimers.get(file.path);

		if (existingTimer !== undefined) {
			window.clearTimeout(existingTimer);
		}

		const timer = window.setTimeout(() => {
			this.syncTimers.delete(file.path);

			if (markdown !== undefined) {
				void this.syncMarkdown(file, markdown, false);
				return;
			}

			void this.syncFile(file, false);
		}, delayMs);

		this.syncTimers.set(file.path, timer);
	}

	private async syncFile(file: TFile, showNotice: boolean) {
		if (file.extension !== 'md' || this.syncingFiles.has(file.path)) {
			return;
		}

		this.syncingFiles.add(file.path);

		try {
			const changed = await syncLinksForFile(this.app, file, this.settings);

			if (showNotice) {
				new Notice(changed ? 'Link properties updated.' : 'Link properties already up to date.');
			}
		} catch (error) {
			console.error('Link Collector failed to sync links.', error);

			if (showNotice) {
				new Notice('Link collector could not sync this note.');
			}
		} finally {
			this.syncingFiles.delete(file.path);
		}
	}

	private async syncMarkdown(file: TFile, markdown: string, showNotice: boolean) {
		if (file.extension !== 'md' || this.syncingFiles.has(file.path)) {
			return;
		}

		this.syncingFiles.add(file.path);

		try {
			const changed = await syncLinksForMarkdown(
				this.app,
				file,
				markdown,
				this.settings,
			);

			if (showNotice) {
				new Notice(changed ? 'Link properties updated.' : 'Link properties already up to date.');
			}
		} catch (error) {
			console.error('Link Collector failed to sync links.', error);

			if (showNotice) {
				new Notice('Link collector could not sync this note.');
			}
		} finally {
			this.syncingFiles.delete(file.path);
		}
	}
}
