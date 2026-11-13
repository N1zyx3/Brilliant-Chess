"use client"

import { useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Chess, Move, PAWN, PieceSymbol, Square } from "chess.js"
import { Howl } from "howler"
import PieceSVG from "../svg/piece"
import { ConfigContext } from "@/context/config"
import { useI18n } from "@/context/i18n"
import { PENDING_ANALYSIS_KEY } from "@/context/analyze"
import { boardThemes } from "../nav/settings/themes"
import type { Dictionary } from "@/i18n"
import { translate } from "@/i18n"

type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*"

interface LastMove {
    from: Square,
    to: Square,
}

interface DraggedPiece {
    from: Square,
    x: number,
    y: number,
}

const FILES = "abcdefgh"
const PROMOTION_PIECES: PieceSymbol[] = ["q", "r", "b", "n"]

const moveSelfSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/move-self.mp3`],
    preload: true,
})

const captureSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/capture.mp3`],
    preload: true,
})

const castleSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/castle.mp3`],
    preload: true,
})

const moveCheckSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/move-check.mp3`],
    preload: true,
})

const gameEndSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/game-end.mp3`],
    preload: true,
    volume: 0.25,
})

function getGameResult(chess: Chess): GameResult {
    if (chess.isCheckmate()) return chess.turn() === 'w' ? "0-1" : "1-0"
    if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) return "1/2-1/2"
    return "*"
}

function getEndText(chess: Chess, endTexts: Dictionary["record"]["endTexts"], white: string, black: string) {
    if (chess.isCheckmate()) return translate(endTexts.checkmate, { winner: chess.turn() === 'w' ? black : white })
    if (chess.isStalemate()) return endTexts.stalemate
    if (chess.isInsufficientMaterial()) return endTexts.insufficientMaterial
    if (chess.isThreefoldRepetition()) return endTexts.threefoldRepetition
    if (chess.isDraw()) return endTexts.draw
    return ""
}

function getLastMove(chess: Chess): LastMove | null {
    const history = chess.history({ verbose: true })
    const lastMove = history[history.length - 1]
    return lastMove ? { from: lastMove.from, to: lastMove.to } : null
}

function setPgnHeaders(chess: Chess, headers: Dictionary["record"]["headers"], result: GameResult = "*") {
    chess.header(
        "Event", headers.event,
        "Site", headers.site,
        "White", headers.white,
        "Black", headers.black,
        "Result", result,
    )
}

export default function RecordGame() {
    const router = useRouter()

    const configContext = useContext(ConfigContext)
    const [boardTheme] = configContext.boardTheme
    const [boardSounds] = configContext.boardSounds
    const { t } = useI18n()

    const chessRef = useRef<Chess | null>(null)
    if (!chessRef.current) {
        const chess = new Chess()
        setPgnHeaders(chess, t.record.headers)
        chessRef.current = chess
    }
    const chess = chessRef.current

    const [fen, setFen] = useState(() => chess.fen())
    const [pgn, setPgn] = useState("")
    const [orientation, setOrientation] = useState(true)
    const [selected, setSelected] = useState<Square | null>(null)
    const [lastMove, setLastMove] = useState<LastMove | null>(null)
    const [pendingPromotion, setPendingPromotion] = useState<{ from: Square, to: Square } | null>(null)
    const [draggedPiece, setDraggedPiece] = useState<DraggedPiece | null>(null)
    const [copied, setCopied] = useState(false)
    const [boardSize, setBoardSize] = useState(0)

    const boardWrapperRef = useRef<HTMLDivElement>(null)
    const boardRef = useRef<HTMLDivElement>(null)
    const suppressClickRef = useRef(false)
    const suppressMouseRef = useRef(0)
    const touchRef = useRef<{ active: boolean, from: Square, startX: number, startY: number, moved: boolean } | null>(null)
    const copyTimeoutRef = useRef<NodeJS.Timeout>()
    const undoRef = useRef<() => void>(() => { })

    const position = new Chess(fen)
    const gameOver = position.isGameOver()
    const moveHistory = chess.history({ verbose: true })
    const endText = getEndText(position, t.record.endTexts, t.common.white, t.common.black)
    const whiteToMove = position.turn() === 'w'
    const isCheck = position.isCheck()

    const squareSize = boardSize / 8

    const legalTargets = (() => {
        if (!selected || gameOver) return new Map<Square, boolean>()
        const moves = position.moves({ square: selected, verbose: true })
        return new Map(moves.map(move => [move.to, Boolean(move.captured)] as [Square, boolean]))
    })()

    const checkedKing = (() => {
        if (!isCheck) return null
        for (const row of position.board()) {
            for (const square of row) {
                if (square?.type === 'k' && square.color === position.turn()) return square.square
            }
        }
        return null
    })()

    useEffect(() => {
        function updateBoardSize() {
            const wrapper = boardWrapperRef.current
            if (!wrapper) return

            const size = Math.floor(wrapper.clientWidth / 8) * 8
            if (size > 0) setBoardSize(size)
        }

        updateBoardSize()

        const observer = new ResizeObserver(updateBoardSize)
        if (boardWrapperRef.current) observer.observe(boardWrapperRef.current)
        window.addEventListener('resize', updateBoardSize)

        return () => {
            observer.disconnect()
            window.removeEventListener('resize', updateBoardSize)
            clearTimeout(copyTimeoutRef.current)
        }
    }, [])

    function playMoveSound(move: Move) {
        if (!boardSounds) return

        if (chess.isGameOver()) {
            gameEndSound.play()
        } else if (move.captured) {
            captureSound.play()
        } else if (chess.isCheck()) {
            moveCheckSound.play()
        } else if (move.flags.includes('k') || move.flags.includes('q')) {
            castleSound.play()
        } else {
            moveSelfSound.play()
        }
    }

    function sync(nextLastMove?: LastMove | null) {
        const result = chess.history().length ? getGameResult(chess) : "*"
        chess.header("Result", result)

        setFen(chess.fen())
        setPgn(chess.pgn({ maxWidth: 80 }))
        setLastMove(nextLastMove === undefined ? getLastMove(chess) : nextLastMove)
        setSelected(null)
        setPendingPromotion(null)
        setDraggedPiece(null)
    }

    function tryMove(from: Square, to: Square, promotion?: PieceSymbol) {
        const piece = chess.get(from)

        if (!piece || piece.color !== chess.turn() || chess.isGameOver()) return false
        if (!chess.moves({ square: from, verbose: true }).some(move => move.to === to)) return false

        const isPromotion = piece.type === PAWN && (to[1] === '8' || to[1] === '1')

        if (isPromotion && !promotion) {
            setPendingPromotion({ from, to })
            setSelected(null)
            return true
        }

        try {
            const move = chess.move({ from, to, promotion })
            playMoveSound(move)
            sync({ from: move.from, to: move.to })
            return true
        } catch {
            return false
        }
    }

    function handleSquareClick(square: Square) {
        if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
        }

        if (gameOver) return

        const piece = chess.get(square)

        if (selected) {
            if (selected === square) {
                setSelected(null)
                return
            }

            if (piece && piece.color === chess.turn()) {
                setSelected(square)
                return
            }

            if (tryMove(selected, square)) return
            setSelected(null)
            return
        }

        if (piece && piece.color === chess.turn()) setSelected(square)
    }

    function getSquareFromPoint(clientX: number, clientY: number): Square | null {
        const board = boardRef.current
        if (!board) return null

        const rect = board.getBoundingClientRect()
        const column = Math.floor((clientX - rect.left) / (rect.width / 8))
        const row = Math.floor((clientY - rect.top) / (rect.height / 8))

        if (column < 0 || column > 7 || row < 0 || row > 7) return null

        const file = orientation ? column : 7 - column
        const rank = orientation ? 8 - row : row + 1

        return `${FILES[file]}${rank}` as Square
    }

    function handlePieceMouseDown(e: React.MouseEvent, square: Square) {
        if (e.button !== 0) return
        if (Date.now() < suppressMouseRef.current) return

        const piece = chess.get(square)
        if (!piece || piece.color !== chess.turn() || gameOver) return

        e.preventDefault()

        setSelected(square)

        const start = { x: e.clientX, y: e.clientY }
        const state = { moved: false, active: true }

        function handleMouseMove(e: MouseEvent) {
            if (!state.active) return

            const x = e.clientX - start.x
            const y = e.clientY - start.y

            if (!state.moved && (Math.abs(x) > 4 || Math.abs(y) > 4)) state.moved = true
            if (state.moved) setDraggedPiece({ from: square, x, y })
        }

        function handleMouseUp(e: MouseEvent) {
            if (!state.active) return
            state.active = false

            if (state.moved) {
                const target = getSquareFromPoint(e.clientX, e.clientY)
                if (target && target !== square) tryMove(square, target)
            }

            setDraggedPiece(null)
            suppressClickRef.current = true
            setTimeout(() => { suppressClickRef.current = false }, 0)

            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
    }

    function handlePieceTouchStart(e: React.TouchEvent, square: Square) {
        const piece = chess.get(square)
        if (!piece || piece.color !== chess.turn() || gameOver) return

        const touch = e.touches[0]
        if (!touch) return

        suppressMouseRef.current = Date.now() + 700
        touchRef.current = { active: true, from: square, startX: touch.clientX, startY: touch.clientY, moved: false }
    }

    function handlePieceTouchMove(e: React.TouchEvent) {
        const state = touchRef.current
        if (!state?.active) return

        const touch = e.touches[0]
        if (!touch) return

        const x = touch.clientX - state.startX
        const y = touch.clientY - state.startY

        if (!state.moved && (Math.abs(x) > 4 || Math.abs(y) > 4)) {
            state.moved = true
            setSelected(state.from)
        }

        if (state.moved) setDraggedPiece({ from: state.from, x, y })
    }

    function handlePieceTouchEnd(e: React.TouchEvent) {
        const state = touchRef.current
        touchRef.current = null

        if (!state?.active) return

        setDraggedPiece(null)

        if (!state.moved) return

        const touch = e.changedTouches[0]
        const target = touch ? getSquareFromPoint(touch.clientX, touch.clientY) : null

        if (target && target !== state.from) tryMove(state.from, target)

        suppressClickRef.current = true
        setTimeout(() => { suppressClickRef.current = false }, 500)
    }

    function handlePieceTouchCancel() {
        touchRef.current = null
        setDraggedPiece(null)
    }

    function undo() {
        const undone = chess.undo()
        if (!undone) return

        const history = chess.history({ verbose: true })
        const last = history[history.length - 1]

        sync(last ? { from: last.from, to: last.to } : null)
    }

    undoRef.current = undo

    function resetGame() {
        chess.reset()
        setPgnHeaders(chess, t.record.headers)

        setFen(chess.fen())
        setPgn("")
        setSelected(null)
        setLastMove(null)
        setPendingPromotion(null)
        setDraggedPiece(null)
    }

    function copyPgn() {
        if (!pgn) return

        navigator.clipboard?.writeText(pgn).then(() => {
            setCopied(true)
            clearTimeout(copyTimeoutRef.current)
            copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
        }).catch(() => { })
    }

    function analyzeGame() {
        try {
            window.sessionStorage.setItem(PENDING_ANALYSIS_KEY, pgn)
        } catch { }

        router.push("/")
    }

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const element = e.target as HTMLElement
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                undoRef.current()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const board = position.board()
    const rows = orientation ? board : [...board].reverse().map(row => [...row].reverse())
    const colors = boardThemes[boardTheme] ?? boardThemes[0]

    const moveRows: { number: number, white?: Move, black?: Move }[] = []
    for (let i = 0; i < moveHistory.length; i += 2) {
        moveRows.push({ number: i / 2 + 1, white: moveHistory[i], black: moveHistory[i + 1] })
    }

    return (
        <div className="flex flex-col vertical:flex-row phoneLandscape:flex-row w-full h-full items-center vertical:items-start phoneLandscape:items-start justify-start vertical:justify-center phoneLandscape:justify-center gap-4 vertical:gap-6 p-1">
            <div ref={boardWrapperRef} className="w-full vertical:w-auto phoneLandscape:w-auto phoneLandscape:flex-1 min-w-0 max-w-[640px] aspect-square" style={{ maxWidth: 'min(72vh, 640px)' }}>
                {boardSize > 0 ? (
                    <div
                        ref={boardRef}
                        onContextMenu={e => e.preventDefault()}
                        className="board-surface grid w-fit h-fit relative select-none"
                        style={{ gridTemplateColumns: `repeat(8, ${squareSize}px)` }}
                    >
                        {rows.map((row, rowIndex) => {
                            return row.map((piece, columnIndex) => {
                                const fileIndex = orientation ? columnIndex : 7 - columnIndex
                                const rankIndex = orientation ? 7 - rowIndex : rowIndex
                                const square = `${FILES[fileIndex]}${rankIndex + 1}` as Square
                                const isLight = (fileIndex + rankIndex) % 2 === 1

                                const isSelected = selected === square
                                const isLastMove = lastMove?.from === square || lastMove?.to === square
                                const isCheckedKing = checkedKing === square
                                const legalTarget = legalTargets.get(square)
                                const isDragging = draggedPiece?.from === square

                                let rounded = ''
                                if (rowIndex === 0 && columnIndex === 0) rounded = "rounded-tl-borderRoundness"
                                if (rowIndex === 0 && columnIndex === 7) rounded = "rounded-tr-borderRoundness"
                                if (rowIndex === 7 && columnIndex === 0) rounded = "rounded-bl-borderRoundness"
                                if (rowIndex === 7 && columnIndex === 7) rounded = "rounded-br-borderRoundness"

                                const showFileGuide = rowIndex === 7
                                const showRankGuide = columnIndex === 0
                                const guideColor = isLight ? colors.black : colors.white

                                return (
                                    <div
                                        key={square}
                                        data-square={square}
                                        onClick={() => handleSquareClick(square)}
                                        style={{ width: squareSize, height: squareSize, backgroundColor: isLight ? colors.white : colors.black }}
                                        className={`relative flex items-center justify-center ${rounded}`}
                                    >
                                        {isLastMove ? <div style={{ backgroundColor: colors.highlight }} className={`absolute inset-0 opacity-40 ${rounded}`} /> : ''}
                                        {isSelected ? <div style={{ backgroundColor: colors.highlight }} className={`absolute inset-0 opacity-60 ${rounded}`} /> : ''}
                                        {isCheckedKing ? <div className="absolute inset-0 bg-red-500 opacity-45" /> : ''}

                                        {showRankGuide ? <span style={{ color: guideColor }} className="absolute top-0.5 left-1 text-[10px] font-bold opacity-80 pointer-events-none">{rankIndex + 1}</span> : ''}
                                        {showFileGuide ? <span style={{ color: guideColor }} className="absolute bottom-0 right-1 text-[10px] font-bold opacity-80 pointer-events-none">{FILES[fileIndex]}</span> : ''}

                                        {legalTarget !== undefined ? (
                                            legalTarget ? (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                                    <div className="w-full h-full rounded-full border-[6px] border-black/20" />
                                                </div>
                                            ) : (
                                                <div className="absolute z-10 w-[30%] h-[30%] rounded-full bg-black/20 pointer-events-none" />
                                            )
                                        ) : ''}

                                        {piece ? (
                                            <div
                                                onMouseDown={e => handlePieceMouseDown(e, square)}
                                                onTouchStart={e => handlePieceTouchStart(e, square)}
                                                onTouchMove={handlePieceTouchMove}
                                                onTouchEnd={handlePieceTouchEnd}
                                                onTouchCancel={handlePieceTouchCancel}
                                                style={{
                                                    width: squareSize,
                                                    height: squareSize,
                                                    transform: isDragging ? `translate(${draggedPiece!.x}px, ${draggedPiece!.y}px)` : undefined,
                                                    zIndex: isDragging ? 100 : 20,
                                                    pointerEvents: isDragging ? 'none' : undefined,
                                                }}
                                                className="relative cursor-grab active:cursor-grabbing"
                                            >
                                                <PieceSVG className="pointer-events-none" draggable={false} piece={piece.type} color={piece.color} size={squareSize} />
                                            </div>
                                        ) : ''}
                                    </div>
                                )
                            })
                        })}

                        {pendingPromotion ? (
                            <div className="absolute inset-0 z-[200] bg-black/50 flex items-center justify-center" onClick={() => setPendingPromotion(null)}>
                                <div className="bg-backgroundBox rounded-borderRoundness p-3 shadow-lg shadow-black/50 flex flex-col gap-2 items-center" onClick={e => e.stopPropagation()}>
                                    <span className="text-sm font-bold text-foregroundGrey">{t.record.promotion}</span>
                                    <div className="flex flex-row gap-1">
                                        {PROMOTION_PIECES.map(pieceType => (
                                            <button
                                                key={pieceType}
                                                type="button"
                                                title={pieceType}
                                                onClick={() => tryMove(pendingPromotion.from, pendingPromotion.to, pieceType)}
                                                className="rounded-borderRoundness hover:bg-backgroundBoxHover transition-colors p-1"
                                            >
                                                <PieceSVG piece={pieceType} color={position.turn()} size={Math.max(48, squareSize * 0.75)} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : ''}
                    </div>
                ) : ''}
            </div>

            <div className="bg-backgroundBox rounded-borderRoundness flex flex-col gap-4 p-4 w-full max-w-[500px] vertical:max-w-[420px] vertical:min-w-[360px] phoneLandscape:h-full phoneLandscape:overflow-y-auto select-text">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-extrabold">{t.record.title}</h1>
                    <p className="text-sm text-foregroundGrey">
                        {t.record.description}
                    </p>
                </div>

                <div className={`rounded-borderRoundness px-3 py-2 text-sm font-bold flex flex-row items-center justify-between gap-2 ${gameOver && moveHistory.length ? 'bg-backgroundBoxBoxHighlighted text-foreground' : 'bg-backgroundBoxBox text-foregroundGrey'}`}>
                    <span>{gameOver && moveHistory.length ? endText : isCheck ? (whiteToMove ? t.record.turnCheckWhite : t.record.turnCheckBlack) : (whiteToMove ? t.record.turnWhite : t.record.turnBlack)}</span>
                    {moveHistory.length ? <span className="text-xs font-normal opacity-80">{translate(t.common.moveCount, { count: moveHistory.length })}</span> : ''}
                </div>

                {gameOver && moveHistory.length ? (
                    <div className="flex flex-col gap-2 rounded-borderRoundness bg-backgroundBoxBox p-3 border border-border">
                        <span className="font-bold">{t.record.gameOver}</span>
                        <span className="text-sm text-foregroundGrey">{endText}. {t.record.analyzePrompt}</span>
                        <button
                            type="button"
                            onClick={analyzeGame}
                            className="h-12 rounded-borderRoundness text-lg font-extrabold bg-backgroundBoxBoxHighlighted hover:bg-backgroundBoxBoxHighlightedHover transition-all hover:shadow-shadowBoxBoxHighlighted"
                        >
                            {t.record.analyzeGame}
                        </button>
                    </div>
                ) : ''}

                <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-foregroundGrey">{t.record.moves}</span>
                    <div className="h-[150px] overflow-y-auto rounded-borderRoundness bg-backgroundBoxBox p-2 text-sm font-mono">
                        {moveRows.length ? (
                            <table className="w-full">
                                <tbody>
                                    {moveRows.map(row => (
                                        <tr key={row.number}>
                                            <td className="w-8 text-foregroundGrey py-0.5">{row.number}.</td>
                                            <td className="w-1/2 py-0.5 font-bold">{row.white?.san ?? ''}</td>
                                            <td className="w-1/2 py-0.5 font-bold">{row.black?.san ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <span className="text-foregroundGrey font-sans">{t.record.noMoves}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                        <span className="text-sm font-bold text-foregroundGrey">PGN</span>
                        <button
                            type="button"
                            onClick={copyPgn}
                            disabled={!pgn}
                            className="text-xs font-bold px-3 py-1 rounded-borderRoundness bg-backgroundBoxBox hover:bg-backgroundBoxBoxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {copied ? t.record.copied : t.record.copyPgn}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        spellCheck={false}
                        value={pgn}
                        placeholder={t.record.pgnPlaceholder}
                        className="h-[110px] w-full resize-none rounded-borderRoundness bg-backgroundBoxBox p-2 text-xs font-mono outline-none text-foregroundGrey"
                    />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={!moveHistory.length}
                        title={t.record.undoTitle}
                        className="h-11 rounded-borderRoundness text-sm font-bold bg-backgroundBoxBox hover:bg-backgroundBoxBoxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t.record.undo}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOrientation(previous => !previous)}
                        className="h-11 rounded-borderRoundness text-sm font-bold bg-backgroundBoxBox hover:bg-backgroundBoxBoxHover transition-colors"
                    >
                        {t.record.flipBoard}
                    </button>
                    <button
                        type="button"
                        onClick={resetGame}
                        disabled={!moveHistory.length}
                        className="h-11 rounded-borderRoundness text-sm font-bold bg-backgroundBoxBox hover:bg-backgroundBoxBoxHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t.record.resetGame}
                    </button>
                </div>

                <p className="text-xs text-foregroundGrey">
                    {t.record.help}
                </p>
            </div>
        </div>
    )
}
