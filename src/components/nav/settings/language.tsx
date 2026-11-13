"use client"

import { useI18n } from "@/context/i18n"
import { LANGUAGE_NAMES, LANGUAGES } from "@/i18n"

export default function Language() {
    const { language, setLanguage, t } = useI18n()

    return (
        <section>
            <h1 className="block bg-backgroundBoxBox font-bold text-nowrap p-3 text-foreground">{t.settings.language}</h1>
            {LANGUAGES.map(code => (
                <button onClick={() => setLanguage(code)} type="button" key={code} className="flex flex-row gap-2 items-center hover:text-foregroundHighlighted hover:bg-black transition-colors w-full relative p-2">
                    <span className="w-[40px] h-[40px] flex justify-center items-center font-extrabold uppercase">{code}</span>
                    <span className="font-bold text-lg">{LANGUAGE_NAMES[code]}</span>
                    <div style={{ backgroundColor: "var(--foreground)", display: language === code ? '' : 'none' }} className="w-3 h-3 rounded-full absolute right-3" />
                </button>
            ))}
        </section>
    )
}