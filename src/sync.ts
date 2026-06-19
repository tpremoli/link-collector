import { App, TFile } from 'obsidian';
import { collectLinksForRules } from './link-extractor';
import { LinkCollectorSettings, LinkRule } from './settings';

type FrontmatterValue = string | string[] | undefined;

export async function syncLinksForFile(
	app: App,
	file: TFile,
	settings: LinkCollectorSettings,
): Promise<boolean> {
	const markdown = await app.vault.cachedRead(file);

	return syncLinksForMarkdown(app, file, markdown, settings);
}

export async function syncLinksForMarkdown(
	app: App,
	file: TFile,
	markdown: string,
	settings: LinkCollectorSettings,
): Promise<boolean> {
	const rules = getValidRules(settings.rules);

	if (rules.length === 0) {
		return false;
	}

	const collectedLinks = collectLinksForRules(markdown, rules);
	const currentFrontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? {};

	if (!hasFrontmatterChanges(currentFrontmatter, rules, collectedLinks)) {
		return false;
	}

	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		const managedFrontmatter = frontmatter as Record<string, unknown>;

		for (const rule of rules) {
			const propertyName = rule.propertyName.trim();
			const links = collectedLinks.get(propertyName) ?? [];

			if (links.length === 0) {
				delete managedFrontmatter[propertyName];
				continue;
			}

			if (rule.saveMode === 'first') {
				const firstLink = links[0];

				if (firstLink === undefined) {
					delete managedFrontmatter[propertyName];
					continue;
				}

				managedFrontmatter[propertyName] = firstLink;
				continue;
			}

			managedFrontmatter[propertyName] = links;
		}
	});

	return true;
}

function getValidRules(rules: LinkRule[]): LinkRule[] {
	const seenProperties = new Set<string>();
	const validRules: LinkRule[] = [];

	for (const rule of rules) {
		const propertyName = rule.propertyName.trim();
		const matcher = rule.matcher.trim();

		if (!rule.enabled || propertyName.length === 0 || matcher.length === 0) {
			continue;
		}

		if (seenProperties.has(propertyName)) {
			continue;
		}

		seenProperties.add(propertyName);
		validRules.push({
			...rule,
			propertyName,
			matcher,
		});
	}

	return validRules;
}

function hasFrontmatterChanges(
	frontmatter: Record<string, unknown>,
	rules: LinkRule[],
	collectedLinks: Map<string, string[]>,
): boolean {
	for (const rule of rules) {
		const propertyName = rule.propertyName.trim();
		const currentValue = frontmatter[propertyName] as FrontmatterValue;
		const links = collectedLinks.get(propertyName) ?? [];
		const nextValue = getNextValue(rule, links);

		if (!frontmatterValuesEqual(currentValue, nextValue)) {
			return true;
		}
	}

	return false;
}

function getNextValue(rule: LinkRule, links: string[]): FrontmatterValue {
	if (links.length === 0) {
		return undefined;
	}

	if (rule.saveMode === 'first') {
		return links[0] ?? undefined;
	}

	return links;
}

function frontmatterValuesEqual(
	currentValue: FrontmatterValue,
	nextValue: FrontmatterValue,
): boolean {
	if (nextValue === undefined) {
		return currentValue === undefined;
	}

	if (typeof nextValue === 'string') {
		return currentValue === nextValue;
	}

	if (!Array.isArray(currentValue) || currentValue.length !== nextValue.length) {
		return false;
	}

	return nextValue.every((value, index) => currentValue[index] === value);
}
