import { moveRating } from "@/engine/stockfish"
import { avg } from "./playersAccuracy"
import RatingBox from "./ratingBox"
import RatingSVG from "@/components/svg/rating"
import { useI18n } from "@/context/i18n"

function topElo(elo: number) {
    const MAX_ELO = 3000

    if (elo > MAX_ELO) return `${MAX_ELO}+`
    else return String(elo)
}

function getRating(accuracy: number): number {
    function nonLinearFunction(x: number): number {
        return 1.5 * Math.pow(x, 4)
    }

    const minAccuracy = 40
    const maxAccuracy = 100

    const minRating = 300
    const maxRating = 3000

    const normalizedAccuracy = (accuracy - minAccuracy) / (maxAccuracy - minAccuracy)
    const nonLinearAccuracy = nonLinearFunction(normalizedAccuracy)

    const rating = ((maxRating - minRating) * nonLinearAccuracy) + minRating
    const roundedRating = Math.round(rating / 50) * 50

    return isNaN(roundedRating) ? 0 : roundedRating
}

function getRatingPhase(accuracy: number[]) {
    const avgAccuracy = avg(accuracy)

    if (accuracy.length < 3) return { rating: null, accuracy: null }

    let rating: moveRating
    if (avgAccuracy >= 95) {
        rating = 'great'
    } else if (avgAccuracy >= 90) {
        rating = 'best'
    } else if (avgAccuracy >= 80) {
        rating = 'excellent'
    } else if (avgAccuracy >= 60) {
        rating = 'good'
    } else if (avgAccuracy >= 40) {
        rating = 'inaccuracy'
    } else if (avgAccuracy >= 20) {
        rating = 'mistake'
    } else {
        rating = 'blunder'
    }

    return { rating, accuracy: avgAccuracy.toFixed(1) }
}

function RatingIcon(props: { ratingPhase: {rating: moveRating|null, accuracy: string|null}, titleText: string }) {
    const { titleText, ratingPhase } = props
    const { rating, accuracy } = ratingPhase
    const { t } = useI18n()

    if (!rating || !accuracy) return <span className="text-xl" title={t.common.notEnoughMoves}>-</span>

    return <RatingSVG draggable rating={rating} size={30} title={titleText + ': ' + accuracy} />
}

export default function GameRating(props: { reducedSummary: boolean, accuracy: { w: number, b: number }, accuracyPhases: { opening: { w: number[], b: number[] }, middlegame: { w: number[], b: number[] }, endgame: { w: number[], b: number[] } } }) {
    const { accuracy, accuracyPhases, reducedSummary } = props
    const { t } = useI18n()

    return (
        <div className="w-[85%] flex flex-col items-end gap-3">
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey reduceSummary:text-lg text-base">{reducedSummary ? t.summary.rating : t.summary.gameRating}</span>
                <div className="flex flex-row reduceSummary:w-[262px] reduceSummary:min-w-[262px] min-w-[160px] w-[160px] justify-between">
                    <RatingBox fontSize={reducedSummary ? 18 : undefined} width={reducedSummary ? 64 : undefined} paddingY={reducedSummary ? 4 : undefined} white>{topElo(getRating(accuracy.w))}</RatingBox>
                    <RatingBox fontSize={reducedSummary ? 18 : undefined} width={reducedSummary ? 64 : undefined} paddingY={reducedSummary ? 4 : undefined}>{topElo(getRating(accuracy.b))}</RatingBox>
                </div>
            </div>
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey reduceSummary:text-lg text-base">{t.summary.opening}</span>
                <div className="flex flex-row reduceSummary:w-[262px] w-[160px] justify-between">
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.opening.w)} titleText={t.summary.openingAccuracy} /></div>
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.opening.b)} titleText={t.summary.openingAccuracy} /></div>
                </div>
            </div>
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey reduceSummary:text-lg text-base">{t.summary.midgame}</span>
                <div className="flex flex-row reduceSummary:w-[262px] w-[160px] justify-between">
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.middlegame.w)} titleText={t.summary.middlegameAccuracy} /></div>
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.middlegame.b)} titleText={t.summary.middlegameAccuracy} /></div>
                </div>
            </div>
            <div className="flex flex-row w-full justify-between items-center">
                <span className="font-bold text-foregroundGrey reduceSummary:text-lg text-base">{t.summary.endgame}</span>
                <div className="flex flex-row reduceSummary:w-[262px] w-[160px] justify-between">
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.endgame.w)} titleText={t.summary.endgameAccuracy} /></div>
                    <div className="reduceSummary:w-20 w-16 flex items-center justify-center select-none"><RatingIcon ratingPhase={getRatingPhase(accuracyPhases.endgame.b)} titleText={t.summary.endgameAccuracy} /></div>
                </div>
            </div>
        </div>
    )
}