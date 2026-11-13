import { LANGUAGES, Language, translations } from "./translations"

export { LANGUAGES, translations }
export type { Language, Dictionary, MoveComments, OverallComments } from "./translations"

export const LANGUAGE_NAMES: Record<Language, string> = {
    en: "English",
    ru: "Русский",
}

export const LANGUAGE_LOCALES: Record<Language, string> = {
    en: "en-US",
    ru: "ru-RU",
}

export function isLanguage(value: string | null): value is Language {
    return value !== null && (LANGUAGES as readonly string[]).includes(value)
}

export function translate(template: string, replacements: Record<string, string | number>) {
    return Object.entries(replacements).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template)
}