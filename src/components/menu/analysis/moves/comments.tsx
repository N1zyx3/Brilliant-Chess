import RatingSVG from "@/components/svg/rating"
import { moveRating } from "@/engine/stockfish"
import { useI18n } from "@/context/i18n"
import { translate } from "@/i18n"

export function FormatEval(props: {evaluation: string[], white: boolean, smaller?: boolean, best?: boolean}) {
    const { evaluation, white, smaller, best } = props

    const number = (Number(evaluation[1]) / 100) * (white ? 1 : -1)
            
    let prevChar = ''
    if (number > 0) prevChar = '+'
    if (number < 0) prevChar = '-'

    return (
        <div style={{ fontSize: smaller ? "14px" : "", padding: smaller ? "2px" : "", width: smaller ? "46px" : "", backgroundColor: prevChar === '-' ? 'var(--evaluationBarBlack)' : 'var(--evaluationBarWhite)', color: prevChar === '-' ? 'var(--foreground)' : 'var(--foregroundBlack)', filter: prevChar === '-' ? '' : 'brightness(0.9)'}} className="rounded-borderRoundness py-1 font-extrabold w-[61px] text-center">
            {(() => {
                if (evaluation[0] === 'mate' && evaluation[1]) {
                    return prevChar + "M" + (Math.abs(Number(evaluation[1])) - Number(Boolean(best)))
                } else if (!evaluation[1]) {
                    if (white) return '0-1'
                    else return '1-0'
                } else {
                    return prevChar + Math.abs(number).toFixed(2)
                }
            })()}
        </div>
    )
}

export default function Comments(props: { comment?: string, rating?: moveRating, moveSan?: string, evaluation: string[], white: boolean, overallGameComment: string }) {
    const { comment, rating, moveSan, evaluation, white, overallGameComment } = props
    const { t } = useI18n()

    if (!comment || !rating || !moveSan) {
        return (
            <div className="bg-white w-[85%] rounded-borderExtraRoundness p-4 font-bold text-lg text-foregroundBlack" dangerouslySetInnerHTML={{ __html: overallGameComment }} />
        )
    }

    return (
        <div style={{backgroundColor: "#ffffff"}} className="h-44 w-[85%] p-4 rounded-borderExtraRoundness text-foregroundBlack text-lg font-bold flex flex-col gap-1">
            <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row items-center gap-2">
                    <RatingSVG draggable rating={rating} size={32} />
                    <span>{translate(t.comments.rating[rating], { move: moveSan })}</span>
                </div>
                <FormatEval evaluation={evaluation} white={white} />
            </div>
            <div>
                {comment}
            </div>
        </div>
    )
}