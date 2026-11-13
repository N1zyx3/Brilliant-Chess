"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { Dictionary, Language, LANGUAGE_LOCALES, isLanguage, translations } from "@/i18n"

export const LANGUAGE_STORAGE_KEY = "language"

interface I18nContextValue {
    language: Language
    locale: string
    setLanguage: (language: Language) => void
    t: Dictionary
}

const I18nContext = createContext<I18nContextValue>({
    language: "en",
    locale: LANGUAGE_LOCALES.en,
    setLanguage: () => { },
    t: translations.en,
})

export default function I18nContextProvider(props: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("en")

    useEffect(() => {
        let storedLanguage: string | null = null
        try {
            storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
        } catch { }

        if (isLanguage(storedLanguage)) {
            setLanguageState(storedLanguage)
            return
        }

        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, "en")
        } catch { }
    }, [])

    useEffect(() => {
        document.documentElement.lang = language

        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
        } catch { }
    }, [language])

    function setLanguage(language: Language) {
        setLanguageState(language)
    }

    return (
        <I18nContext.Provider value={{ language, locale: LANGUAGE_LOCALES[language], setLanguage, t: translations[language] }}>
            {props.children}
        </I18nContext.Provider>
    )
}

export function useI18n() {
    return useContext(I18nContext)
}