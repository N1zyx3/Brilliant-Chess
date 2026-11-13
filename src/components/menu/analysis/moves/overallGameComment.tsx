import { result } from "@/engine/stockfish"
import { OverallComments } from "@/i18n"

export default function getOverallGameComment(playerNames: [string, string], result: result, comments: OverallComments) {
    const [ white, black ] = playerNames

    const getComment = (commentList: string[], winner: string, loser: string) => {
        const tab = [`<span class="font-extrabold" style="color: var(--foregroundBlackDark);">`, `</span>`]

        return commentList[Math.floor(Math.random() * commentList.length)].replace(/__WINNER__/g, tab[0] + winner + tab[1]).replace(/__LOSER__/g, tab[0] + loser + tab[1])
    }

    let comment: string, randomBool: boolean
    switch (result) {
        case '1-0':
            comment = getComment(comments.win, white, black)
            break
        case '0-1':
            comment = getComment(comments.win, black, white)
            break
        case '1/2-1/2':
            randomBool = Boolean(Math.floor(Math.random() * 2))
            comment = getComment(comments.draw, randomBool ? white : black, randomBool ? black : white)
            break
        case '*': case '':
            randomBool = Boolean(Math.floor(Math.random() * 2))
            comment = getComment(comments.unknown, randomBool ? white : black, randomBool ? black : white)
            break
    }

    return comment
}