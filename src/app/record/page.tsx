import Nav from "@/components/nav/nav"
import RecordGame from "@/components/record/recordGame"
import ConfigContextProvider from "@/context/config"

export default function RecordPage() {
    return (
        <ConfigContextProvider>
            <header>
                <Nav />
            </header>
            <main className="flex flex-col vertical:flex-row phoneLandscape:flex-row h-full vertical:p-4 p-2 vertical:gap-2 gap-4 items-center vertical:justify-center select-none w-full overflow-x-hidden overflow-y-auto">
                <RecordGame />
            </main>
        </ConfigContextProvider>
    )
}
