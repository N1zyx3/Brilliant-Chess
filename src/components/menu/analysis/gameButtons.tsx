"use client"

import { useContext, useEffect, useRef, useState } from "react";
import NextMove from "../../svg/nextMove";
import Play from "../../svg/play";
import SkipGame from "../../svg/skipGame";
import Pause from "../../svg/pause";
import { AnalyzeContext } from "@/context/analyze";

export default function GameButtons() {
    const [playPauseHover, setPlayPauseHover] = useState(false)

    const analyzeContext = useContext(AnalyzeContext)

    const [playing] = analyzeContext.playing
    const [moveNumber] = analyzeContext.moveNumber
    const gameController = analyzeContext.gameController

    const moveNumberRef = useRef(moveNumber)

    useEffect(() => {
        moveNumberRef.current = moveNumber
    }, [moveNumber])

    function previousMove() {
        gameController.back()
    }

    function nextMove() {
        gameController.forward()
    }

    function firstMove() {
        gameController.first()
    }

    function lastMove() {
        gameController.last()
    }

    function play() {
        gameController.play()
    }

    function pause() {
        gameController.pause()
    }

    return (
        <div className="w-[85%] rounded-borderRoundness p-1 flex flex-row justify-around items-center gap-1">
            <button type="button" aria-label="First move" onClick={firstMove} className="group p-2 flex items-center justify-center">
                <SkipGame class="h-[40px] rotate-180 fill-foregroundGrey transition-colors group-hover:fill-foregroundHighlighted" />
            </button>
            <button type="button" aria-label="Previous move" onClick={previousMove} className="group p-2 flex items-center justify-center">
                <NextMove class="h-[24px] rotate-180 fill-foregroundGrey transition-colors group-hover:fill-foregroundHighlighted" />
            </button>
            {!playing ? (
                <button type="button" aria-label="Play" onClick={play} onMouseEnter={() => setPlayPauseHover(true)} onMouseLeave={() => setPlayPauseHover(false)} className="p-2 flex items-center justify-center">
                    <Play class={`h-[24px] transition-colors pl-1 ${playPauseHover ? 'fill-foregroundHighlighted' : 'fill-foregroundGrey'}`} />
                </button>
            ) : (
                <button type="button" aria-label="Pause" onClick={pause} onMouseEnter={() => setPlayPauseHover(true)} onMouseLeave={() => setPlayPauseHover(false)} className="p-2 flex items-center justify-center">
                    <Pause class={`h-[24px] transition-colors pr-1 ${playPauseHover ? 'fill-foregroundHighlighted' : 'fill-foregroundGrey'}`} />
                </button>
            )}
            <button type="button" aria-label="Next move" onClick={nextMove} className="group p-2 flex items-center justify-center">
                <NextMove class="h-[24px] fill-foregroundGrey transition-colors group-hover:fill-foregroundHighlighted" />
            </button>
            <button type="button" aria-label="Last move" onClick={lastMove} className="group p-2 flex items-center justify-center">
                <SkipGame class="h-[40px] fill-foregroundGrey transition-colors group-hover:fill-foregroundHighlighted" />
            </button>
        </div>
    )
}