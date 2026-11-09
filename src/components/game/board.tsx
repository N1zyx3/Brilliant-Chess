import { deformatSquare, formatSquare, moveRating, position, result, square } from "@/engine/stockfish";
import { RefObject, useContext, useEffect, useRef, useState } from "react";
import { BISHOP, BLACK, Chess, Color, KING, KNIGHT, PAWN, PieceSymbol, QUEEN, ROOK, Square, WHITE } from "chess.js";
import { Howl } from "howler";
import { ConfigContext } from "@/context/config";
import { boardThemes } from "../nav/settings/themes";
import { arrow } from "./game";
import PieceSVG from "../svg/piece";
import RatingSVG from "../svg/rating";
import ResultSVG from "../svg/result";
import Image from "next/image";

interface filteredHighlightStyle {
    [key: string]: { color: string, rating: moveRating }
}

export interface drag {
    is: boolean,
    id: string,
}

interface coronation {
    choosing: boolean
    movement: square[]
}

interface touchState {
    active: boolean
    from: string
    square: square
    startX: number
    startY: number
    moved: boolean
    ownPiece: boolean
    selectedBefore: string
}

// Touch screens emit compatibility mouse events after a tap. Whenever we
// handle a gesture ourselves we ignore those synthetic events for a moment
// so that a single tap can't select a piece twice or make two moves.
let suppressMouseUntil = 0

function isMouseSuppressed() {
    return Date.now() < suppressMouseUntil
}

function suppressMouse() {
    suppressMouseUntil = Date.now() + 700
}

const HIGHLIGHT_COLORS = {
    forced: "",
    brilliant: "var(--highlightBrilliant)",
    great: "var(--highlightGreat)",
    best: "var(--highlightBest)",
    excellent: "var(--highlightExcellent)",
    good: "var(--highlightGood)",
    book: "var(--highlightBook)",
    inaccuracy: "var(--highlightInaccuracy)",
    mistake: "var(--highlightMistake)",
    miss: "var(--highlightMiss)",
    blunder: "var(--highlightBlunder)",
}

const PIECES_VALUES = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
}

const moveSelfSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/move-self.mp3`],
    preload: true,
})

const moveOpponentSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/move-opponent.mp3`],
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

export const gameStartSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/game-start.mp3`],
    preload: true,
    volume: 0.5,
})

const captureSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/capture.mp3`],
    preload: true,
})

const castleSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/castle.mp3`],
    preload: true,
})

const brilliantSound = new Howl({
    src: [`${process.env.NEXT_PUBLIC_BASE_PATH}/sounds/brilliant.wav`],
    preload: true,
})

function isEven(num: number) {
    return (num % 2) === 0
}

function getSquareId(column: number, row: number) {
    const columnId = String.fromCharCode(97 + column)
    const rowId = 8 - row
    return columnId + rowId
}

function adaptSquare(square: square): square {
    return { col: square.col, row: 7 - square.row }
}

function getCastleRookFromSquare(castle: 'k' | 'q' | undefined, whiteMoving: boolean): square | undefined {
    if (!castle) return
    return { col: castle === 'k' ? 7 : 0, row: whiteMoving ? 7 : 0 }
}

function getCastleRookToSquare(castle: 'k' | 'q' | undefined, whiteMoving: boolean): square | undefined {
    if (!castle) return
    return { col: castle === 'k' ? 5 : 3, row: whiteMoving ? 7 : 0 }
}

function flipBoard(board: position) {
    for (const row of board) {
        row.reverse()
    }
    board.reverse()
}

function isKnightMove(from: square, to: square) {
    return (Math.abs(from.col - to.col) === 2 && Math.abs(from.row - to.row) === 1) || (Math.abs(from.col - to.col) === 1 && Math.abs(from.row - to.row) === 2)
}

export function Arrow(props: { move: square[], squareSize: number, class: string, white: boolean }) {

    const { move, squareSize, white } = props

    if (!move[1]) {
        const elementPosition = {
            x: (squareSize * move[0].col) + 'px',
            y: (squareSize * move[0].row) + 'px',
        }

        let rounded: string = ''
        if (move[0].row === 0 && move[0].col === 0) rounded = white ? 'rounded-tl-borderRoundness' : 'rounded-br-borderRoundness'
        if (move[0].row === 7 && move[0].col === 0) rounded = white ? 'rounded-bl-borderRoundness' : 'rounded-tr-borderRoundness'
        if (move[0].row === 0 && move[0].col === 7) rounded = white ? 'rounded-tr-borderRoundness' : 'rounded-bl-borderRoundness'
        if (move[0].row === 7 && move[0].col === 7) rounded = white ? 'rounded-br-borderRoundness' : 'rounded-tl-borderRoundness'

        const size = squareSize + 'px'

        return <div style={{ top: white ? elementPosition.y : '', bottom: !white ? elementPosition.y : '', left: white ? elementPosition.x : '', right: !white ? elementPosition.x : '', width: size, height: size }} className={`absolute opacity-80 z-[10] ${props.class} ${rounded}`} />
    }

    const [from, to] = move

    if (isKnightMove(from, to)) {
        const getTransform = () => {
            const longY = Math.abs(from.row - to.row) > Math.abs(from.col - to.col)
            const toDown = white ? (from.row < to.row) : (from.row > to.row)
            const toLeft = white ? (from.col < to.col) : (from.col > to.col)

            let rotation = 0
            let scaleX = 1
            let scaleY = 1

            if (longY) {
                if (toDown) {
                    rotation = 270
                    if (toLeft) scaleY = -1
                } else {
                    rotation = 90
                    if (!toLeft) scaleY = -1
                }
            } else {
                if (toDown) {
                    rotation = 180
                    if (!toLeft) scaleX = -1
                } else {
                    if (toLeft) scaleX = -1
                }
            }

            return `rotate(${rotation}deg) scaleX(${scaleX}) scaleY(${scaleY})`
        }

        const fromElementPosition = {
            x: squareSize * (white ? from.col : (7 - from.col)),
            y: squareSize * (white ? from.row : (7 - from.row)),
        }
    
        const toElementPosition = {
            x: squareSize * (white ? to.col : (7 - to.col)),
            y: squareSize * (white ? to.row : (7 - to.row)),
        }

        const distance = {
            x: Math.abs(fromElementPosition.x - toElementPosition.x),
            y: Math.abs(fromElementPosition.y - toElementPosition.y),
        }

        const longLineLength = Math.abs(Math.max(distance.x, distance.y))
        const shortLineLength = Math.abs(Math.min(distance.x, distance.y))

        const lineWidth = (squareSize / 2) * (3 / 7)

        const arrowHeadHeight = lineWidth * 1.6
        const arrowHeadWidth = squareSize / 2

        const height = shortLineLength + lineWidth / 2
        const width = longLineLength + (squareSize / 4) - arrowHeadHeight

        const longLineCenter = height - (lineWidth / 2)
        const shortLineCenter = arrowHeadWidth / 2

        const positionX = `${toElementPosition.x + (squareSize / 2) - (arrowHeadWidth / 2)}px`
        const positionY = `${toElementPosition.y + (squareSize / 2)}px`

        return (
            <svg style={{ top: positionY, left: positionX, transformOrigin: `${arrowHeadWidth / 2}px 0`, transform: getTransform() }} className={`absolute opacity-65 z-[70] pointer-events-none ${props.class}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
                <polygon strokeWidth={0} points={`0,${arrowHeadHeight} ${shortLineCenter},0 ${arrowHeadWidth},${arrowHeadHeight}`} />
                <path fill="none" strokeWidth={lineWidth} d={`M ${shortLineCenter} ${arrowHeadHeight - 1} L ${shortLineCenter} ${longLineCenter} L ${width} ${longLineCenter}`} />
            </svg>
        )
    }

    const fromElementPosition = {
        x: squareSize * from.col,
        y: squareSize * from.row,
    }

    const toElementPosition = {
        x: squareSize * to.col,
        y: squareSize * to.row,
    }

    const distance = {
        x: (fromElementPosition.x - toElementPosition.x) * (white ? 1 : -1),
        y: (fromElementPosition.y - toElementPosition.y) * (white ? 1 : -1),
    }

    const realDistance = Math.sqrt((distance.x ** 2) + (distance.y ** 2))

    const angle = Math.atan2(distance.x, distance.y)
    const degs = angle * (180 / Math.PI)

    const width = squareSize / 2
    const lineCenter = width / 2
    const lineWidth = width * (3 / 7)
    const arrowHeadHeight = lineWidth * 1.6
    const height = realDistance - arrowHeadHeight

    const positionX = `${toElementPosition.x + (squareSize / 2) - (width / 2)}px`
    const positionY = `${toElementPosition.y + (squareSize / 2) - (white ? 0 : height)}px`

    return (
        <svg style={{ top: white ? positionY : '', bottom: !white ? positionY : '', left: white ? positionX : '', right: !white ? positionX : '', transformOrigin: '50% 0', rotate: (-degs) + 'deg' }} className={`absolute opacity-65 z-[70] pointer-events-none ${props.class}`} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
            <line x1={lineCenter} y1={height} x2={lineCenter} y2={arrowHeadHeight - 1} strokeWidth={lineWidth} markerEnd="url(#arrowhead)" />
            <polygon strokeWidth={0} points={`0,${arrowHeadHeight} ${lineCenter},0 ${width},${arrowHeadHeight}`} />
        </svg>
    )
}

function Coronation(props: { white: boolean, column: number, coroningWhite: boolean, squareSize: number, clearCoronation: () => void, coronate: (piece: PieceSymbol) => void }) {
    const { white, column, coroningWhite, squareSize, clearCoronation, coronate } = props

    const coronationRef = useRef<HTMLDivElement>(null)

    const pieces: PieceSymbol[] = [
        QUEEN,
        KNIGHT,
        ROOK,
        BISHOP,
    ]

    useEffect(() => {
        function clickClearCoronation(e: MouseEvent) {
            if (coronationRef.current?.contains(e.target as Node)) return

            clearCoronation()
        }

        document.addEventListener('mousedown', clickClearCoronation)

        return () => document.removeEventListener('mousedown', clickClearCoronation)
    }, [])

    const color = coroningWhite ? WHITE : BLACK
    const top = (white && coroningWhite) || (!white && !coroningWhite)

    return (
        <div ref={coronationRef} className="flex absolute bg-white z-[90] shadow-lg shadow-black/50 cursor-pointer" style={{ flexDirection: top ? 'column' : 'column-reverse', top: top ? 0 : undefined, bottom: !top ? 0 : undefined, left: white ? column * squareSize : undefined, right: !white ? column * squareSize : undefined }}>
            {pieces.map((piece, i) => (
                <div onClick={() => {coronate(piece)}} key={i}>
                    <PieceSVG piece={piece} color={color} size={squareSize} />
                </div>
            ))}
            <div onClick={clearCoronation} className="bg-neutral-200 w-full flex justify-center items-center" style={{ height: squareSize / 2 }}>
                <Image draggable={false} src="/images/cross.svg" alt="cancel" width={squareSize / 4.5} height={squareSize / 4.5} />
            </div>
        </div>
    )
}

function Piece(props: { squareSize: number, pieceRef: RefObject<HTMLDivElement>, castleRookRef: RefObject<HTMLDivElement>, moved: boolean, isCastleRook: boolean, pieceColor: Color, pieceSymbol: PieceSymbol, drag: drag, setDrag: (dragging: drag) => void, id: string, boardRef: RefObject<HTMLDivElement>, setPlaying: (playing: boolean) => void, isCoronating: boolean, canDragTouch: boolean }) {
    const { boardRef, pieceRef, castleRookRef, moved, isCastleRook, pieceColor, pieceSymbol, drag, setDrag, id, squareSize, setPlaying, isCoronating, canDragTouch } = props

    const [movement, setMovement] = useState({ x: 0, y: 0 })
    const wasSelectedRef = useRef(false)

    const touchDragRef = useRef<{ active: boolean, startX: number, startY: number, moved: boolean } | null>(null)

    if (isCoronating) return

    function handlePieceDragStart(e: React.MouseEvent) {
        if (e.button !== 0) return
        if (isMouseSuppressed()) return

        wasSelectedRef.current = drag.id === id

        const element = e.currentTarget
        const elemenRect = element.getBoundingClientRect()

        const startPosition = { x: elemenRect.x + elemenRect.width / 2, y: elemenRect.y + elemenRect.height / 2 }

        function cleanUp() {
            document.removeEventListener('mousedown', pieceDragCancel)
            document.removeEventListener('mousemove', pieceDrag)
            document.removeEventListener('mouseup', pieceDragStop)
            document.body.style.cursor = ''
        }

        function pieceDragCancel() {
            setMovement({ x: 0, y: 0 })
            setDrag({ is: false, id: '' })

            cleanUp()
        }

        function pieceDrag(e: MouseEvent) {
            if (e.button !== 0) return

            handlePieceDrag(e, startPosition)
        }

        function pieceDragStop(e: MouseEvent) {
            if (e.button !== 0) return

            handlePieceDragStop(e, startPosition)

            cleanUp()
        }

        document.addEventListener('mousedown', pieceDragCancel)
        document.addEventListener('mousemove', pieceDrag)
        document.addEventListener('mouseup', pieceDragStop)

        document.body.style.cursor = 'grabbing'

        const movement = {
            x: e.clientX - startPosition.x,
            y: e.clientY - startPosition.y,
        }

        setMovement(movement)
        setPlaying(false)
        setDrag({ is: true, id })
    }

    function handlePieceDrag(e: MouseEvent, startPosition: { x: number, y: number }) {
        const board = boardRef.current

        if (!board) return

        const limits = {
            min: {
                x: board.offsetLeft,
                y: board.offsetTop,
            },
            max: {
                x: board.offsetLeft + board.offsetWidth,
                y: board.offsetTop + board.offsetHeight,
            },
        }

        const movement = {
            x: Math.min(Math.max(e.clientX, limits.min.x), limits.max.x) - startPosition.x,
            y: Math.min(Math.max(e.clientY, limits.min.y), limits.max.y) - startPosition.y,
        }

        setMovement(movement)
    }

    function handlePieceDragStop(e: MouseEvent, startPosition: { x: number, y: number }) {
        const movement = {
            x: e.clientX - startPosition.x,
            y: e.clientY - startPosition.y,
        }

        let newId = id
        if (wasSelectedRef.current && Math.abs(movement.x) <= squareSize / 2 && Math.abs(movement.y) <= squareSize / 2) {
            newId = ''
        }

        setMovement({ x: 0, y: 0 })
        setDrag({ is: false, id: newId })
    }

    function handleTouchStart(e: React.TouchEvent) {
        if (!canDragTouch) return

        const touch = e.touches[0]
        if (!touch) return

        touchDragRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, moved: false }
        setMovement({ x: 0, y: 0 })
        setPlaying(false)
    }

    function handleTouchMove(e: React.TouchEvent) {
        const touchState = touchDragRef.current
        if (!touchState?.active) return

        const touch = e.touches[0]
        if (!touch) return

        const x = touch.clientX - touchState.startX
        const y = touch.clientY - touchState.startY

        if (!touchState.moved && (Math.abs(x) > 5 || Math.abs(y) > 5)) touchState.moved = true
        if (touchState.moved) setMovement({ x, y })
    }

    function handleTouchEnd() {
        if (!touchDragRef.current) return

        touchDragRef.current = null
        setMovement({ x: 0, y: 0 })
    }

    function handleTouchCancel() {
        touchDragRef.current = null
        setMovement({ x: 0, y: 0 })
    }

    return (
        <div
            data-dontcleandrag={true}
            onMouseDown={handlePieceDragStart}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            ref={moved ? pieceRef : (isCastleRook ? castleRookRef : null)}
            className="w-full relative h-full z-[20] cursor-grab"
            style={{ top: movement.y || '', left: movement.x || '', zIndex: drag.is && drag.id === id ? 100 : '' }}
        >
            <PieceSVG className="*:pointer-events-none" dataset={{"dontcleandrag": true}} piece={pieceSymbol} color={pieceColor} size={squareSize} />
        </div>
    )
}

export default function Board(props: { cleanArrows: () => void, sacrifice?: boolean, previousStaticEvals?: string[][], boardSize: number, fen: string, nextFen: string, move?: square[], nextMove?: square[], bestMove?: square[], bestMoveSan?: string, previousBestMove?: square[], moveRating?: moveRating, forward: boolean, white: boolean, animation: boolean, gameEnded: boolean, capture?: PieceSymbol, nextCapture?: PieceSymbol, castle?: 'k' | 'q', nextCastle?: 'k' | 'q', setAnimation: (animation: boolean) => void, result: result, arrows: arrow[], pushArrow: (arrow: arrow) => void, analyzeMove: (previousFen: string, movement: { from: string, to: string, promotion?: PieceSymbol }, previousSacrifice: boolean, previousStaticEvals: string[][], animation: boolean, previousBestMoveSan?: string) => void, analyzingMove: boolean, setMaterialAdvantage: (materialAdvantage: number) => void, drag: drag, setDrag: (dragging: drag) => void, setPlaying: (playing: boolean) => void }) {
    const [hoverDrag, setHoverDrag] = useState('')
    const [coronation, setCoronation] = useState<coronation>({ choosing: false, movement: [] })

    const configContext = useContext(ConfigContext)

    const [boardTheme] = configContext.boardTheme
    const [usedRatings] = configContext.usedRatings
    const [highlightByRating] = configContext.highlightByRating
    const [showArrows] = configContext.showArrows
    const [arrowAfterMove] = configContext.arrowAfterMove
    const [showLegalMoves] = configContext.showLegalMoves
    const [animateMoves] = configContext.animateMoves
    const [boardSounds] = configContext.boardSounds
    
    const boardRef = useRef<HTMLDivElement>(null)

    const pieceRef = useRef<HTMLDivElement>(null)
    const castleRookRef = useRef<HTMLDivElement>(null)

    const currentArrowRef = useRef<square[]>([])

    const touchRef = useRef<touchState | null>(null)
    const touchArrowRef = useRef<{ from: square, to?: square } | null>(null)
    const arrowTimeoutRef = useRef<NodeJS.Timeout>()
    const [arrowDraft, setArrowDraft] = useState<{ from: square, to?: square } | null>(null)
    // Kept true after a touch interaction so the board keeps receiving taps
    // while a piece is selected by touch (the pointer-events lock is only
    // needed for the desktop drag ghost).
    const [touchMode, setTouchMode] = useState(false)

    const { drag, bestMoveSan, setDrag, pushArrow, cleanArrows, setMaterialAdvantage, setPlaying, analyzingMove, arrows, previousStaticEvals, sacrifice, boardSize, bestMove, previousBestMove, moveRating, forward, white, animation, gameEnded, capture, nextCapture, castle, nextCastle, setAnimation, result, analyzeMove } = props

    const dragRef = useRef(drag)
    dragRef.current = drag
    const fen = props.fen
    const nextFen = props.nextFen
    const move = props.move ?? []
    const nextMove = props.nextMove ?? []

    const squareSize = Math.round(boardSize / 8)
    const guideSize = squareSize / 4
    const leftSize = guideSize / 4.5
    const rightSize = guideSize / 2.5

    const chess = new Chess(fen)
    const board = chess.board()
    if (!white) flipBoard(board)

    const whiteMoving = !(chess.turn() === 'w')

    const castleRookFrom = getCastleRookFromSquare(forward ? castle : nextCastle, forward ? whiteMoving : !whiteMoving)
    const castleRookTo = getCastleRookToSquare(forward ? castle : nextCastle, forward ? whiteMoving : !whiteMoving)

    const castleRookMove: square[] = castleRookFrom && castleRookTo ? [castleRookFrom, castleRookTo] : []

    const filteredHighlightStyle = filterHighlightStyle(HIGHLIGHT_COLORS)

    const highlightColor = highlightByRating ? filteredHighlightStyle[moveRating as keyof typeof filteredHighlightStyle]?.color || boardThemes[boardTheme].highlight : boardThemes[boardTheme].highlight
    const highlightRating = filteredHighlightStyle[moveRating as keyof typeof filteredHighlightStyle]?.rating

    const soundChessInstance = forward ? chess : new Chess(nextFen)
    const soundCaptureInstance = forward ? capture : nextCapture
    const soundCastleInstance = forward ? castle : nextCastle

    const selfTurn = !(soundChessInstance.turn() === 'w' ? white : !white)

    useEffect(() => {
        if (drag.is) return
        if (!drag.id) return

        const selectedPiece = chess.get(drag.id as Square)
        if (!selectedPiece) {
            setDrag({ is: false, id: "" })
            return
        }

        if (selectedPiece.color !== chess.turn()) {
            setDrag({ is: false, id: "" })
            return
        }
    }, [fen])

    useEffect(() => {
        if (!props.fen) return
        if (!boardSounds) return
        if (analyzingMove) return

        if (forward && props.moveRating === 'brilliant') {
            brilliantSound.play()
        } else if (soundCastleInstance) {
            castleSound.play()
        } else if (soundCaptureInstance) {
            captureSound.play()
        } else if (soundChessInstance.isCheck()) {
            moveCheckSound.play()
        } else {
            if (selfTurn) {
                moveSelfSound.play()
            } else {
                moveOpponentSound.play()
            }
        }

        if (gameEnded) {
            gameEndSound.play()
        }
    }, [fen, props.moveRating, analyzingMove])

    useEffect(() => {
        if (!animation) return
        if (!animateMoves) return

        if (pieceRef.current) animateMove(pieceRef.current, forward ? move : nextMove, 60, forward, white, squareSize)
        if (castleRookRef.current) animateMove(castleRookRef.current, castleRookMove, 50, forward, white, squareSize)
    }, [move, animation])

    let newMaterialAdvantage = 0
    useEffect(() => setMaterialAdvantage(newMaterialAdvantage), [fen])

    function startArrow(x: number, y: number) {
        const rowNumber = Math.floor(y / squareSize)
        const colNumber = Math.floor(x / squareSize)

        const square = { col: white ? colNumber : 7 - colNumber, row: white ? rowNumber : 7 - rowNumber }
        currentArrowRef.current[0] = square
    }
    function endArrow(x: number, y: number) {
        const rowNumber = Math.floor(y / squareSize)
        const colNumber = Math.floor(x / squareSize)

        const square = { col: white ? colNumber : 7 - colNumber, row: white ? rowNumber : 7 - rowNumber }
        currentArrowRef.current[1] = square

        if (!currentArrowRef.current[0] || !currentArrowRef.current[1]) return

        pushArrow([...currentArrowRef.current])

        currentArrowRef.current = []
    }

    function filterHighlightStyle(highlightStyle: typeof HIGHLIGHT_COLORS) {
        const filteredHighlightStyle: filteredHighlightStyle = {}
        for (const key in highlightStyle) {
            const rating = key as keyof typeof usedRatings
            if (usedRatings[rating]) filteredHighlightStyle[rating as string] = { color: HIGHLIGHT_COLORS[rating], rating }
        }

        return filteredHighlightStyle
    }

    function movePiece(from: string, to: string, animate: boolean) {
        setTimeout(() => setDrag({ is: false, id: '' }), 0)

        if (analyzingMove) return

        const formattedFrom = formatSquare(from)
        const formattedTo = formatSquare(to)

        if (chess.get(from as Square)?.type === PAWN && [0, 7].includes(formattedTo.row)) {
            setCoronation({ choosing: true, movement: [formattedFrom, formattedTo] })
        } else {
            analyzeMove(fen, { from, to }, sacrifice ?? false, previousStaticEvals ?? [], animate, bestMoveSan)
        }
    }

    async function handleMovePiece(e: React.MouseEvent, toSquare: string) {
        if (e.button !== 0) return
        if (!dragRef.current.id) return
        if (isMouseSuppressed()) return

        movePiece(dragRef.current.id, toSquare, e.type === "mousedown")
    }

    function getTouchedSquare(clientX: number, clientY: number): { id: string, square: square } | null {
        const board = boardRef.current
        if (!board) return null

        const rect = board.getBoundingClientRect()
        const column = Math.floor((clientX - rect.left) / (rect.width / 8))
        const row = Math.floor((clientY - rect.top) / (rect.height / 8))

        if (column < 0 || column > 7 || row < 0 || row > 7) return null

        const boardColumn = white ? column : 7 - column
        const boardRow = white ? row : 7 - row

        return { id: getSquareId(boardColumn, boardRow), square: { col: boardColumn, row: boardRow } }
    }

    function isLegalTouchMove(from: string, to: string) {
        return chess.moves({ square: from as Square, verbose: true }).some(move => move.to === to)
    }

    function handleTouchStart(e: React.TouchEvent) {
        if (coronation.choosing) return

        const touch = e.touches[0]
        if (!touch) return

        const touched = getTouchedSquare(touch.clientX, touch.clientY)
        if (!touched) return

        suppressMouse()

        const piece = chess.get(touched.id as Square)
        const ownPiece = Boolean(piece && piece.color === chess.turn())

        setTouchMode(true)

        touchRef.current = {
            active: true,
            from: touched.id,
            square: touched.square,
            startX: touch.clientX,
            startY: touch.clientY,
            moved: false,
            ownPiece,
            selectedBefore: dragRef.current.id,
        }

        if (ownPiece) {
            setDrag({ is: true, id: touched.id })
            setPlaying(false)
            return
        }

        // Long press on an empty square draws an arrow, just like right click
        // on desktop. It is only armed when no piece is currently selected.
        if (dragRef.current.id) return

        clearTimeout(arrowTimeoutRef.current)
        arrowTimeoutRef.current = setTimeout(() => {
            const state = touchRef.current
            if (!state?.active || state.moved) return

            touchArrowRef.current = { from: touched.square }
            setArrowDraft({ from: touched.square })
        }, 420)
    }

    function handleTouchMove(e: React.TouchEvent) {
        const state = touchRef.current
        if (!state?.active) return

        const touch = e.touches[0]
        if (!touch) return

        const x = touch.clientX - state.startX
        const y = touch.clientY - state.startY

        if (!state.moved && (Math.abs(x) > 5 || Math.abs(y) > 5)) {
            state.moved = true
            clearTimeout(arrowTimeoutRef.current)
        }

        if (!state.moved) return

        if (touchArrowRef.current) {
            const touched = getTouchedSquare(touch.clientX, touch.clientY)
            if (!touched) return

            touchArrowRef.current.to = touched.square
            setArrowDraft({ from: touchArrowRef.current.from, to: touched.square })
        }
    }

    function handleTouchEnd(e: React.TouchEvent) {
        const state = touchRef.current
        touchRef.current = null

        clearTimeout(arrowTimeoutRef.current)

        const arrowState = touchArrowRef.current
        touchArrowRef.current = null

        if (arrowState) {
            setArrowDraft(null)
            suppressMouse()

            if (arrowState.to && (arrowState.to.col !== arrowState.from.col || arrowState.to.row !== arrowState.from.row)) {
                pushArrow([arrowState.from, arrowState.to])
            }
            return
        }

        if (!state?.active) return

        const touch = e.changedTouches[0]
        const target = touch ? getTouchedSquare(touch.clientX, touch.clientY) : null
        const selected = dragRef.current.id

        if (state.moved) {
            suppressMouse()

            if (state.ownPiece && target && target.id !== state.from && isLegalTouchMove(state.from, target.id)) {
                movePiece(state.from, target.id, true)
            } else {
                setDrag({ is: false, id: '' })
            }
            return
        }

        // A tap on one of our own pieces selects it (or deselects it when it
        // was already selected).
        if (state.ownPiece) {
            setDrag({ is: false, id: state.selectedBefore === state.from ? '' : state.from })
            return
        }

        if (selected && target && isLegalTouchMove(selected, target.id)) {
            movePiece(selected, target.id, false)
            return
        }

        setDrag({ is: false, id: '' })
        cleanArrows()
    }

    function handleTouchCancel() {
        touchRef.current = null
        touchArrowRef.current = null
        clearTimeout(arrowTimeoutRef.current)
        setArrowDraft(null)
    }

    function cleanDrag(target: HTMLElement) {
        if (target.dataset.dontcleandrag) return

        setDrag({ id: '', is: false })
    }

    function handleMouseDown(e: React.MouseEvent) {
        if (drag.is) return
        if (isMouseSuppressed()) return

        setTouchMode(false)

        cleanDrag(e.target as HTMLElement)

        if (e.button === 2) {
            e.preventDefault()
            const element = e.currentTarget
            const elementRect = element.getBoundingClientRect()

            startArrow(e.clientX - elementRect.x, e.clientY - elementRect.y)
        } else {
            cleanArrows()
        }
    }

    function handleMouseUp(e: React.MouseEvent) {
        if (drag.is) return
        if (isMouseSuppressed()) return

        if (e.button === 2) {
            e.preventDefault()
            setAnimation(false)
            const element = e.currentTarget
            const elementRect = element.getBoundingClientRect()

            endArrow(e.clientX - elementRect.x, e.clientY - elementRect.y)
        }
    }

    function animateMove(element: HTMLElement, move: square[], zIndex: number, forward: boolean, white: boolean, squareSize: number) {
        if (move.length === 0) return
        const [from, to] = move
    
        const fromElementPosition = {
            bottom: squareSize * from.row,
            left: squareSize * from.col,
        }
    
        const toElementPosition = {
            bottom: squareSize * to.row,
            left: squareSize * to.col,
        }
    
        const distance = {
            x: (toElementPosition.left - fromElementPosition.left) * (white ? 1 : -1),
            y: (toElementPosition.bottom - fromElementPosition.bottom) * (white ? 1 : -1),
        }

        function resetElements() {
            if (!element) return
            element.style.zIndex = ''
            element.style.willChange = ''
        }

        element.style.zIndex = String(zIndex)
        element.style.willChange = 'transform'

        const animation = element.animate(
            [
                { transform: `translate(${forward ? -distance.x : 0}px, ${forward ? distance.y : 0}px)` },
                { transform: `translate(${!forward ? distance.x : 0}px, ${!forward ? -distance.y : 0}px)` },
            ],
            { duration: 150, easing: 'linear', direction: forward ? 'normal' : 'reverse' },
        )

        animation.finished.then(resetElements).catch(resetElements)
        animation.oncancel = resetElements
    }

    function getLegalMoves() {
        if (!drag.id) return []

        const moves = chess.moves({ square: drag.id as Square, verbose: true }).map(move => move.to)
        return moves
    }

    const legalMoves = getLegalMoves()

    const boardColors = [boardThemes[boardTheme].white, boardThemes[boardTheme].black]

    const adaptedCoronationSquare = coronation.movement[0] ? adaptSquare(coronation.movement[0]) : null

    return (
        <div ref={boardRef} onContextMenu={e => e.preventDefault()} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel} className="board-surface grid w-fit h-fit relative" style={{ gridTemplateColumns: `repeat(8, ${squareSize}px)`, pointerEvents: drag.is && !touchMode ? 'none' : 'unset' }}>
            {
                (() => {
                    const squares: JSX.Element[] = []
                    let rowNumber = white ? 0 : 7
                    for (const row of board) {
                        let columnNumber = white ? 0 : 7
                        for (const square of row) {
                            const squareId = getSquareId(columnNumber, rowNumber)

                            let bgColor, guideColor
                            if (isEven(rowNumber)) {
                                if (isEven(columnNumber)) {
                                    bgColor = boardColors[0]
                                    guideColor = boardColors[1]
                                } else {
                                    bgColor = boardColors[1]
                                    guideColor = boardColors[0]
                                }
                            } else {
                                if (isEven(columnNumber)) {
                                    bgColor = boardColors[1]
                                    guideColor = boardColors[0]
                                } else {
                                    bgColor = boardColors[0]
                                    guideColor = boardColors[1]
                                }
                            }

                            let squareNumGuide, squareLetterGuide
                            if (rowNumber === (white ? 7 : 0)) {
                                squareLetterGuide = <span style={{ right: rightSize, color: guideColor }} className={`absolute bottom-0`}>{squareId[0]}</span>
                            }
                            if (columnNumber === (white ? 0 : 7)) {
                                squareNumGuide = <span style={{ left: leftSize, color: guideColor }} className={`absolute top-0`}>{squareId[1]}</span>
                            }

                            let rounded: string = ''
                            if (rowNumber === 0 && columnNumber === 0) rounded = white ? 'rounded-tl-borderRoundness' : 'rounded-br-borderRoundness'
                            if (rowNumber === 7 && columnNumber === 0) rounded = white ? 'rounded-bl-borderRoundness' : 'rounded-tr-borderRoundness'
                            if (rowNumber === 0 && columnNumber === 7) rounded = white ? 'rounded-tr-borderRoundness' : 'rounded-bl-borderRoundness'
                            if (rowNumber === 7 && columnNumber === 7) rounded = white ? 'rounded-br-borderRoundness' : 'rounded-tl-borderRoundness'

                            const iconTranslateX = (white ? columnNumber === 7 : columnNumber === 0) ? -5 : 35
                            const iconTranslateY = (white ? rowNumber === 0 : rowNumber === 7) ? 5 : -35

                            const iconSize = squareSize / 2.4

                            let highlighted, highlightedIcon
                            move.forEach((square, i) => {
                                const highlightedSquare = adaptSquare(square)
                                if (highlightedSquare.col === columnNumber && highlightedSquare.row === rowNumber) {
                                    highlighted = <div style={{ backgroundColor: highlightColor }} className={`absolute z-[10] top-0 left-0 w-full h-full opacity-50 ${rounded}`} />
                                    if (i === 1) highlightedIcon = highlightRating && i === 1 ? <RatingSVG className="absolute top-0 right-0 z-[80] pointer-events-none" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)` }} size={iconSize} rating={highlightRating} /> : ''
                                }
                            })

                            if ((squareId === drag.id && !highlighted) || (coronation.choosing && adaptedCoronationSquare?.col === columnNumber && adaptedCoronationSquare?.row === rowNumber)) {
                                highlighted = <div style={{ backgroundColor: boardThemes[boardTheme].highlight }} className={`absolute top-0 left-0 w-full h-full opacity-50 ${rounded}`} />
                            }

                            let resultIcon
                            if (gameEnded) {
                                if (square?.type === KING) {
                                    if (result === '1/2-1/2') {
                                        resultIcon = <ResultSVG className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)` }} size={iconSize} result="draw" />
                                    } else {
                                        if (square.color === WHITE) {
                                            if (result === '1-0') resultIcon = resultIcon = <ResultSVG className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)` }} size={iconSize} result="victory" />
                                            else if (result === '0-1') resultIcon = <ResultSVG className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%) rotate(-90deg)` }} size={iconSize} result="defeat" />
                                        } else {
                                            if (result === '0-1') resultIcon = <ResultSVG className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%)` }} size={iconSize} result="victory" />
                                            else if (result === '1-0') resultIcon = <ResultSVG className="absolute top-0 right-0 z-[60]" style={{ transform: `translateX(${iconTranslateX}%) translateY(${iconTranslateY}%) rotate(-90deg)` }} size={iconSize} result="defeat" />
                                        }
                                    }
                                }
                            }

                            const toAnimateSquare = forward ? move[1] : nextMove[0]
                            const adaptedToAnimateSquare = toAnimateSquare ? adaptSquare(toAnimateSquare) : { col: NaN, row: NaN }
                            const moved = adaptedToAnimateSquare.col === columnNumber && adaptedToAnimateSquare.row === rowNumber

                            const isCastleRook = forward ? (castleRookTo?.col === columnNumber && castleRookTo?.row === rowNumber) : (castleRookFrom?.col === columnNumber && castleRookFrom?.row === rowNumber)

                            const pieceColor = square?.color
                            const pieceType = square?.type
                            let piece
                            if (pieceColor && pieceType) {
                                piece = <Piece
                                    setPlaying={setPlaying}
                                    squareSize={squareSize}
                                    drag={drag}
                                    setDrag={setDrag}
                                    id={squareId}
                                    pieceRef={pieceRef}
                                    moved={moved}
                                    isCastleRook={isCastleRook}
                                    castleRookRef={castleRookRef}
                                    pieceColor={pieceColor}
                                    pieceSymbol={pieceType}
                                    boardRef={boardRef}
                                    canDragTouch={Boolean(square?.color && square.color === chess.turn())}
                                    isCoronating={coronation.choosing && adaptedCoronationSquare?.col === columnNumber && adaptedCoronationSquare?.row === rowNumber}
                                />
                            }

                            const hoverDragSquare = <div style={{ display: drag.is ? '' : 'none',  opacity: hoverDrag === squareId ? '100' : '', borderWidth: squareSize * 0.05 }} onMouseEnter={() => setHoverDrag(squareId)} onMouseLeave={() => setHoverDrag('')} className={`absolute top-0 z-[30] left-0 w-full h-full border-opacity-65 opacity-0 block border-white pointer-events-auto ${rounded}`} />

                            const legalMove = legalMoves.includes(squareId as Square) ? (
                                piece ?
                                    <div onMouseEnter={() => setHoverDrag(squareId)} onMouseLeave={() => setHoverDrag('')} onMouseDown={(e) => handleMovePiece(e, squareId)} onMouseUp={(e) => handleMovePiece(e, squareId)} className="absolute w-full h-full z-[40] top-0 left-0 cursor-grab pointer-events-auto"><div style={{ borderWidth: squareSize * 0.12 }} className="border-black opacity-[15%] w-full h-full rounded-full" /></div>
                                :
                                    <div onMouseEnter={() => setHoverDrag(squareId)} onMouseLeave={() => setHoverDrag('')} onMouseDown={(e) => handleMovePiece(e, squareId)} onMouseUp={(e) => handleMovePiece(e, squareId)} style={{ opacity: showLegalMoves ? '' : 0 }} className="absolute w-full h-full z-[40] top-0 left-0 flex justify-center items-center pointer-events-auto"><div className="bg-black opacity-[15%] w-[30%] h-[30%] rounded-full" /></div>
                            ) : null

                            squares.push(<div data-square={squareId} key={squareId} style={{ height: squareSize + 'px', width: squareSize + 'px', fontSize: guideSize, backgroundColor: bgColor }} className={`font-bold relative ${rounded}`}>{squareNumGuide}{squareLetterGuide}{piece}{highlighted}{resultIcon ? null : highlightedIcon}{resultIcon}{hoverDragSquare}{legalMove}</div>)

                            if (square) {
                                if (square?.color === WHITE) {
                                    newMaterialAdvantage += PIECES_VALUES[square.type as keyof typeof PIECES_VALUES]
                                } else {
                                    newMaterialAdvantage -= PIECES_VALUES[square.type as keyof typeof PIECES_VALUES]
                                }
                            }

                            if (white) columnNumber++
                            else columnNumber--
                        }
                        if (white) rowNumber++
                        else rowNumber--
                    }
                    return squares
                })()
            }
            {
                (() => {
                    if (!showArrows) return
                    if ((highlightRating === 'book' && arrowAfterMove) || highlightRating === undefined) return

                    const move = arrowAfterMove ? previousBestMove : bestMove
                    const adaptedMove = move?.map(square => {
                        return adaptSquare(square)
                    })

                    return adaptedMove ? <Arrow move={adaptedMove} squareSize={squareSize} class="fill-bestArrow stroke-bestArrow" white={white} /> : ''
                })()
            }
            {
                arrows.map((move, i) => {
                    const singleSquare = JSON.stringify(move[0]) === JSON.stringify(move[1])

                    return <Arrow key={i} move={singleSquare ? [move[0]] : move} squareSize={squareSize} class={singleSquare ? "bg-badArrow" : "fill-normalArrow stroke-normalArrow"} white={white} />
                })
            }
            {
                arrowDraft?.to ? <Arrow move={[arrowDraft.from, arrowDraft.to]} squareSize={squareSize} class="fill-normalArrow stroke-normalArrow opacity-60" white={white} /> : ''
            }
            {
                (() => {
                    if (!coronation.choosing) return

                    function coronate(piece: PieceSymbol) {
                        const from = deformatSquare(coronation.movement[0])
                        const to = deformatSquare(coronation.movement[1])

                        analyzeMove(fen, { from, to, promotion: piece }, sacrifice ?? false, previousStaticEvals ?? [], false, bestMoveSan)
                        setCoronation({ choosing: false, movement: [] })
                    }

                    const to = coronation.movement[1]

                    return <Coronation white={white} squareSize={squareSize} column={to.col} coroningWhite={!whiteMoving} clearCoronation={() => setCoronation({ choosing: false, movement: [] })} coronate={coronate} />
                })()
            }
        </div>
    )
}
