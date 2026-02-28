import BingoTile from './BingoTile';
import { isInLine } from '../../utils/boardUtils';
import useGameStore from '../../store/gameStore';

export default function BingoBoard({ send, onWinClaim }) {
  const {
    room,
    boardArrangement,
    markedNumbers,
    calledNumbers,
    completedLines,
    autoMark,
    playerId,
    markNumber,
  } = useGameStore();

  const n = room?.boardSize ?? 5;

  if (!boardArrangement) {
    return (
      <div className="board-placeholder">
        <p>Waiting for board…</p>
      </div>
    );
  }

  const calledSet  = new Set(calledNumbers);
  const myLines    = completedLines.filter((l) => l.playerId === playerId);

  const handleTap = (number) => {
    if (!calledSet.has(number) || autoMark) return;
    markNumber(number);
    send('MARK_TILE', { number });
  };

  return (
    <div
      className="bingo-board"
      style={{ '--board-n': n }}
    >
      {boardArrangement.map((num, i) => (
        <BingoTile
          key={i}
          number={num}
          isMarked={markedNumbers.has(num)}
          isCalled={calledSet.has(num)}
          isInLine={isInLine(i, myLines, n)}
          onTap={handleTap}
          data-cell-index={i}
        />
      ))}
    </div>
  );
}
