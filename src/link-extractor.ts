import { LinkRule } from './settings';

const MARKDOWN_LINK_REGEX = /\[[^\]]*]\((https?:\/\/[^\s)]+)\)/gi;
const BARE_URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;

export function collectLinksForRules(
	markdown: string,
	rules: LinkRule[],
): Map<string, string[]> {
	const links = extractLinks(markdown);
	const collectedLinks = new Map<string, string[]>();

	for (const rule of rules) {
		const matches = links.filter((link) => matchesRule(link, rule));
		const limit = rule.saveMode === 'first' ? 1 : matches.length;

		collectedLinks.set(rule.propertyName.trim(), matches.slice(0, limit));
	}

	return collectedLinks;
}

export function extractLinks(markdown: string): string[] {
	const body = stripFrontmatter(markdown);
	const links: string[] = [];
	const seenLinks = new Set<string>();

	for (const regex of [MARKDOWN_LINK_REGEX, BARE_URL_REGEX]) {
		regex.lastIndex = 0;

		for (const match of body.matchAll(regex)) {
			const rawLink = match[1] ?? match[0];
			const link = trimTrailingPunctuation(rawLink);

			if (link.length === 0 || seenLinks.has(link)) {
				continue;
			}

			seenLinks.add(link);
			links.push(link);
		}
	}

	return links;
}

function matchesRule(link: string, rule: LinkRule): boolean {
	return globToRegExp(rule.matcher).test(link);
}

function globToRegExp(pattern: string): RegExp {
	const normalizedPattern = pattern.includes('*') || pattern.includes('?')
		? pattern
		: `*${pattern}*`;
	const source = normalizedPattern
		.split('')
		.map((character) => {
			if (character === '*') {
				return '.*';
			}

			if (character === '?') {
				return '.';
			}

			return escapeRegExp(character);
		})
		.join('');

	return new RegExp(`^${source}$`, 'i');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripFrontmatter(markdown: string): string {
	if (!markdown.startsWith('---')) {
		return markdown;
	}

	const lines = markdown.split('\n');

	for (let index = 1; index < lines.length; index += 1) {
		if (lines[index]?.trim() === '---') {
			return lines.slice(index + 1).join('\n');
		}
	}

	return markdown;
}

function trimTrailingPunctuation(link: string): string {
	let trimmedLink = link.replace(/[.,;:!?]+$/g, '');

	while (hasUnbalancedTrailingCharacter(trimmedLink, '(', ')')) {
		trimmedLink = trimmedLink.slice(0, -1);
	}

	while (hasUnbalancedTrailingCharacter(trimmedLink, '[', ']')) {
		trimmedLink = trimmedLink.slice(0, -1);
	}

	return trimmedLink;
}

function hasUnbalancedTrailingCharacter(
	value: string,
	openingCharacter: string,
	closingCharacter: string,
): boolean {
	if (!value.endsWith(closingCharacter)) {
		return false;
	}

	const openingCount = countCharacter(value, openingCharacter);
	const closingCount = countCharacter(value, closingCharacter);

	return closingCount > openingCount;
}

function countCharacter(value: string, character: string): number {
	return value.split(character).length - 1;
}
